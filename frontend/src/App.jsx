import { useEffect, useMemo, useState } from "react";
import ResearchComposer from "./components/ResearchComposer";
import ResearchResponseCard from "./components/ResearchResponseCard";
import JudgeViewPanel from "./components/JudgeViewPanel";
import { submitResearchQuery } from "./services/researchApi";

const initialForm = {
  patientName: "",
  disease: "",
  intent: "",
  location: "",
  query: ""
};

const PIPELINE_STAGES = ["Query Expanded", "Research Retrieved (papers • trials)", "Evidence Ranked", "AI Response Generated"];

function App() {
  const initialJudgeView = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("judge") === "1" : false;

  const [form, setForm] = useState(initialForm);
  const [conversationId, setConversationId] = useState("");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pipelineStages, setPipelineStages] = useState(PIPELINE_STAGES);
  const [pipelineStageIndex, setPipelineStageIndex] = useState(0);
  const [pipelineCompleted, setPipelineCompleted] = useState(false);
  const [judgeView, setJudgeView] = useState(initialJudgeView);
  const [error, setError] = useState("");

  const canSubmit = useMemo(() => form.query.trim().length > 2 && !loading, [form.query, loading]);

  const onChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    setError("");
    setPipelineStages(PIPELINE_STAGES);
    setPipelineStageIndex(0);
    setPipelineCompleted(false);
    setLoading(true);

    try {
      const payload = {
        ...form,
        conversationId: conversationId || undefined
      };

      const data = await submitResearchQuery(payload);
      const stats = data.retrieval_stats || {};
      const paperCount = stats.total_papers_fetched || stats.publication_candidates || 0;
      const trialCount = stats.total_trials_fetched || stats.trial_candidates || 0;

      setPipelineStages([
        "Query Expanded",
        `Research Retrieved (${paperCount} papers • ${trialCount} trials)`,
        "Evidence Ranked",
        "AI Response Generated"
      ]);

      setPipelineStageIndex(PIPELINE_STAGES.length - 1);
      setPipelineCompleted(true);

      setConversationId(data.conversationId);
      setHistory((current) => [...current, { request: payload, response: data }]);
      setForm((current) => ({ ...current, query: "" }));
    } catch (requestError) {
      setError(requestError.response?.data?.error || "Failed to fetch medical insights.");
      setPipelineCompleted(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!loading) {
      return undefined;
    }

    const interval = setInterval(() => {
      setPipelineStageIndex((current) => {
        if (current >= PIPELINE_STAGES.length - 2) {
          return current;
        }
        return current + 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [loading]);

  const onSuggestion = (value) => {
    setForm((current) => ({ ...current, query: value }));
  };

  const onFollowUpSelect = (value) => {
    setForm((current) => ({ ...current, query: value }));
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const latestInteraction = history.length ? history[history.length - 1] : null;

  const toggleJudgeView = () => {
    setJudgeView((current) => {
      const next = !current;
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        if (next) {
          url.searchParams.set("judge", "1");
        } else {
          url.searchParams.delete("judge");
        }
        window.history.replaceState({}, "", url.toString());
      }
      return next;
    });
  };

  return (
    <main className="relative min-h-screen overflow-hidden text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-28 top-[-12rem] h-96 w-96 rounded-full bg-mint-500/25 blur-3xl" />
        <div className="absolute -right-20 top-16 h-80 w-80 rounded-full bg-sky-400/15 blur-3xl" />
        <div className="absolute bottom-[-9rem] left-1/4 h-72 w-72 rounded-full bg-amber-400/15 blur-3xl" />
      </div>

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 md:px-6 md:py-10">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-ink-900/90 via-ink-800/85 to-slate-900/90 p-6 shadow-glow backdrop-blur md:p-8 animate-floatIn">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-mint-400">Curalink Intelligence Suite</p>
              <h1 className="mt-2 text-3xl font-bold leading-tight text-white md:text-5xl">
                AI Medical Research Assistant
              </h1>
              <p className="mt-3 max-w-3xl text-sm text-slate-300 md:text-base">
                Context-aware pipeline that expands your query, retrieves live evidence, ranks quality, and generates source-grounded medical insights.
              </p>
              <div className="mt-4 inline-flex items-center rounded-full border border-mint-400/40 bg-mint-500/10 px-4 py-2 text-sm text-mint-100">
                💡 Generated from 200+ research papers and clinical trials
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-300">
                🔒 Source-backed answers
              </span>
              <button
                type="button"
                onClick={toggleJudgeView}
                className="rounded-full border border-mint-500/40 bg-mint-600/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-mint-100 transition hover:border-mint-400"
              >
                {judgeView ? "Switch To Full View" : "Switch To Judge View"}
              </button>
            </div>
          </div>
        </header>

        <ResearchComposer
          form={form}
          onChange={onChange}
          onSubmit={onSubmit}
          onSuggestion={onSuggestion}
          loading={loading}
          pipelineStages={pipelineStages}
          pipelineStageIndex={pipelineStageIndex}
          pipelineCompleted={pipelineCompleted}
          conversationId={conversationId}
        />

        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 shadow-md">
          ⚠️ Research tool only — not medical advice.
        </div>

        {error ? (
          <div className="rounded-xl border border-red-400/30 bg-red-900/20 px-4 py-3 text-sm text-red-200">{error}</div>
        ) : null}

        {judgeView ? (
          <section className="space-y-3">
            {latestInteraction ? (
              <div className="ml-auto w-fit max-w-[90%] rounded-2xl border border-mint-500/30 bg-mint-600/15 px-4 py-3 text-sm text-slate-100 shadow-md">
                {latestInteraction.request.query}
              </div>
            ) : null}
            <JudgeViewPanel interaction={latestInteraction} />
          </section>
        ) : (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white md:text-2xl">Research Output</h2>
              <p className="text-xs text-slate-400">Clear evidence, ranked confidence, and transparent reasoning</p>
            </div>

            {history.length === 0 ? (
              <article className="rounded-2xl border border-white/10 bg-ink-900/70 p-8 text-center text-slate-300 shadow-md animate-floatIn">
                <p className="text-lg font-semibold text-white">No responses yet</p>
                <p className="mt-2 text-sm">
                  Submit a medical query to generate a structured overview, ranked papers, clinical trials, and a confidence-backed explanation.
                </p>
              </article>
            ) : null}

            {history.map((interaction, idx) => (
              <div key={`${interaction.response.conversationId}-${idx}`} className="space-y-3">
                <div className="ml-auto w-fit max-w-[90%] rounded-2xl border border-mint-500/30 bg-mint-600/15 px-4 py-3 text-sm text-slate-100 shadow-md">
                  {interaction.request.query}
                </div>
                <ResearchResponseCard interaction={interaction} index={idx} onFollowUpSelect={onFollowUpSelect} />
              </div>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

export default App;
