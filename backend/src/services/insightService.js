const { tokenize } = require("../utils/text");

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function avg(values) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildConfidence({ context, publications, trials }) {
  const currentYear = new Date().getFullYear();
  const recentPublications = publications.filter((item) => item.year && item.year >= currentYear - 3).length;
  const recentRatio = publications.length ? recentPublications / publications.length : 0;

  const sourceTypes = new Set(publications.map((item) => item.source));
  if (trials.length) {
    sourceTypes.add("ClinicalTrials.gov");
  }

  const sourceDiversityScore = clamp(sourceTypes.size / 3, 0, 1);
  const sourceVolumeScore = clamp((publications.length + trials.length) / 12, 0, 1);

  const publicationAgreement = avg(publications.map((item) => Number(item.score_breakdown?.relevance || 0)));
  const trialAgreement = trials.length ? avg(trials.map((item) => Number(item.score_breakdown?.relevance || 0))) : publicationAgreement;
  const agreementScore = clamp((publicationAgreement + trialAgreement) / 2, 0, 1);

  const score = Math.round((sourceVolumeScore * 0.35 + recentRatio * 0.25 + agreementScore * 0.25 + sourceDiversityScore * 0.15) * 100);

  let level = "Low";
  if (score >= 75) {
    level = "High";
  } else if (score >= 50) {
    level = "Medium";
  }

  const reasoning = [
    `${recentPublications} recent studies (last 3 years) were found among top papers.`,
    `${trials.length} clinical trials and ${publications.length} ranked publications support the synthesis.`,
    `${sourceTypes.size} source types were used with relevance agreement score ${Math.round(agreementScore * 100)}%.`
  ];

  const diseaseTokenCount = tokenize(`${context.disease || ""} ${context.query || ""}`).length;
  if (diseaseTokenCount <= 1) {
    reasoning.push("Confidence may be lower when disease context is underspecified.");
  }

  return {
    score,
    level,
    reasoning
  };
}

function buildWhyThisAnswer({ retrieval, confidence }) {
  const paperScores = retrieval.topPublications.map((item) => item.score);
  const minScore = paperScores.length ? Math.min(...paperScores).toFixed(3) : "n/a";
  const maxScore = paperScores.length ? Math.max(...paperScores).toFixed(3) : "n/a";

  return {
    sources_used: [
      `${retrieval.retrievalStats.total_papers_fetched} papers fetched, ${retrieval.retrievalStats.final_papers} retained after ranking.`,
      `${retrieval.retrievalStats.total_trials_fetched} trials fetched, ${retrieval.retrievalStats.final_trials} retained after ranking.`
    ],
    reasoning_approach: [
      "Expanded query terms were used for broad retrieval from PubMed, OpenAlex, and ClinicalTrials.gov.",
      "Evidence was scored by relevance, recency, citation impact, and trial status.",
      "Only top-ranked evidence was passed to the LLM to reduce hallucination risk."
    ],
    ranking_influence: [
      `Top paper score range: ${minScore} to ${maxScore}.`,
      `Confidence level is ${confidence.level} based on evidence volume, recency, and cross-source agreement.`
    ]
  };
}

function buildSuggestedQuestions(context) {
  const diseaseLabel = context.disease || "this condition";
  const locationLabel = context.location || "my area";
  const intentLabel = context.intent || "the current strategy";

  const suggestions = [
    `What are common side effects of ${intentLabel} for ${diseaseLabel}?`,
    `What alternative therapies should we compare with ${intentLabel}?`,
    `Which trial eligibility criteria matter most for ${diseaseLabel}?`,
    `Are there recruiting trials for ${diseaseLabel} near ${locationLabel}?`,
    `What updated guidelines from the last 2 years affect ${diseaseLabel} care?`
  ];

  return [...new Set(suggestions)].slice(0, 5);
}

module.exports = {
  buildConfidence,
  buildWhyThisAnswer,
  buildSuggestedQuestions
};
