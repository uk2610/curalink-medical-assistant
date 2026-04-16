const { normalizeText, tokenize } = require("../utils/text");

function recencyScore(year) {
  if (!year) {
    return 0.2;
  }

  const current = new Date().getFullYear();
  const diff = Math.max(0, current - year);
  if (diff <= 1) {
    return 1;
  }
  if (diff <= 3) {
    return 0.8;
  }
  if (diff <= 6) {
    return 0.6;
  }
  if (diff <= 10) {
    return 0.4;
  }
  return 0.2;
}

function relevanceScore(text, tokens) {
  if (!text) {
    return 0;
  }

  const normalized = normalizeText(text);
  if (!normalized) {
    return 0;
  }

  let matched = 0;
  for (const token of tokens) {
    if (normalized.includes(token)) {
      matched += 1;
    }
  }

  return tokens.length ? matched / tokens.length : 0;
}

function citationScore(citationCount, maxCitation) {
  if (!citationCount || citationCount <= 0 || !maxCitation || maxCitation <= 0) {
    return 0;
  }

  const numerator = Math.log10(Number(citationCount) + 1);
  const denominator = Math.log10(Number(maxCitation) + 1);
  return denominator ? Math.min(1, numerator / denominator) : 0;
}

function buildPublicationExplanation({ relevance, recency, citations, sourceCredibility }) {
  const explanation = [];
  if (relevance >= 0.45) {
    explanation.push("Matches query");
  }
  if (recency >= 0.8) {
    explanation.push("Recent evidence");
  }
  if (citations >= 0.45) {
    explanation.push("High citations");
  }
  if (sourceCredibility >= 0.95) {
    explanation.push("Trusted source");
  }
  if (!explanation.length) {
    explanation.push("Relevant supporting evidence");
  }
  return explanation;
}

function buildTrialExplanation({ relevance, statusBoost, recency }) {
  const explanation = [];
  if (relevance >= 0.4) {
    explanation.push("Matches query");
  }
  if (statusBoost >= 0.85) {
    explanation.push("Recruiting or active status");
  }
  if (recency >= 0.7) {
    explanation.push("Recent trial activity");
  }
  if (!explanation.length) {
    explanation.push("Potentially relevant trial");
  }
  return explanation;
}

function scorePublication(item, contextTokens, maxCitation) {
  const relevance = relevanceScore(`${item.title} ${item.summary}`, contextTokens);
  const recency = recencyScore(item.year);
  const citations = citationScore(item.citationCount, maxCitation);
  const sourceCredibility = item.source === "PubMed" ? 1 : 0.85;

  return {
    total: relevance * 0.5 + recency * 0.2 + citations * 0.2 + sourceCredibility * 0.1,
    relevance,
    recency,
    citations,
    sourceCredibility,
    explanation: buildPublicationExplanation({ relevance, recency, citations, sourceCredibility })
  };
}

function rankPublications(publications, context, topN = 8) {
  const contextTokens = tokenize([context.query, context.disease, context.intent].filter(Boolean).join(" "));
  const maxCitation = publications.reduce((max, item) => {
    const value = Number(item.citationCount || 0);
    return value > max ? value : max;
  }, 0);

  return publications
    .map((item) => {
      const scoring = scorePublication(item, contextTokens, maxCitation);
      return {
        ...item,
        score: Number(scoring.total.toFixed(4)),
        score_breakdown: {
          relevance: Number(scoring.relevance.toFixed(4)),
          recency: Number(scoring.recency.toFixed(4)),
          citations: Number(scoring.citations.toFixed(4)),
          source_credibility: Number(scoring.sourceCredibility.toFixed(4))
        },
        explanation: scoring.explanation,
        supportingSnippet: item.summary || item.title
      };
    })
    .filter((item) => item.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

function scoreTrial(item, contextTokens) {
  const relevance = relevanceScore(`${item.title} ${item.eligibility}`, contextTokens);
  const statusBoost = item.status === "RECRUITING" ? 1 : item.status === "ACTIVE_NOT_RECRUITING" ? 0.85 : 0.55;
  const dateYear = item.startDate ? Number(String(item.startDate).slice(0, 4)) : null;
  const recency = recencyScore(dateYear);

  return {
    total: relevance * 0.6 + statusBoost * 0.25 + recency * 0.15,
    relevance,
    statusBoost,
    recency,
    explanation: buildTrialExplanation({ relevance, statusBoost, recency })
  };
}

function rankClinicalTrials(trials, context, topN = 6) {
  const contextTokens = tokenize([context.query, context.disease, context.intent, context.location].filter(Boolean).join(" "));

  return trials
    .map((trial) => {
      const scoring = scoreTrial(trial, contextTokens);
      return {
        ...trial,
        score: Number(scoring.total.toFixed(4)),
        score_breakdown: {
          relevance: Number(scoring.relevance.toFixed(4)),
          recency: Number(scoring.recency.toFixed(4)),
          status: Number(scoring.statusBoost.toFixed(4))
        },
        explanation: scoring.explanation,
        supportingSnippet: trial.eligibility || trial.title
      };
    })
    .filter((trial) => trial.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

module.exports = {
  rankPublications,
  rankClinicalTrials
};
