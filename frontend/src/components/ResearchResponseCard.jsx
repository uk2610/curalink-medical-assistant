import { useState } from "react";

function SectionTitle({ icon, title, subtitle }) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-white">
        {icon} {title}
      </h3>
      {subtitle ? <p className="mt-1 text-xs text-slate-400">{subtitle}</p> : null}
    </div>
  );
}

function StatTile({ icon, label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 shadow-sm">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">
        {icon} {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}

function statusBadgeTone(status) {
  const statusText = String(status || "unknown").toLowerCase();
  if (statusText.includes("recruit")) {
    return "border-emerald-400/40 bg-emerald-500/15 text-emerald-100";
  }
  if (statusText.includes("active")) {
    return "border-sky-400/40 bg-sky-500/15 text-sky-100";
  }
  if (statusText.includes("completed")) {
    return "border-violet-400/40 bg-violet-500/15 text-violet-100";
  }
  return "border-amber-400/40 bg-amber-500/15 text-amber-100";
}

function ConfidenceMeter({ level, score, reasoning }) {
  const normalizedScore = Math.max(0, Math.min(100, Number(score) || 0));
  const blocks = 12;
  const filledBlocks = Math.round((normalizedScore / 100) * blocks);
  const bar = `${"█".repeat(filledBlocks)}${"░".repeat(blocks - filledBlocks)}`;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 shadow-sm">
      <SectionTitle icon="🧠" title={`Confidence: ${level} (${Math.round(normalizedScore)}%)`} subtitle="Confidence reflects evidence depth and ranking consistency." />
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-700/70">
        <div
          className="h-full rounded-full bg-gradient-to-r from-mint-500 via-sky-400 to-cyan-300 transition-all duration-700"
          style={{ width: `${normalizedScore}%` }}
        />
      </div>
      <p className="mt-2 font-mono text-xs tracking-wide text-slate-300">{bar}</p>
      <ul className="mt-3 space-y-1 text-sm text-slate-200">
        {(reasoning || []).slice(0, 3).map((item, idx) => (
          <li key={`${idx}-${item}`}>• {item}</li>
        ))}
      </ul>
    </div>
  );
}

function SourceLink({ item }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className="rounded-xl border border-white/10 bg-white/5 p-3 transition hover:-translate-y-0.5 hover:border-sky-400/50"
    >
      <p className="line-clamp-2 text-sm font-semibold text-white">{item.title || "Untitled source"}</p>
      <p className="mt-1 text-xs text-slate-300">
        {(item.source || "Source")} {item.year ? `• ${item.year}` : ""}
      </p>
      <p className="mt-1 line-clamp-1 text-xs text-slate-400">{item.url}</p>
    </a>
  );
}

