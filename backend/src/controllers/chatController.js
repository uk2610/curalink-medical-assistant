const Conversation = require("../models/Conversation");
const { retrieveAndRankEvidence } = require("../services/retrievalService");
const { generateStructuredAnswer } = require("../services/llmService");
const { buildConfidence, buildWhyThisAnswer, buildSuggestedQuestions } = require("../services/insightService");

async function resolveConversation(conversationId) {
  if (!conversationId) {
    return new Conversation();
  }

  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    const error = new Error("Conversation not found");
    error.status = 404;
    throw error;
  }

  return conversation;
}

function buildContextFromRequest(conversation, body) {
  const patientName = body.patientName || conversation.patientName || "";
  const disease = body.disease || conversation.diseaseContext || "";
  const intent = body.intent || conversation.intentContext || "";
  const location = body.location || conversation.locationContext || "";
  const query = body.query || [body.disease, body.intent].filter(Boolean).join(" ") || "";

  if (!query) {
    const error = new Error("query is required");
    error.status = 400;
    throw error;
  }

  return {
    patientName,
    disease,
    intent,
    location,
    query
  };
}

function buildSources(publications, trials) {
  return [
    ...publications.map((item) => ({
      id: item.id,
      type: "publication",
      title: item.title,
      source: item.source,
      url: item.url,
      score: item.score,
      year: item.year,
      citationCount: item.citation_count ?? item.citationCount ?? null
    })),
    ...trials.map((item) => ({
      id: item.id,
      type: "clinical_trial",
      title: item.title,
      source: item.source,
      url: item.url,
      score: item.score,
      status: item.status,
      location: item.location
    }))
  ];
}

function sanitizePublication(publication) {
  const authorList = publication.authors || [];

  return {
    id: publication.id,
    title: publication.title,
    authors: authorList.join(", ") || "Authors unavailable",
    authors_list: authorList,
    year: publication.year || null,
    source: publication.source,
    url: publication.url,
    snippet: publication.supportingSnippet || publication.summary || "",
    score: publication.score,
    citation_count: publication.citationCount ?? null,
    doi: publication.doi || null,
    explanation: publication.explanation || [],
    why_selected: publication.explanation || []
  };
}

function sanitizeTrial(trial) {
  const contactValue = trial.contact?.email || trial.contact?.phone || trial.contact?.name || "Contact unavailable";

  return {
    id: trial.id,
    title: trial.title,
    status: trial.status,
    eligibility: trial.eligibility,
    location: trial.location,
    contact: contactValue,
    startDate: trial.startDate || null,
    source: trial.source,
    url: trial.url,
    score: trial.score,
    supportingSnippet: trial.supportingSnippet,
    explanation: trial.explanation || []
  };
}

function buildResponse({ conversation, context, retrieval, structuredAnswer, confidence, whyThisAnswer, suggestedQuestions, llmMs, requestMs }) {
  const researchPapers = retrieval.topPublications.map(sanitizePublication);
  const clinicalTrials = retrieval.topTrials.map(sanitizeTrial);
  const sources = buildSources(researchPapers, clinicalTrials);

  const retrievalStats = retrieval.retrievalStats || {
    total_papers_fetched: retrieval.candidates.publications.length,
    total_trials_fetched: retrieval.candidates.clinicalTrials.length,
    final_papers: researchPapers.length,
    final_trials: clinicalTrials.length,
    publication_candidates: retrieval.candidates.publications.length,
    trial_candidates: retrieval.candidates.clinicalTrials.length
  };

  const warnings = [];
  if (retrieval.failedSources?.openAlex) {
    warnings.push("OpenAlex retrieval failed; response used remaining sources.");
  }
  if (retrieval.failedSources?.pubmed) {
    warnings.push("PubMed retrieval failed; response used remaining sources.");
  }
  if (retrieval.failedSources?.clinicalTrials) {
    warnings.push("ClinicalTrials retrieval failed; response used remaining sources.");
  }

  return {
    conversationId: conversation._id,
    overview: structuredAnswer.overview,
    research_insights: structuredAnswer.researchInsights,
    clinical_trial_insights: structuredAnswer.clinicalTrialInsights,
    personalized_insight: structuredAnswer.personalizedInsight,
    source_attribution: structuredAnswer.sourceAttribution,
    research_papers: researchPapers,
    clinical_trials: clinicalTrials,
    sources,
    model_used: structuredAnswer.modelUsed,
    context_used: context,
    expanded_queries: retrieval.expandedQueries,
    query_logic: retrieval.queryLogic,
    confidence,
    why_this_answer: whyThisAnswer,
    suggested_questions: suggestedQuestions,
    demo_mode: retrieval.demoMode || false,
    warnings,
    retrieval_stats: {
      ...retrievalStats,
      source_breakdown: retrieval.sourceBreakdown
    },
    performance: {
      retrieval_ms: retrieval.timings?.retrievalMs,
      ranking_ms: retrieval.timings?.rankingMs,
      llm_ms: llmMs,
      total_ms: requestMs,
      cache: retrieval.cache
    }
  };
}

