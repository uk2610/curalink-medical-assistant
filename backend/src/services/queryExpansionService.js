const { unique, normalizeText } = require("../utils/text");

function hasAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function buildExpandedQueries({ disease, intent, query, location }) {
  const safeDisease = (disease || "").trim();
  const safeIntent = (intent || "").trim();
  const safeQuery = (query || "").trim();
  const safeLocation = (location || "").trim();

  const base = safeQuery || `${safeDisease} ${safeIntent}`.trim() || safeDisease || safeIntent || "medical research";
  const intentNorm = normalizeText(safeIntent || safeQuery);

  const expansions = [
    base,
    `${base} evidence summary`,
    `${base} systematic review`,
    `${base} clinical guideline`
  ];

  if (safeDisease) {
    expansions.push(`${safeDisease} latest treatment options`);
    expansions.push(`${safeDisease} standard of care`);
    expansions.push(`${safeDisease} phase 2 phase 3 trial`);
    expansions.push(`${safeDisease} new therapy outcomes`);
  }

  if (safeIntent) {
    expansions.push(`${safeIntent} ${safeDisease}`.trim());
    expansions.push(`${safeIntent} efficacy safety comparison`);
  }

  if (hasAny(intentNorm, ["trial", "study", "recruit", "intervention"])) {
    expansions.push(`${safeDisease || base} recruiting clinical trials`);
    expansions.push(`${safeDisease || base} eligibility criteria trial`);
  }

  if (hasAny(intentNorm, ["treat", "therapy", "drug", "medication"])) {
    expansions.push(`${safeDisease || base} treatment efficacy meta analysis`);
    expansions.push(`${safeDisease || base} adverse events comparative`);
  }

  if (safeLocation) {
    expansions.push(`${safeDisease || base} trial ${safeLocation}`);
    expansions.push(`${safeDisease || base} care guideline ${safeLocation}`);
  }

  return unique(expansions.map((value) => value.trim()).filter((value) => value.length > 4)).slice(0, 12);
}

module.exports = {
  buildExpandedQueries
};
