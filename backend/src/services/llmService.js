const axios = require("axios");
const { clip } = require("../utils/text");

function isDemoMode() {
  return String(process.env.DEMO_MODE || "false").toLowerCase() === "true";
}

function buildPrompt({ context, publications, trials, demoMode = false }) {
  const selectedPublications = publications.slice(0, demoMode ? 3 : 4);
  const selectedTrials = trials.slice(0, demoMode ? 2 : 3);

  const publicationBlock = selectedPublications
    .map(
      (pub, idx) =>
        `${idx + 1}. ${pub.title} (${pub.year || "n/a"}, ${pub.source})\nAuthors: ${(pub.authors || []).join(", ") || "Not listed"}\nCitations: ${pub.citationCount ?? "n/a"}\nSummary: ${clip(pub.summary || "No abstract available", demoMode ? 70 : 90)}\nURL: ${pub.url}`
    )
    .join("\n\n");

  const trialsBlock = selectedTrials
    .map(
      (trial, idx) =>
        `${idx + 1}. ${trial.title}\nStatus: ${trial.status}\nEligibility: ${clip(trial.eligibility || "Not listed", demoMode ? 60 : 80)}\nLocation: ${trial.location}\nContact: ${trial.contact?.email || trial.contact?.phone || "Not listed"}\nURL: ${trial.url}`
    )
    .join("\n\n");

  return `You are Curalink, a cautious medical research assistant.
Use ONLY the provided evidence. Never invent facts and never diagnose.
If evidence is weak or conflicting, explicitly state uncertainty.

Return strictly valid JSON with this exact schema:
{
  "overview": "string",
  "researchInsights": ["string"],
  "clinicalTrialInsights": ["string"],
  "personalizedInsight": "string",
  "sourceAttribution": ["string"]
}

Rules:
- overview: concise synthesis in 4 to 7 sentences
- researchInsights: 4 to 6 bullet-like findings grounded in publication evidence
- clinicalTrialInsights: 2 to 4 bullet-like trial insights
- personalizedInsight: 2 to 3 sentences tailored to patient context, disease, intent, and location when provided
- sourceAttribution: cite evidence references in the format "[P#] title - why relevant" or "[T#] title - why relevant"
- If no trial evidence exists, include exactly one clinicalTrialInsights item stating no relevant trials were identified
- Do not output placeholder values such as "string", "none", or "n/a"

User Context:
- Patient: ${context.patientName || "Not provided"}
- Disease: ${context.disease || "Not provided"}
- Intent: ${context.intent || "Not provided"}
- Query: ${context.query || "Not provided"}
- Location: ${context.location || "Not provided"}

Top Publications:
${publicationBlock || "None"}

Top Clinical Trials:
${trialsBlock || "None"}
`;
}

function fallbackStructuredAnswer(context, publications, trials) {
  const overviewTopic = context.disease || context.query || "the requested medical topic";
  const trialFallback = trials.length
    ? trials.slice(0, 3).map((trial) => `${trial.title} (${trial.status}, ${trial.location})`)
    : ["No directly relevant recruiting or active clinical trials were identified in the retrieved set."];

  return {
    overview: `Evidence synthesis for ${overviewTopic}: top-ranked publications and trial registries were reviewed to summarize recent findings. This output is research support only and is not a diagnosis or treatment plan.`,
    researchInsights: publications.slice(0, 5).map((pub) => `${pub.title} (${pub.year || "n/a"}, ${pub.source})`),
    clinicalTrialInsights: trialFallback,
    personalizedInsight: `For ${context.patientName || "this patient"}, use the ranked evidence as discussion material with a licensed clinician to compare treatment options, eligibility constraints, and safety trade-offs for ${overviewTopic}.`,
    sourceAttribution: [
      ...publications.slice(0, 4).map((pub, index) => `[P${index + 1}] ${pub.title} - ranked by relevance and recency`),
      ...trials.slice(0, 2).map((trial, index) => `[T${index + 1}] ${trial.title} - matched to clinical-trial intent`)
    ]
  };
}

function parseModelJson(rawText) {
  if (!rawText) {
    return null;
  }

  try {
    return JSON.parse(rawText);
  } catch (_error) {
    const startIndex = rawText.indexOf("{");
    const endIndex = rawText.lastIndexOf("}");
    if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
      return null;
    }

    const maybeJson = rawText.slice(startIndex, endIndex + 1);
    try {
      return JSON.parse(maybeJson);
    } catch (_nestedError) {
      return null;
    }
  }
}

function normalizeAnswerShape(parsed) {
  return {
    overview: parsed.overview || "",
    researchInsights: Array.isArray(parsed.researchInsights) ? parsed.researchInsights : [],
    clinicalTrialInsights: Array.isArray(parsed.clinicalTrialInsights) ? parsed.clinicalTrialInsights : [],
    personalizedInsight: parsed.personalizedInsight || "",
    sourceAttribution: Array.isArray(parsed.sourceAttribution) ? parsed.sourceAttribution : []
  };
}

function hasPlaceholder(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return !normalized || normalized === "string" || normalized === "n/a" || normalized === "none";
}

function isLowQualityAnswer(answer) {
  const overviewTooWeak = hasPlaceholder(answer.overview);
  const personalizedTooWeak = hasPlaceholder(answer.personalizedInsight);
  const insightsTooWeak = answer.researchInsights.length < 1 || answer.researchInsights.every((item) => hasPlaceholder(item));
  const attributionTooWeak = answer.sourceAttribution.length < 1 || answer.sourceAttribution.every((item) => hasPlaceholder(item));

  return overviewTooWeak || personalizedTooWeak || insightsTooWeak || attributionTooWeak;
}

