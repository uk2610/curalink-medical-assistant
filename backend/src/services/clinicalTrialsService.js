const axios = require("axios");
const { clip } = require("../utils/text");
const { createTtlCache } = require("../utils/cache");

const TRIALS_URL = "https://clinicaltrials.gov/api/v2/studies";
const DEFAULT_STATUS_FILTER = "RECRUITING,NOT_YET_RECRUITING,ACTIVE_NOT_RECRUITING,COMPLETED";
const clinicalTrialsCache = createTtlCache({
  name: "clinicalTrials",
  defaultTtlMs: Number(process.env.CLINICAL_TRIAL_CACHE_TTL_MS || 15 * 60 * 1000),
  maxEntries: Number(process.env.CLINICAL_TRIAL_CACHE_MAX_ENTRIES || 240)
});

function isDemoMode() {
  return String(process.env.DEMO_MODE || "false").toLowerCase() === "true";
}

function buildCacheKey({ disease, intent, query, location }, pageSize) {
  return `${[disease, intent, query, location].filter(Boolean).join("||")}::${pageSize}`;
}

function parseTrial(study) {
  const protocol = study.protocolSection || {};
  const id = protocol.identificationModule?.nctId;
  const title = protocol.identificationModule?.briefTitle || "Untitled trial";
  const status = protocol.statusModule?.overallStatus || "UNKNOWN";

  const eligibility = protocol.eligibilityModule?.eligibilityCriteria || "";
  const contacts = protocol.contactsLocationsModule?.centralContacts || [];
  const locations = protocol.contactsLocationsModule?.locations || [];

  const firstLocation = locations[0];
  const locationString = firstLocation
    ? [
        firstLocation.city,
        firstLocation.state,
        firstLocation.country
      ]
        .filter(Boolean)
        .join(", ")
    : "Location not listed";

  const contact = contacts[0]
    ? {
        name: contacts[0].name,
        phone: contacts[0].phone,
        email: contacts[0].email
      }
    : null;

  const startDate = protocol.statusModule?.startDateStruct?.date;

  return {
    id,
    title,
    status,
    eligibility: clip(eligibility, 500),
    location: locationString,
    contact,
    startDate,
    source: "ClinicalTrials.gov",
    url: id ? `https://clinicaltrials.gov/study/${id}` : "https://clinicaltrials.gov/",
    raw: study
  };
}

function inferConditionTerm(disease, query) {
  if (disease && disease.trim()) {
    return disease.trim();
  }

  const candidate = String(query || "")
    .toLowerCase()
    .replace(/latest|recent|top|treatment|treatments|study|studies|clinical|trial|trials|researchers|research|for|in|on|about|the|of/gi, " ")
    .replace(/[^a-z0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!candidate) {
    return "";
  }

  return candidate.split(" ").slice(0, 5).join(" ");
}

async function fetchTrialsPage({ condTerm, queryTerms, pageSize, pageToken }) {
  const statusFilter = process.env.CLINICAL_TRIAL_STATUS_FILTER || DEFAULT_STATUS_FILTER;
  const params = {
    "query.term": queryTerms,
    "filter.overallStatus": statusFilter,
    pageSize,
    pageToken,
    format: "json"
  };

  if (condTerm) {
    params["query.cond"] = condTerm;
  }

  return axios.get(TRIALS_URL, {
    params,
    timeout: 30000
  });
}

async function fetchClinicalTrialCandidates({ disease, intent, query, location }, pageSize = 100) {
  const cacheKey = buildCacheKey({ disease, intent, query, location }, pageSize);
  const demoMode = isDemoMode();
  const cached = clinicalTrialsCache.get(cacheKey, { allowStale: demoMode });
  if (cached) {
    return cached;
  }

  const queryTerms = [disease, intent, query, location].filter(Boolean).join(" ").trim();
  if (!queryTerms) {
    return [];
  }

  const condTerm = inferConditionTerm(disease, query);
  const maxPageSize = Math.min(pageSize, 100);
  const parsed = [];

  async function collectPages(conditionValue) {
    let nextPageToken;

    do {
      const response = await fetchTrialsPage({
        condTerm: conditionValue,
        queryTerms,
        pageSize: maxPageSize,
        pageToken: nextPageToken
      });

      const studies = response.data?.studies || [];
      parsed.push(...studies.map(parseTrial));
      nextPageToken = response.data?.nextPageToken;
    } while (nextPageToken && parsed.length < pageSize);
  }

  await collectPages(condTerm);

  // If strict condition matching produced nothing, retry broad keyword search.
  if (!parsed.length && condTerm) {
    await collectPages("");
  }

  const unique = new Map();
  parsed.forEach((trial) => {
    if (trial.id && !unique.has(trial.id)) {
      unique.set(trial.id, trial);
    }
  });

  const result = [...unique.values()].slice(0, pageSize);
  clinicalTrialsCache.set(cacheKey, result, demoMode ? Number(process.env.CLINICAL_TRIAL_CACHE_DEMO_TTL_MS || 30 * 60 * 1000) : undefined);
  return result;
}

module.exports = {
  fetchClinicalTrialCandidates
};
