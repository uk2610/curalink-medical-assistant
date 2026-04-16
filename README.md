# Curalink - AI Medical Research Assistant (MERN)

A full-stack MERN prototype that retrieves and ranks evidence from:
- OpenAlex
- PubMed (NCBI eUtils)
- ClinicalTrials.gov

Then uses an open-source local LLM (Ollama) to generate structured, source-backed responses.

## Architecture

- Frontend: React + Vite + TailwindCSS chat/research UI
- Backend: Node.js + Express
- DB: MongoDB (conversation memory and follow-up context)
- LLM: Ollama (local, open-source model)

## Retrieval + Ranking Pipeline

1. Parse structured + natural user input
2. Expand query context-aware (query + disease + intent + location)
3. Deep retrieval:
   - OpenAlex candidates: up to 100
   - PubMed candidates: up to 100
   - Clinical trials candidates: up to 50
4. Rank candidates by:
   - Query relevance
   - Recency
   - Citation count (when available)
5. Keep top evidence:
   - Top publications: 8
   - Top trials: 6
6. Generate structured answer via Ollama with strict JSON prompt

## API Contract

### POST /api/research

Request body:

```json
{
   "disease": "string",
   "intent": "string",
   "query": "string",
   "location": "string",
   "conversationId": "optional"
}
```

Response body:

```json
{
   "overview": "string",
   "research_papers": [],
   "clinical_trials": [],
   "sources": []
}
```

Additional metadata is returned for UI and debugging (`research_insights`, `clinical_trial_insights`, `personalized_insight`, `source_attribution`, `retrieval_stats`, `expanded_queries`, `query_logic`, `confidence`, `why_this_answer`, `suggested_questions`, `performance`, `demo_mode`, `model_used`).

## Conversation Memory

The backend stores:
- Patient name
- Disease context
- Intent/location context
- Message history

Follow-up questions can reuse `conversationId` and inherit context.

## Setup

## 1) Prerequisites
- Node.js 18+
- MongoDB running locally or cloud URI
- Ollama installed and running
- Pulled model (example):

```bash
ollama pull llama3.1:8b
```

## 2) Backend environment

Create `.env` in `backend` from `.env.example` and update values:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/curalink
CORS_ORIGIN=http://localhost:5173
DEMO_MODE=false
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
OLLAMA_FALLBACK_MODELS=mistral:7b,llama3.2:3b,tinyllama
OLLAMA_TIMEOUT_MS=90000
OLLAMA_NUM_PREDICT=420
OLLAMA_FALLBACK_TIMEOUT_MS=30000
OLLAMA_FALLBACK_NUM_PREDICT=220
OPENALEX_CANDIDATE_LIMIT=100
PUBMED_CANDIDATE_LIMIT=100
CLINICAL_TRIAL_LIMIT=50
CLINICAL_TRIAL_STATUS_FILTER=RECRUITING,NOT_YET_RECRUITING,ACTIVE_NOT_RECRUITING,COMPLETED
TOP_PUBLICATION_LIMIT=8
TOP_TRIAL_LIMIT=6
RETRIEVAL_CACHE_TTL_MS=480000
RETRIEVAL_CACHE_DEMO_TTL_MS=1200000
RETRIEVAL_CACHE_MAX_ENTRIES=220
OPENALEX_CACHE_TTL_MS=900000
OPENALEX_CACHE_DEMO_TTL_MS=1800000
OPENALEX_CACHE_MAX_ENTRIES=260
PUBMED_CACHE_TTL_MS=900000
PUBMED_CACHE_DEMO_TTL_MS=1800000
PUBMED_CACHE_MAX_ENTRIES=260
CLINICAL_TRIAL_CACHE_TTL_MS=900000
CLINICAL_TRIAL_CACHE_DEMO_TTL_MS=1800000
CLINICAL_TRIAL_CACHE_MAX_ENTRIES=240
```

## 3) Frontend environment

Create `.env` in `frontend` from `.env.example`:

```env
VITE_API_BASE_URL=http://localhost:5000
```

## 4) Run

From project root:

```bash
npm run dev:backend
```

In a second terminal:

```bash
npm run dev:frontend
```

## Demo Queries

- Latest treatment for lung cancer
- Clinical trials for diabetes
- Top researchers in Alzheimer's disease
- Recent studies on heart disease

## Hackathon Notes

- Uses only open-source/local LLM serving via Ollama (no OpenAI/Gemini APIs)
- Performs depth-first retrieval before precision ranking
- Returns structured sections with source attribution
- Includes conversation continuity for follow-up intelligence
- Includes confidence scoring, ranking explainability, and suggested follow-up questions
- Supports demo-safe mode (`DEMO_MODE=true`) with reduced retrieval breadth, aggressive caching, and 8-10s LLM timeout guardrails

## Disclaimer

This application is for research support only and does not provide medical diagnosis or treatment advice.
