function Metric({ label, value, subtitle }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-semibold text-white">{value}</p>
      {subtitle ? <p className="mt-1 text-xs text-slate-400">{subtitle}</p> : null}
    </div>
  );
}

function CompactEvidenceCard({ item, type }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className="rounded-xl border border-white/10 bg-white/5 p-3 transition hover:border-mint-500"
    >
      <p className="line-clamp-2 text-sm font-semibold text-white">{item.title}</p>
      <p className="mt-1 text-xs text-slate-300">
        {type === "paper"
          ? `${item.source || "Source"} | ${item.year || "n/a"} | Score ${Number(item.score || 0).toFixed(3)}`
          : `${item.status || "Status"} | ${item.location || "Location"} | Score ${Number(item.score || 0).toFixed(3)}`}
      </p>
      {(item.explanation || []).length ? (
        <ul className="mt-2 space-y-0.5 text-xs text-slate-200">
          {(item.explanation || []).slice(0, 3).map((reason, idx) => (
            <li key={`${idx}-${reason}`}>✔ {reason}</li>
          ))}
        </ul>
      ) : null}
    </a>
  );
}

export default function JudgeViewPanel({ interaction }) {
  if (!interaction?.response) {
    return (
      <section className="rounded-2xl border border-white/10 bg-ink-900/70 p-6 text-slate-300">
        Submit one query to populate Judge View.
      </section>
    );
  }

  const response = interaction.response;
  const confidence = response.confidence || { score: 0, level: "Low", reasoning: [] };
  const retrievalStats = response.retrieval_stats || {};
  const performance = response.performance || {};

  const topPapers = (response.research_papers || []).slice(0, 3);
  const topTrials = (response.clinical_trials || []).slice(0, 2);
  const whyThisAnswer = response.why_this_answer || {};

  return (
    <section className="rounded-2xl border border-white/10 bg-ink-900/70 p-5 shadow-glow backdrop-blur animate-floatIn md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-mint-500">Judge View</p>
          <h2 className="text-2xl font-bold text-white md:text-3xl">3-Minute Pitch Snapshot</h2>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
          Model: {response.model_used}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Confidence" value={`${confidence.level} (${confidence.score}%)`} subtitle="Evidence strength" />
        <Metric label="Papers Fetched" value={retrievalStats.total_papers_fetched || 0} subtitle={`Final: ${retrievalStats.final_papers || 0}`} />
        <Metric label="Trials Fetched" value={retrievalStats.total_trials_fetched || 0} subtitle={`Final: ${retrievalStats.final_trials || 0}`} />
        <Metric
          label="Latency"
          value={`${((performance.total_ms || 0) / 1000).toFixed(1)}s`}
          subtitle={`R:${Math.round(performance.retrieval_ms || 0)}ms LLM:${Math.round(performance.llm_ms || 0)}ms`}
        />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Single-screen summary</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-100">{response.overview}</p>
            <p className="mt-3 text-sm leading-relaxed text-slate-200">{response.personalized_insight}</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Expanded query logic</p>
            <p className="mt-2 text-sm text-slate-200">{response.query_logic || "N/A"}</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Why this answer?</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-200">
              {(whyThisAnswer.reasoning_approach || []).slice(0, 3).map((item, idx) => (
                <li key={`${idx}-${item}`}>• {item}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Top evidence: papers</p>
            <div className="mt-2 grid gap-2">
              {topPapers.map((paper) => (
                <CompactEvidenceCard key={paper.id || paper.url} item={paper} type="paper" />
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Top evidence: trials</p>
            <div className="mt-2 grid gap-2">
              {topTrials.map((trial) => (
                <CompactEvidenceCard key={trial.id || trial.url} item={trial} type="trial" />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
        Warning: This system provides research insights and is not medical advice.
      </div>
    </section>
  );
}
