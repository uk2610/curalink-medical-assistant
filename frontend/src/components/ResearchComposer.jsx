const promptSuggestions = [
  "Latest treatment for lung cancer",
  "Clinical trials for diabetes",
  "Top researchers in Alzheimer's disease",
  "Recent studies on heart disease"
];

const fieldClasses =
  "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-400 transition focus:border-mint-500 focus:outline-none focus:ring-2 focus:ring-mint-500/20";

function Label({ title, children, wide = false }) {
  return (
    <label className={`grid gap-2 ${wide ? "md:col-span-2" : ""}`}>
      <span className="text-sm font-semibold text-slate-200">{title}</span>
      {children}
    </label>
  );
}

export default function ResearchComposer({
  form,
  onChange,
  onSubmit,
  onSuggestion,
  loading,
  pipelineStages,
  pipelineStageIndex,
  pipelineCompleted,
  conversationId
}) {
  const submitDisabled = loading || form.query.trim().length < 3;

  return (
    <section className="grid gap-4 xl:grid-cols-[1.45fr_1fr] animate-floatIn">
      <article className="rounded-2xl border border-white/10 bg-ink-900/75 p-5 shadow-md backdrop-blur md:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-mint-400">Structured Input</p>
            <h2 className="text-2xl font-bold text-white md:text-3xl">Query Builder</h2>
          </div>
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-300">
            {conversationId ? `Conversation: ${conversationId}` : "New conversation"}
          </span>
        </div>

        <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
          <Label title="Disease">
            <input
              name="disease"
              value={form.disease}
              onChange={onChange}
              placeholder="e.g., lung cancer"
              className={fieldClasses}
            />
          </Label>

          <Label title="Intent">
            <input
              name="intent"
              value={form.intent}
              onChange={onChange}
              placeholder="e.g., latest treatment, top researchers"
              className={fieldClasses}
            />
          </Label>

          <Label title="Location">
            <input
              name="location"
              value={form.location}
              onChange={onChange}
              placeholder="e.g., United States"
              className={fieldClasses}
            />
          </Label>

          <Label title="Patient Name">
            <input
              name="patientName"
              value={form.patientName}
              onChange={onChange}
              placeholder="e.g., Jane Doe"
              className={fieldClasses}
            />
          </Label>

          <Label title="Natural Query" wide>
            <textarea
              name="query"
              value={form.query}
              onChange={onChange}
              placeholder="Ask a complete medical research question..."
              rows={4}
              className={fieldClasses}
            />
          </Label>

          <div className="flex flex-wrap gap-2 md:col-span-2">
            {promptSuggestions.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => onSuggestion(item)}
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-slate-200 transition hover:border-mint-500 hover:bg-mint-500/10"
              >
                {item}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-4 pt-2 md:col-span-2">
            <p className="text-xs text-slate-400">Pipeline uses query expansion, retrieval, evidence ranking, and LLM synthesis.</p>
            <button
              type="submit"
              disabled={submitDisabled}
              className="rounded-full bg-gradient-to-r from-mint-500 to-sky-400 px-5 py-2.5 text-sm font-semibold text-ink-950 shadow-md transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? `${pipelineStages[pipelineStageIndex]}...` : "Run Medical Research"}
            </button>
          </div>
        </form>
      </article>

      <aside className="rounded-2xl border border-white/10 bg-ink-900/70 p-5 shadow-md backdrop-blur md:p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-sky-300">🧠 Pipeline Execution</p>
        <p className="mt-2 text-sm text-slate-300">Each stage updates in real time to keep research generation transparent.</p>

        <div className="mt-4 space-y-2.5">
          {(pipelineStages || []).map((stage, index) => {
            const isActive = loading && index === pipelineStageIndex;
            const isDone = pipelineCompleted ? index <= pipelineStageIndex : loading ? index < pipelineStageIndex : false;

            return (
              <div key={`${stage}-${index}`} className="space-y-2">
                <div
                  className={`flex items-start gap-3 rounded-xl border p-3 text-sm transition duration-300 ${
                    isActive
                      ? "border-sky-400/50 bg-sky-500/10 text-sky-100 shadow-md animate-pulse"
                      : isDone
                        ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
                        : "border-white/10 bg-white/[0.03] text-slate-300"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border text-xs ${
                      isActive
                        ? "border-sky-300/70 bg-sky-400/20"
                        : isDone
                          ? "border-emerald-300/70 bg-emerald-400/20"
                          : "border-white/20 bg-white/5"
                    }`}
                  >
                    {isDone ? "✔" : isActive ? "⋯" : "○"}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold">{stage}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {isDone ? "Completed" : isActive ? "In progress" : "Waiting"}
                    </p>
                  </div>
                </div>

                {index < pipelineStages.length - 1 ? (
                  <div className={`ml-3 h-3 w-px ${isDone ? "bg-emerald-400/50" : "bg-white/15"}`} />
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
          {loading
            ? "Running retrieval and reasoning..."
            : pipelineCompleted
              ? "Pipeline complete. Review overview, confidence, and source evidence below."
              : "Submit a query to begin pipeline execution."}
        </div>
      </aside>
    </section>
  );
}
