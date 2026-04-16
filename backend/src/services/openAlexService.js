const axios = require("axios");
const { clip } = require("../utils/text");
const { createTtlCache } = require("../utils/cache");

const OPEN_ALEX_URL = "https://api.openalex.org/works";
const openAlexCache = createTtlCache({
  name: "openalex",
  defaultTtlMs: Number(process.env.OPENALEX_CACHE_TTL_MS || 15 * 60 * 1000),
  maxEntries: Number(process.env.OPENALEX_CACHE_MAX_ENTRIES || 260)
});

function isDemoMode() {
  return String(process.env.DEMO_MODE || "false").toLowerCase() === "true";
}

function buildCacheKey(expandedQueries, maxResults) {
  return `${expandedQueries.slice(0, 4).join("||")}::${maxResults}`;
}

function parseOpenAlexWork(work) {
  const authors = (work.authorships || [])
    .slice(0, 6)
    .map((authorShip) => authorShip?.author?.display_name)
    .filter(Boolean);

  const summary = work.abstract_inverted_index
    ? Object.entries(work.abstract_inverted_index)
        .flatMap(([word, indexes]) => indexes.map((index) => [index, word]))
        .sort((a, b) => a[0] - b[0])
        .map((entry) => entry[1])
        .join(" ")
    : "";

  return {
    id: work.id,
    doi: work.doi ? String(work.doi).replace("https://doi.org/", "") : null,
    title: work.display_name || "Untitled",
    summary: clip(summary || work.title || "", 420),
    authors,
    year: work.publication_year || null,
    citationCount: Number(work.cited_by_count || 0),
    source: "OpenAlex",
    url: work.primary_location?.landing_page_url || work.id,
    raw: work
  };
}

async function fetchOpenAlexCandidates(expandedQueries, maxResults = 120) {
  const cacheKey = buildCacheKey(expandedQueries, maxResults);
  const demoMode = isDemoMode();
  const cached = openAlexCache.get(cacheKey, { allowStale: demoMode });
  if (cached) {
    return cached;
  }

  const perPage = 50;
  const pages = Math.max(1, Math.ceil(maxResults / perPage));
  const all = [];

  for (const query of expandedQueries.slice(0, 4)) {
    for (let page = 1; page <= pages; page += 1) {
      try {
        const response = await axios.get(OPEN_ALEX_URL, {
          params: {
            search: query,
            "per-page": perPage,
            page,
            sort: "relevance_score:desc"
          },
          timeout: 20000
        });

        const works = response.data?.results || [];
        all.push(...works.map(parseOpenAlexWork));

        if (works.length < perPage || all.length >= maxResults) {
          break;
        }
      } catch (error) {
        console.warn(`OpenAlex request failed for query: ${query} page: ${page}`, error.message);
        break;
      }
    }

    if (all.length >= maxResults) {
      break;
    }
  }

  const seen = new Set();
  const deduped = all.filter((item) => {
    const key = item.doi || item.id;
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  openAlexCache.set(cacheKey, deduped, demoMode ? Number(process.env.OPENALEX_CACHE_DEMO_TTL_MS || 30 * 60 * 1000) : undefined);
  return deduped;
}

module.exports = {
  fetchOpenAlexCandidates
};