async function queryResearchAssistant(req, res, next) {
  const requestStart = Date.now();
  try {
    const { conversationId } = req.body;
    const conversation = await resolveConversation(conversationId);
    const context = buildContextFromRequest(conversation, req.body);

    const retrieval = await retrieveAndRankEvidence(context);

    const llmStart = Date.now();

    const structuredAnswer = await generateStructuredAnswer({
      context,
      publications: retrieval.topPublications,
      trials: retrieval.topTrials
    });
    const llmMs = Date.now() - llmStart;

    const confidence = buildConfidence({
      context,
      publications: retrieval.topPublications,
      trials: retrieval.topTrials
    });

    const whyThisAnswer = buildWhyThisAnswer({ retrieval, confidence });
    const suggestedQuestions = buildSuggestedQuestions(context);

    conversation.patientName = context.patientName || conversation.patientName;
    conversation.diseaseContext = context.disease || conversation.diseaseContext;
    conversation.intentContext = context.intent || conversation.intentContext;
    conversation.locationContext = context.location || conversation.locationContext;

    conversation.messages.push({
      role: "user",
      content: context.query,
      structuredInput: {
        patientName: context.patientName,
        disease: context.disease,
        intent: context.intent,
        location: context.location
      }
    });

    conversation.messages.push({
      role: "assistant",
      content: JSON.stringify({
        overview: structuredAnswer.overview,
        researchInsights: structuredAnswer.researchInsights,
        clinicalTrialInsights: structuredAnswer.clinicalTrialInsights,
        personalizedInsight: structuredAnswer.personalizedInsight,
        sourceAttribution: structuredAnswer.sourceAttribution,
        confidence,
        suggestedQuestions,
        modelUsed: structuredAnswer.modelUsed
      })
    });

    await conversation.save();

    const requestMs = Date.now() - requestStart;
    const responsePayload = buildResponse({
      conversation,
      context,
      retrieval,
      structuredAnswer,
      confidence,
      whyThisAnswer,
      suggestedQuestions,
      llmMs,
      requestMs
    });

    console.info(
      "[research.request]",
      JSON.stringify({
        requestMs,
        retrievalMs: retrieval.timings?.retrievalMs,
        rankingMs: retrieval.timings?.rankingMs,
        llmMs,
        total_papers_fetched: responsePayload.retrieval_stats.total_papers_fetched,
        total_trials_fetched: responsePayload.retrieval_stats.total_trials_fetched,
        final_papers: responsePayload.retrieval_stats.final_papers,
        final_trials: responsePayload.retrieval_stats.final_trials,
        demoMode: responsePayload.demo_mode,
        modelUsed: responsePayload.model_used
      })
    );

    res.json(responsePayload);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  queryResearchAssistant
};
