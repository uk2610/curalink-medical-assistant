const { buildExpandedQueries } = require("./queryExpansionService");
const { fetchOpenAlexCandidates } = require("./openAlexService");
const { fetchPubMedCandidates } = require("./pubmedService");
const { fetchClinicalTrialCandidates } = require("./clinicalTrialsService");
const { rankPublications, rankClinicalTrials } = require("./rankingService");
const { normalizeText } = require("../utils/text");
const { createTtlCache } = require("../utils/cache");

const retrievalCache = createTtlCache({
  name: "retrieval",
  defaultTtlMs: Number(process.env.RETRIEVAL_CACHE_TTL_MS || 8 * 60 * 1000),
  maxEntries: Number(process.env.RETRIEVAL_CACHE_MAX_ENTRIES || 220)
});

function isDemoMode() {
  return String(process.env.DEMO_MODE || "false").trim().toLowerCase() === "true";
}

function withDemoLimit(value, demoLimit, demoMode) {
  return demoMode ? Math.min(value, demoLimit) : value;
}

function buildContextCacheKey(context) {
  return normalizeText([context.patientName, context.disease, context.intent, context.location, context.query].filter(Boolean).join(" | "));
}

function canonicalDoi(value) {
  if (!value) {
    return "";
  }

  return String(value).toLowerCase().replace(/^https?:\/\/doi\.org\//, "").trim();
}

function publicationKey(item) {
  const doi = canonicalDoi(item.doi);
  if (doi) {
    return `doi:${doi}`;
  }

  const titleKey = normalizeText(item.title || "");
  const year = item.year || "na";
  return `title:${titleKey}:${year}`;
}

function pickBestPublication(current, candidate) {
  const currentScore = Number(current.citationCount || 0) + (current.summary || "").length * 0.001;
  const candidateScore = Number(candidate.citationCount || 0) + (candidate.summary || "").length * 0.001;
  return candidateScore > currentScore ? candidate : current;
}

function dedupePublications(publications) {
  const map = new Map();

  for (const publication of publications) {
    const key = publicationKey(publication);
    if (!map.has(key)) {
      map.set(key, publication);
      continue;
    }

    map.set(key, pickBestPublication(map.get(key), publication));
  }

  return [...map.values()];
}

function dedupeTrials(trials) {
  const map = new Map();

  for (const trial of trials) {
    const key = trial.id || normalizeText(trial.title || trial.url || "");
    if (key && !map.has(key)) {
      map.set(key, trial);
    }
  }

  return [...map.values()];
}

function getValueOrDefault(result) {
  return result.status === "fulfilled" ? result.value : [];
}

async function retrieveAndRankEvidence(context) {
  const requestStart = Date.now();
  const demoMode = isDemoMode();
  const cacheKey = buildContextCacheKey(context);
  const cachedResult = retrievalCache.get(cacheKey, { allowStale: demoMode });

  if (cachedResult) {
    const totalMs = Date.now() - requestStart;
    console.info(
      "[retrieval]",
      JSON.stringify({
        cache: true,
        demoMode,
        totalMs,
        total_papers_fetched: cachedResult.retrievalStats.total_papers_fetched,
        total_trials_fetched: cachedResult.retrievalStats.total_trials_fetched,
        final_papers: cachedResult.retrievalStats.final_papers,
        final_trials: cachedResult.retrievalStats.final_trials
      })
    );

    return {
      ...cachedResult,
      cache: {
        used: true,
        ...retrievalCache.stats()
      },
      timings: {
        ...(cachedResult.timings || {}),
        totalMs
      }
    };
  }

  const expandedQueries = buildExpandedQueries(context);
  const openAlexLimit = withDemoLimit(Number(process.env.OPENALEX_CANDIDATE_LIMIT || 100), 40, demoMode);
  const pubMedLimit = withDemoLimit(Number(process.env.PUBMED_CANDIDATE_LIMIT || 100), 40, demoMode);
  const trialsLimit = withDemoLimit(Number(process.env.CLINICAL_TRIAL_LIMIT || 50), 20, demoMode);

  const retrievalStart = Date.now();

  const [openAlexResult, pubMedResult, trialResult] = await Promise.allSettled([
    fetchOpenAlexCandidates(expandedQueries, openAlexLimit),
    fetchPubMedCandidates(expandedQueries, pubMedLimit),
    fetchClinicalTrialCandidates(context, trialsLimit)
  ]);

  const retrievalMs = Date.now() - retrievalStart;

  if (openAlexResult.status === "rejected") {
    console.warn("OpenAlex retrieval failed", openAlexResult.reason?.message || openAlexResult.reason);
  }

  if (pubMedResult.status === "rejected") {
    console.warn("PubMed retrieval failed", pubMedResult.reason?.message || pubMedResult.reason);
  }

  if (trialResult.status === "rejected") {
    console.warn("ClinicalTrials retrieval failed", trialResult.reason?.message || trialResult.reason);
  }

  const openAlexCandidates = getValueOrDefault(openAlexResult);
  const pubMedCandidates = getValueOrDefault(pubMedResult);
  const rawTrials = getValueOrDefault(trialResult);

  const rankingStart = Date.now();
  const allPublications = dedupePublications([...openAlexCandidates, ...pubMedCandidates]);
  const trialCandidates = dedupeTrials(rawTrials);
  const topPublications = rankPublications(
    allPublications,
    context,
    withDemoLimit(Number(process.env.TOP_PUBLICATION_LIMIT || 8), 6, demoMode)
  );
  const topTrials = rankClinicalTrials(trialCandidates, context, withDemoLimit(Number(process.env.TOP_TRIAL_LIMIT || 6), 4, demoMode));
  const rankingMs = Date.now() - rankingStart;

  const retrievalStats = {
    total_papers_fetched: allPublications.length,
    total_trials_fetched: trialCandidates.length,
    final_papers: topPublications.length,
    final_trials: topTrials.length,
    publication_candidates: allPublications.length,
    trial_candidates: trialCandidates.length
  };

  const failedSources = {
    openAlex: openAlexResult.status === "rejected",
    pubmed: pubMedResult.status === "rejected",
    clinicalTrials: trialResult.status === "rejected"
  };

  const payload = {
    expandedQueries,
    queryLogic: expandedQueries.join(" AND "),
    candidates: {
      publications: allPublications,
      clinicalTrials: trialCandidates
    },
    sourceBreakdown: {
      openAlex: openAlexCandidates.length,
      pubmed: pubMedCandidates.length,
      clinicalTrials: trialCandidates.length
    },
    retrievalStats,
    topPublications,
    topTrials,
    failedSources,
    demoMode,
    timings: {
      retrievalMs,
      rankingMs,
      totalMs: Date.now() - requestStart
    }
  };

  retrievalCache.set(cacheKey, payload, demoMode ? Number(process.env.RETRIEVAL_CACHE_DEMO_TTL_MS || 20 * 60 * 1000) : undefined);

  console.info(
    "[retrieval]",
    JSON.stringify({
      cache: false,
      demoMode,
      retrievalMs,
      rankingMs,
      totalMs: payload.timings.totalMs,
      total_papers_fetched: retrievalStats.total_papers_fetched,
      total_trials_fetched: retrievalStats.total_trials_fetched,
      final_papers: retrievalStats.final_papers,
      final_trials: retrievalStats.final_trials,
      failedSources
    })
  );

  return {
    ...payload,
    cache: {
      used: false,
      ...retrievalCache.stats()
    }
  };
}

module.exports = {
  retrieveAndRankEvidence
};
