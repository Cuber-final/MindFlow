import { Link, useParams } from 'react-router-dom';

export default function Now() {
  const { anchorId } = useParams<{ anchorId: string }>();

  return (
    <section className="relative overflow-hidden rounded-[32px] border border-[#c0c8cb]/15 bg-[#f6f5f0] px-8 py-12 shadow-[0_24px_80px_rgba(26,28,27,0.05)] md:px-12">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#0d4656]/30 to-transparent" />
      <div className="absolute right-0 top-0 h-64 w-64 translate-x-20 -translate-y-24 rounded-full bg-[#0d4656]/6 blur-3xl" />

      <div className="relative z-10 max-w-4xl">
        <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.28em] text-[#5e5e5e]">
          Current-priority workbench
        </p>
        <h1 className="font-headline text-5xl leading-none tracking-tight text-[#1a1c1b] md:text-6xl">
          Now
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-[#40484b]">
          This route shell is live. The next step will replace this placeholder with the full three-column queue,
          detail reader, and state controls for short-horizon work.
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            'Left rail: context and triage posture',
            'Center rail: ranked queue of current items',
            'Right rail: summary, body, and read/process actions',
          ].map((label) => (
            <div
              key={label}
              className="rounded-2xl border border-[#c0c8cb]/12 bg-white/70 px-5 py-6 text-sm leading-6 text-[#40484b]"
            >
              {label}
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-4 text-sm">
          <Link
            to="/daily-digest"
            className="inline-flex items-center gap-2 rounded-full bg-[#0d4656] px-5 py-3 font-semibold text-white transition-colors hover:bg-[#0b3f4d]"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Back to Daily Digest
          </Link>
          {anchorId && (
            <div className="rounded-full border border-[#c0c8cb]/20 px-4 py-2 text-[#5e5e5e]">
              Pending detail target: anchor #{anchorId}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