function PaperCard({ paper }) {
  const details = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-sm font-semibold text-white">{paper.title || "Untitled paper"}</p>
        <span className="shrink-0 rounded-full border border-sky-400/30 bg-sky-500/15 px-2 py-0.5 text-[11px] text-sky-100">
          Score {Number(paper.score || 0).toFixed(3)}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-300">
        {paper.authors || "Unknown authors"} {paper.year ? `• ${paper.year}` : ""}
      </p>
      <p className="mt-1 text-xs text-slate-400">Source: {paper.source || "Unknown"}</p>
      <p className="mt-2 line-clamp-4 text-xs text-slate-300">{paper.snippet || "No abstract snippet available."}</p>

      <div className="mt-3 rounded-lg border border-white/10 bg-black/10 p-2.5">
        <p className="text-[11px] uppercase tracking-wide text-slate-400">Why selected</p>
        {(paper.explanation || paper.why_selected || []).length ? (
          <ul className="mt-1 space-y-1 text-xs text-slate-200">
            {(paper.explanation || paper.why_selected || []).slice(0, 4).map((reason, idx) => (
              <li key={`${idx}-${reason}`}>✔ {reason}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-slate-400">No ranking explanation available.</p>
        )}
      </div>
    </>
  );

  const commonClassName =
    "rounded-xl border border-white/10 bg-white/5 p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-mint-400/50";

  if (!paper.url) {
    return <article className={commonClassName}>{details}</article>;
  }

  return (
    <a href={paper.url} target="_blank" rel="noreferrer" className={commonClassName}>
      {details}
    </a>
  );
}

function TrialCard({ trial }) {
  const details = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-sm font-semibold text-white">{trial.title || "Untitled trial"}</p>
        <span className="shrink-0 rounded-full border border-mint-400/30 bg-mint-500/15 px-2 py-0.5 text-[11px] text-mint-100">
          Score {Number(trial.score || 0).toFixed(3)}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-full border px-2 py-0.5 ${statusBadgeTone(trial.status)}`}>
          {trial.status || "Status unknown"}
        </span>
        <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-slate-200">
          {trial.location || "Location unavailable"}
        </span>
      </div>

      <p className="mt-2 line-clamp-3 text-xs text-slate-300">Eligibility: {trial.eligibility || "Not listed"}</p>
      <p className="mt-1 text-xs text-slate-400">Contact: {trial.contact || "Not listed"}</p>

      <div className="mt-3 rounded-lg border border-white/10 bg-black/10 p-2.5">
        <p className="text-[11px] uppercase tracking-wide text-slate-400">Why selected</p>
        {(trial.explanation || []).length ? (
          <ul className="mt-1 space-y-1 text-xs text-slate-200">
            {(trial.explanation || []).slice(0, 4).map((reason, idx) => (
              <li key={`${idx}-${reason}`}>✔ {reason}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-slate-400">No ranking explanation available.</p>
        )}
      </div>
    </>
  );

  const commonClassName =
    "rounded-xl border border-white/10 bg-white/5 p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-mint-400/50";

  if (!trial.url) {
    return <article className={commonClassName}>{details}</article>;
  }

  return (
    <a href={trial.url} target="_blank" rel="noreferrer" className={commonClassName}>
      {details}
    </a>
  );
}

export default function ResearchResponseCard({ interaction, index, onFollowUpSelect }) {
  const response = interaction.response || {};
  const [showQueryLogic, setShowQueryLogic] = useState(false);

  const retrievalStats = response.retrieval_stats || {};
  const confidence = response.confidence || { score: 0, level: "Low", reasoning: [] };
  const whyThisAnswer = response.why_this_answer || {
    sources_used: [],
    reasoning_approach: [],
    ranking_influence: []
  };

  const topSourceLinks = (response.sources || []).slice(0, 6);
  const totalPapers = retrievalStats.total_papers_fetched || retrievalStats.publication_candidates || 0;
  const totalTrials = retrievalStats.total_trials_fetched || retrievalStats.trial_candidates || 0;
  const selectedPapers = retrievalStats.final_papers || (response.research_papers || []).length || 0;
  const selectedTrials = retrievalStats.final_trials || (response.clinical_trials || []).length || 0;

  const totalMs = Number(response.performance?.total_ms || 0);
  const latencyText = totalMs ? `${(totalMs / 1000).toFixed(1)}s` : "N/A";

  return (
    <article className="rounded-2xl border border-white/10 bg-ink-900/75 p-5 shadow-md backdrop-blur animate-floatIn md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Response #{index + 1}</p>
          <p className="mt-1 text-sm text-slate-300">Model: {response.model_used || "Unknown model"}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {response.demo_mode ? (
            <span className="rounded-full border border-amber-300/30 bg-amber-500/15 px-2.5 py-1 text-[11px] text-amber-100">
              Demo-safe mode
            </span>
          ) : null}
          <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200">Latency: {latencyText}</span>
        </div>
      </div>

      {response.warnings?.length ? (
        <div className="mb-4 rounded-xl border border-amber-300/30 bg-amber-500/10 p-3 text-sm text-amber-100">
          {response.warnings.join(" ")}
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 shadow-sm">
          <SectionTitle icon="📊" title="Retrieval Stats" subtitle="Depth and selection transparency across sources." />
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <StatTile icon="📄" label="Papers" value={totalPapers} />
            <StatTile icon="🧪" label="Trials" value={totalTrials} />
            <StatTile icon="⭐" label="Selected Papers" value={selectedPapers} />
            <StatTile icon="🔬" label="Selected Trials" value={selectedTrials} />
          </div>
        </div>

        <ConfidenceMeter level={confidence.level || "Low"} score={confidence.score || 0} reasoning={confidence.reasoning || []} />
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 shadow-sm">
          <SectionTitle icon="🧾" title="Overview" subtitle="Short summary generated from ranked evidence." />
          <p className="mt-3 text-sm leading-relaxed text-slate-100">{response.overview || "Overview not available."}</p>
        </div>

        <div className="rounded-xl border border-mint-400/30 bg-mint-500/10 p-4 shadow-sm">
          <SectionTitle icon="🧠" title="Personalized Insight" subtitle="Tailored insight based on the provided patient and intent context." />
          <p className="mt-3 text-sm leading-relaxed text-mint-50">{response.personalized_insight || "Personalized insight not available."}</p>
        </div>
      </section>

      <section className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 shadow-sm">
        <SectionTitle icon="🔍" title="Why this answer?" subtitle="Source coverage, reasoning path, and ranking criteria." />
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <div className="rounded-lg border border-white/10 bg-black/10 p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Sources used</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-200">
              {(whyThisAnswer.sources_used || []).slice(0, 5).map((item, idx) => (
                <li key={`${idx}-${item}`}>• {item}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-white/10 bg-black/10 p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Reasoning approach</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-200">
              {(whyThisAnswer.reasoning_approach || []).slice(0, 5).map((item, idx) => (
                <li key={`${idx}-${item}`}>• {item}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-white/10 bg-black/10 p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Ranking logic</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-200">
              {(whyThisAnswer.ranking_influence || []).slice(0, 5).map((item, idx) => (
                <li key={`${idx}-${item}`}>• {item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 shadow-sm">
        <SectionTitle icon="🔍" title="Expanded Query" subtitle="Shows how the request was broadened before retrieval." />
        <p className="mt-3 rounded-lg border border-white/10 bg-black/10 px-3 py-2 text-sm text-slate-100">
          {response.query_logic || "Query logic unavailable."}
        </p>
        <button
          type="button"
          onClick={() => setShowQueryLogic((current) => !current)}
          className="mt-3 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-slate-200 transition hover:border-sky-400/60 hover:bg-sky-500/10"
        >
          {showQueryLogic ? "Hide Query Logic" : "Show Query Logic"}
        </button>

        {showQueryLogic ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {(response.expanded_queries || []).map((item) => (
              <span key={item} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300">
                {item}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <section className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 shadow-sm">
        <SectionTitle icon="📚" title="Research Papers" subtitle="Ranked papers with score, snippet, and selection rationale." />
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(response.research_papers || []).length ? (
            (response.research_papers || []).map((paper) => <PaperCard key={paper.id || paper.url || paper.title} paper={paper} />)
          ) : (
            <p className="text-sm text-slate-300">No paper matches available for this query.</p>
          )}
        </div>
      </section>

      <section className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 shadow-sm">
        <SectionTitle icon="🧪" title="Clinical Trials" subtitle="High-relevance trials with status, eligibility, and selection rationale." />
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(response.clinical_trials || []).length ? (
            (response.clinical_trials || []).map((trial) => <TrialCard key={trial.id || trial.url || trial.title} trial={trial} />)
          ) : (
            <p className="text-sm text-slate-300">No clinical trials available for this query.</p>
          )}
        </div>
      </section>

      <section className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 shadow-sm">
        <SectionTitle icon="🧩" title="Source Attribution" subtitle="Primary supporting links and citations." />
        <ul className="mt-3 space-y-2 text-sm text-slate-200">
          {(response.source_attribution || []).slice(0, 5).map((item, idx) => (
            <li key={`${idx}-${item}`} className="rounded-lg border border-white/10 bg-black/10 p-2.5">
              {item}
            </li>
          ))}
        </ul>

        {topSourceLinks.length ? (
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {topSourceLinks.map((item) => (
              <SourceLink key={`${item.type}-${item.id || item.url || item.title}`} item={item} />
            ))}
          </div>
        ) : null}
      </section>

      <section className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 shadow-sm">
        <SectionTitle icon="💡" title="Suggested Questions" subtitle="Click a follow-up to quickly run the next query." />
        <div className="mt-3 flex flex-wrap gap-2">
          {(response.suggested_questions || []).length ? (
            (response.suggested_questions || []).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => onFollowUpSelect?.(item)}
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-slate-100 transition hover:border-mint-500 hover:bg-mint-500/10"
              >
                {item}
              </button>
            ))
          ) : (
            <p className="text-sm text-slate-300">No follow-up suggestions were generated for this response.</p>
          )}
        </div>
      </section>
    </article>
  );
}