function getErrorMessage(error) {
  return error?.response?.data?.error || error?.message || "Unknown LLM error";
}

function fallbackModelPreferences(primaryModel) {
  const configuredFallbacks = (process.env.OLLAMA_FALLBACK_MODELS || "mistral:7b,llama3.2:3b,tinyllama")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => item !== primaryModel);

  return [...new Set(configuredFallbacks)];
}

async function listAvailableModels(endpoint) {
  try {
    const response = await axios.get(`${endpoint}/api/tags`, { timeout: 15000 });
    return (response.data?.models || [])
      .map((model) => ({
        name: model.name,
        size: Number(model.size || Number.MAX_SAFE_INTEGER)
      }))
      .sort((a, b) => a.size - b.size);
  } catch (_error) {
    return [];
  }
}

async function callOllamaGenerate({ endpoint, model, prompt, timeoutMs = 90000, numPredict = 900 }) {
  const response = await axios.post(
    `${endpoint}/api/generate`,
    {
      model,
      prompt,
      format: "json",
      stream: false,
      options: {
        temperature: 0.1,
        num_predict: numPredict
      }
    },
    { timeout: timeoutMs }
  );

  const rawText = response.data?.response || "";
  const parsed = parseModelJson(rawText);
  if (!parsed) {
    throw new Error("Could not parse model JSON output");
  }

  const normalized = normalizeAnswerShape(parsed);
  if (isLowQualityAnswer(normalized)) {
    throw new Error("Model output was too generic for safe use");
  }

  return normalized;
}

function shouldTryFallbackModels(errorMessage) {
  const normalized = String(errorMessage || "").toLowerCase();
  return (
    normalized.includes("requires more system memory") ||
    normalized.includes("model not found") ||
    normalized.includes("context") ||
    normalized.includes("status code 500")
  );
}

async function generateStructuredAnswer({ context, publications, trials }) {
  const model = process.env.OLLAMA_MODEL || "llama3.1:8b";
  const endpoint = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const demoMode = isDemoMode();
  const configuredPrimaryTimeout = Number(process.env.OLLAMA_TIMEOUT_MS || 90000);
  const configuredFallbackTimeout = Number(process.env.OLLAMA_FALLBACK_TIMEOUT_MS || 30000);
  const primaryTimeout = demoMode ? Math.min(configuredPrimaryTimeout, 10000) : configuredPrimaryTimeout;
  const fallbackTimeout = demoMode ? Math.min(configuredFallbackTimeout, 8000) : configuredFallbackTimeout;
  const primaryNumPredict = demoMode
    ? Math.min(Number(process.env.OLLAMA_NUM_PREDICT || 260), 220)
    : Number(process.env.OLLAMA_NUM_PREDICT || 420);
  const fallbackNumPredict = demoMode
    ? Math.min(Number(process.env.OLLAMA_FALLBACK_NUM_PREDICT || 200), 180)
    : Number(process.env.OLLAMA_FALLBACK_NUM_PREDICT || 220);

  const prompt = buildPrompt({ context, publications, trials, demoMode });

  try {
    const llmStart = Date.now();
    const parsed = await callOllamaGenerate({
      endpoint,
      model,
      prompt,
      timeoutMs: primaryTimeout,
      numPredict: primaryNumPredict
    });

    const llmLatencyMs = Date.now() - llmStart;
    console.info("[llm]", JSON.stringify({ mode: "primary", model, demoMode, llmLatencyMs }));

    return {
      ...parsed,
      modelUsed: model,
      llm_latency_ms: llmLatencyMs,
      llm_fallback_used: false
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);

    if (shouldTryFallbackModels(errorMessage)) {
      const availableModels = await listAvailableModels(endpoint);
      const preferred = fallbackModelPreferences(model);
      const availableModelNames = new Set(availableModels.map((item) => item.name));

      const preferredAvailable = preferred.filter((name) => availableModelNames.has(name));
      const smallestAvailable = availableModels
        .map((item) => item.name)
        .filter((name) => name !== model)
        .slice(0, 2);

      const fallbackModels = [...new Set([...preferredAvailable, ...smallestAvailable])].slice(0, 1);

      for (const fallbackModel of fallbackModels) {
        try {
          const llmStart = Date.now();
          const parsed = await callOllamaGenerate({
            endpoint,
            model: fallbackModel,
            prompt,
            timeoutMs: fallbackTimeout,
            numPredict: fallbackNumPredict
          });

          const llmLatencyMs = Date.now() - llmStart;
          console.info("[llm]", JSON.stringify({ mode: "fallback-model", model: fallbackModel, demoMode, llmLatencyMs }));

          return {
            ...parsed,
            modelUsed: `${fallbackModel} (auto-fallback model)`,
            llm_latency_ms: llmLatencyMs,
            llm_fallback_used: true
          };
        } catch (_fallbackError) {
          // Try next model candidate.
        }
      }
    }

    console.warn("Falling back from LLM response", errorMessage);
    console.info("[llm]", JSON.stringify({ mode: "deterministic-fallback", model, demoMode, reason: errorMessage }));
    return {
      ...fallbackStructuredAnswer(context, publications, trials),
      modelUsed: `${model} (fallback)`,
      llm_fallback_used: true
    };
  }
}

module.exports = {
  generateStructuredAnswer
};
