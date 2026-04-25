import type { PageProps } from "@hushkey/howl";
import type { State } from "../../../howl.config.ts";
import { readManifest } from "../../../server/docs/reader.ts";
import { Head } from "@hushkey/howl/runtime";
import type { JSX } from "preact/jsx-runtime";

export default async function DocsIndex(
  _ctx: PageProps<unknown, State>,
): Promise<JSX.Element> {
  const manifest = await readManifest();

  return (
    <>
      <Head>
        <title>Hound — Documentation</title>
      </Head>
      <div class="max-w-4xl mx-auto px-6 py-12">
        {/* Hero */}
        <div class="mb-12">
          <div class="flex items-center gap-3 mb-4">
            <span class="text-4xl">🐶</span>
            <h1 class="text-4xl font-bold tracking-tight">
              Hound Documentation
            </h1>
          </div>
          <p class="text-lg text-base-content/60 max-w-2xl">
            Type-safe, Deno-native job queue. At-least-once delivery, cron
            scheduling, retries, and a management REST API out of the box.
          </p>
          <div class="flex gap-2 mt-4 flex-wrap">
            {["Deno 2.x", "Redis", "Deno KV", "TypeScript"].map((
              t,
            ) => <kbd key={t} class="kbd kbd-sm">{t}</kbd>)}
          </div>
        </div>

        {/* Quick start */}
        <div class="alert bg-primary/10 border-primary/20 mb-10">
          <div>
            <p class="font-semibold text-primary mb-1">Quick start</p>
            <code class="text-sm font-mono">deno add jsr:@hushkey/hound</code>
          </div>
        </div>

        {/* Section grid */}
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {manifest.map((item) => (
            <a
              key={item.slug}
              href={`/docs/${item.slug}`}
              class="card card-border bg-base-100 hover:bg-base-200 hover:border-primary/40 transition-all group"
            >
              <div class="card-body p-5">
                <div class="flex items-start justify-between">
                  <h2 class="card-title text-base font-semibold group-hover:text-primary transition-colors">
                    {item.title}
                  </h2>
                  <span class="text-base-content/30 group-hover:text-primary transition-colors text-lg">
                    →
                  </span>
                </div>
                <p class="text-sm text-base-content/60 mt-1">
                  {item.description}
                </p>
              </div>
            </a>
          ))}
        </div>

        {/* Footer */}
        <div class="mt-16 pt-8 border-t border-base-300 flex gap-6 text-sm text-base-content/40">
          <a
            href="https://jsr.io/@hushkey/hound"
            class="hover:text-base-content transition-colors"
            target="_blank"
          >
            JSR Package ↗
          </a>
          <a
            href="https://github.com/mirairoad/hound"
            class="hover:text-base-content transition-colors"
            target="_blank"
          >
            GitHub ↗
          </a>
        </div>
      </div>
    </>
  );
}
