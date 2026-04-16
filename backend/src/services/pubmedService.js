const axios = require("axios");
const xml2js = require("xml2js");
const { clip } = require("../utils/text");
const { createTtlCache } = require("../utils/cache");

const SEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
const FETCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi";
const pubmedCache = createTtlCache({
  name: "pubmed",
  defaultTtlMs: Number(process.env.PUBMED_CACHE_TTL_MS || 15 * 60 * 1000),
  maxEntries: Number(process.env.PUBMED_CACHE_MAX_ENTRIES || 260)
});

function isDemoMode() {
  return String(process.env.DEMO_MODE || "false").toLowerCase() === "true";
}

function buildCacheKey(expandedQueries, maxResults) {
  return `${expandedQueries.slice(0, 4).join("||")}::${maxResults}`;
}

async function searchPubMedIds(query, retmax = 80) {
  const response = await axios.get(SEARCH_URL, {
    params: {
      db: "pubmed",
      term: query,
      retmax,
      sort: "pub+date",
      retmode: "json"
    },
    timeout: 20000
  });

  return response.data?.esearchresult?.idlist || [];
}

function findDoi(article) {
  const articleData = article?.MedlineCitation?.[0]?.Article?.[0] || {};
  const eLocation = articleData.ELocationID || [];

  for (const entry of eLocation) {
    if (entry?.$?.EIdType === "doi") {
      return typeof entry === "string" ? entry : entry?._;
    }
  }

  const articleIdList = article?.PubmedData?.[0]?.ArticleIdList?.[0]?.ArticleId || [];
  for (const entry of articleIdList) {
    if (entry?.$?.IdType === "doi") {
      return typeof entry === "string" ? entry : entry?._;
    }
  }

  return null;
}

function parsePubmedArticles(parsedXml) {
  const articles = parsedXml?.PubmedArticleSet?.PubmedArticle || [];

  return articles.map((article) => {
    const medline = article.MedlineCitation?.[0];
    const articleData = medline?.Article?.[0] || {};
    const title = articleData.ArticleTitle?.[0] || "Untitled";

    const abstractParts = articleData.Abstract?.[0]?.AbstractText || [];
    const summary = clip(
      abstractParts
        .map((part) => (typeof part === "string" ? part : part?._ || ""))
        .join(" ")
    );

    const authors = (articleData.AuthorList?.[0]?.Author || [])
      .map((author) => {
        const last = author.LastName?.[0];
        const first = author.ForeName?.[0];
        if (!last) {
          return null;
        }
        return first ? `${first} ${last}` : last;
      })
      .filter(Boolean)
      .slice(0, 8);

    const pubDate = articleData.Journal?.[0]?.JournalIssue?.[0]?.PubDate?.[0] || {};
    const year = Number(pubDate.Year?.[0]) || null;

    const pmid = medline?.PMID?.[0]?._ || medline?.PMID?.[0] || null;
    const doi = findDoi(article);

    return {
      id: pmid,
      doi,
      title,
      summary,
      authors,
      year,
      citationCount: null,
      source: "PubMed",
      url: pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : "https://pubmed.ncbi.nlm.nih.gov/",
      raw: article
    };
  });
}

async function fetchPubMedCandidates(expandedQueries, maxResults = 120) {
  const cacheKey = buildCacheKey(expandedQueries, maxResults);
  const demoMode = isDemoMode();
  const cached = pubmedCache.get(cacheKey, { allowStale: demoMode });
  if (cached) {
    return cached;
  }

  const ids = [];

  for (const query of expandedQueries.slice(0, 4)) {
    try {
      const found = await searchPubMedIds(query, Math.min(maxResults, 100));
      ids.push(...found);
      if (ids.length >= maxResults) {
        break;
      }
    } catch (error) {
      console.warn(`PubMed search failed for query: ${query}`, error.message);
    }
  }

  const uniqueIds = [...new Set(ids)].slice(0, maxResults);
  if (!uniqueIds.length) {
    return [];
  }

  const batchSize = 40;
  const parsed = [];

  for (let i = 0; i < uniqueIds.length; i += batchSize) {
    const idBatch = uniqueIds.slice(i, i + batchSize);
    try {
      const response = await axios.get(FETCH_URL, {
        params: {
          db: "pubmed",
          id: idBatch.join(","),
          retmode: "xml"
        },
        timeout: 30000
      });

      const xml = await xml2js.parseStringPromise(response.data, { explicitArray: true });
      parsed.push(...parsePubmedArticles(xml));
    } catch (error) {
      console.warn("PubMed fetch batch failed", error.message);
    }
  }

  pubmedCache.set(cacheKey, parsed, demoMode ? Number(process.env.PUBMED_CACHE_DEMO_TTL_MS || 30 * 60 * 1000) : undefined);
  return parsed;
}

module.exports = {
  fetchPubMedCandidates
};
