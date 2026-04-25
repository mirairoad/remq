import { Head } from "@hushkey/howl/runtime";


export default function Index() {
  return (
    <>
      <Head>
        <title>Hound — Job Queue for Deno</title>
        <style>{`
          @keyframes spin-slow {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes spin-slow-reverse {
            from { transform: rotate(0deg); }
            to { transform: rotate(-360deg); }
          }
          @keyframes fade-up {
            from { opacity: 0; transform: translateY(16px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes pulse-ring {
            0%, 100% { opacity: 0.15; transform: scale(1); }
            50%       { opacity: 0.35; transform: scale(1.06); }
          }
          .spin-slow         { animation: spin-slow 18s linear infinite; }
          .spin-slow-reverse { animation: spin-slow-reverse 12s linear infinite; }
          .fade-up-1 { animation: fade-up 0.6s ease both 0.05s; }
          .fade-up-2 { animation: fade-up 0.6s ease both 0.18s; }
          .fade-up-3 { animation: fade-up 0.6s ease both 0.30s; }
          .fade-up-4 { animation: fade-up 0.6s ease both 0.42s; }
          .fade-up-5 { animation: fade-up 0.6s ease both 0.54s; }
          .pulse-ring { animation: pulse-ring 3s ease-in-out infinite; }
          .dot-grid {
            background-image: radial-gradient(circle, oklch(var(--bc)/0.10) 1px, transparent 1px);
            background-size: 28px 28px;
          }
        `}</style>
      </Head>

      <div class="relative min-h-screen dot-grid flex flex-col items-center justify-center overflow-hidden px-6 py-20">

        {/* Top-right nav */}
        <nav class="fixed top-0 right-0 z-50 flex items-center gap-1 p-4">
          <a href="/docs" class="btn btn-ghost btn-sm text-base-content/60 hover:text-base-content">
            Docs
          </a>
          <a
            href="https://github.com/mirairoad/hound"
            target="_blank"
            class="btn btn-ghost btn-sm text-base-content/40 hover:text-base-content"
          >
            GitHub
          </a>
          <a
            href="https://jsr.io/@hushkey/hound"
            target="_blank"
            class="btn btn-ghost btn-sm text-base-content/40 hover:text-base-content"
          >
            JSR
          </a>
        </nav>

        {/* Ambient glow blobs */}
        <div class="pointer-events-none absolute inset-0 overflow-hidden">
          <div class="absolute -top-32 left-1/2 -translate-x-1/2 w-150 h-150 rounded-full bg-primary opacity-[0.04] blur-3xl" />
          <div class="absolute bottom-0 right-1/4 w-96 h-96 rounded-full bg-secondary opacity-[0.04] blur-3xl" />
        </div>

        {/* Logo mark */}
        <div class="fade-up-1 relative flex items-center justify-center mb-8">
          {/* Outer rotating ring */}
          <div class="spin-slow absolute w-44 h-44 rounded-full border border-dashed border-primary/20" />
          {/* Inner rotating ring */}
          <div class="spin-slow-reverse absolute w-32 h-32 rounded-full border border-primary/15" />
          {/* Pulse ring */}
          <div class="pulse-ring absolute w-24 h-24 rounded-full bg-primary/10" />
          {/* Emoji */}
          <div class="relative z-10 text-7xl select-none" style="filter: drop-shadow(0 0 24px oklch(var(--p)/0.4))">
            🐶
          </div>
        </div>

        {/* Wordmark */}
        <div class="fade-up-2 text-center mb-4">
          <h1 class="text-6xl sm:text-7xl font-black tracking-tight font-mono leading-none">
            HOUND
          </h1>
          <p class="mt-4 text-base-content/50 text-base tracking-[0.25em] uppercase font-mono">
            Job Queue · Type-Safe · Deno
          </p>
        </div>

        {/* Tagline */}
        <p class="fade-up-3 text-base-content/60 text-center max-w-lg text-lg leading-relaxed mb-10">
          At-least-once delivery, cron scheduling, automatic retries, and a
          management REST API — all in one Deno-native package.
        </p>

        {/* Install command */}
        <div class="fade-up-4 w-full max-w-md mb-12">
          <div class="rounded-xl border border-base-300 bg-base-200/60 backdrop-blur overflow-hidden">
            <div class="flex items-center gap-1.5 px-5 py-3 border-b border-base-300">
              <span class="w-3 h-3 rounded-full bg-error/60" />
              <span class="w-3 h-3 rounded-full bg-warning/60" />
              <span class="w-3 h-3 rounded-full bg-success/60" />
              <span class="ml-2 text-sm text-base-content/30 font-mono">terminal</span>
            </div>
            <div class="px-5 py-4 font-mono text-base">
              <span class="text-primary/60 select-none">$ </span>
              <span class="text-base-content/80">deno add </span>
              <span class="text-primary">jsr:@hushkey/hound</span>
            </div>
          </div>
        </div>

        {/* CTA buttons */}
        <div class="fade-up-4 flex flex-wrap gap-4 justify-center mb-20">
          <a href="/docs" class="btn btn-primary gap-2">
            Read the docs
            <span class="opacity-70">→</span>
          </a>
          <a
            href="https://github.com/mirairoad/hound"
            target="_blank"
            class="btn btn-outline gap-2"
          >
            GitHub
            <span class="opacity-50">↗</span>
          </a>
          <a
            href="https://jsr.io/@hushkey/hound"
            target="_blank"
            class="btn btn-ghost gap-2 text-base-content/50"
          >
            JSR
            <span class="opacity-50">↗</span>
          </a>
        </div>

        {/* Feature strip */}
        <div class="fade-up-5 w-full max-w-3xl">
          <div class="rounded-xl border border-base-300 bg-base-200/40 backdrop-blur overflow-hidden">
            <div class="grid grid-cols-2 sm:grid-cols-4 divide-base-300 divide-x divide-y sm:divide-y-0">
              {[
                { icon: "⚡", label: "At-Least-Once" },
                { icon: "🔒", label: "Type-Safe" },
                { icon: "⏰", label: "Cron Jobs" },
                { icon: "🔌", label: "REST API" },
              ].map((f) => (
                <div key={f.label} class="flex flex-col items-center gap-2 py-6 px-4">
                  <span class="text-2xl">{f.icon}</span>
                  <span class="font-mono text-xs uppercase tracking-widest text-base-content/40">
                    {f.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Benchmark */}
        <div class="fade-up-5 w-full max-w-3xl mt-16">
          <div class="text-center mb-6">
            <p class="font-mono text-xs uppercase tracking-widest text-base-content/30 mb-2">
              Performance · MacBook Pro M1 Pro
            </p>
            <p class="font-mono font-black text-4xl text-primary tracking-tight">
              34,678 <span class="text-2xl font-semibold text-base-content/50">jobs/s</span>
            </p>
            <p class="text-xs text-base-content/30 font-mono mt-1 tracking-widest uppercase">
              100,000 jobs · Redis · sub-millisecond handler
            </p>
          </div>

          <div class="rounded-xl border border-base-300 bg-base-200/60 backdrop-blur overflow-hidden">
            <div class="flex items-center gap-1.5 px-5 py-3 border-b border-base-300">
              <span class="w-3 h-3 rounded-full bg-error/60" />
              <span class="w-3 h-3 rounded-full bg-warning/60" />
              <span class="w-3 h-3 rounded-full bg-success/60" />
              <span class="ml-2 text-sm text-base-content/30 font-mono">benchmark · Redis · M1 Pro</span>
            </div>

            <div class="grid grid-cols-3 divide-x divide-base-300">
              {[
                {
                  label: "1 core",
                  jobs: "100 jobs",
                  throughput: "425.21 jobs/s",
                  duration: "0.24s",
                  latency: [["min","1.82ms"],["p50","2.03ms"],["p95","3.37ms"],["avg","2.35ms"]],
                  tier: "dim",
                },
                {
                  label: "10 cores",
                  jobs: "100 jobs",
                  throughput: "2,763.70 jobs/s",
                  duration: "0.04s",
                  latency: [["min","1.80ms"],["p50","2.91ms"],["p95","7.98ms"],["avg","3.41ms"]],
                  tier: "mid",
                },
                {
                  label: "100k jobs",
                  jobs: "100,000 jobs",
                  throughput: "34,678.37 jobs/s",
                  duration: "2.88s",
                  latency: [["min","0.00ms"],["p50","0.00ms"],["p95","0.00ms"],["avg","0.00ms"]],
                  tier: "top",
                },
              ].map(({ label, jobs, throughput, duration, latency, tier }) => (
                <div
                  key={label}
                  class={`px-4 py-5 font-mono text-[12px] ${tier === "dim" ? "opacity-40" : tier === "mid" ? "opacity-70" : ""}`}
                >
                  <p class={`text-xs uppercase tracking-widest mb-3 font-semibold ${tier === "top" ? "text-primary" : "text-base-content/40"}`}>
                    {label}
                  </p>
                  <div class="space-y-1 mb-3">
                    <div class="flex justify-between gap-2">
                      <span class="text-base-content/40">jobs</span>
                      <span class="text-base-content/70">{jobs}</span>
                    </div>
                    <div class="flex justify-between gap-2">
                      <span class="text-base-content/40">time</span>
                      <span class="text-base-content/70">{duration}</span>
                    </div>
                    <div class="flex justify-between gap-2">
                      <span class={tier === "top" ? "text-primary font-semibold" : "text-base-content/40"}>
                        tput
                      </span>
                      <span class={tier === "top" ? "text-primary font-semibold" : "text-base-content/70"}>
                        {throughput}
                      </span>
                    </div>
                  </div>
                  <p class="text-base-content/15 mb-2 select-none">──────────────</p>
                  <div class="space-y-1">
                    {latency.map(([k, v]) => (
                      <div key={k} class="flex justify-between gap-2">
                        <span class="text-base-content/30">{k}:</span>
                        <span class="text-success/70">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
