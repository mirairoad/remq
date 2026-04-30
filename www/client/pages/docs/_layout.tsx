import type { PageProps } from "@hushkey/howl";
import type { State } from "../../../howl.config.ts";
import { readManifest } from "../../../server/docs/reader.ts";
import type { JSX } from "preact/jsx-runtime";

export default function DocsLayout(
  { Component, url }: PageProps<unknown, State>,
): JSX.Element {
  const manifest = readManifest();
  const segments = url.pathname.replace(/\/$/, "").split("/");
  const currentSlug = segments[segments.length - 1] === "docs"
    ? ""
    : segments[segments.length - 1];

  return (
    <div class="relative bg-base-100 bg-dot-grid bg-size-[28px_28px]">
      <div class="flex pt-20 sm:pt-24">
        <aside class="hidden lg:flex w-64 shrink-0 flex-col border-r border-base-300 fixed top-24 bottom-0 overflow-y-auto bg-base-100/60 backdrop-blur">
          <div class="p-4">
            <p class="font-mono text-xs uppercase tracking-widest text-base-content/30 mb-3 px-2">
              Documentation
            </p>
            <ul class="menu gap-1 p-0">
              {manifest.map((item) => {
                const isActive = item.slug === currentSlug;
                return (
                  <li key={item.slug}>
                    <a
                      href={`/docs/${item.slug}`}
                      class={`rounded-lg text-base py-2.5 px-3 ${
                        isActive
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-base-content/70 hover:text-base-content hover:bg-base-200"
                      }`}
                    >
                      {item.title}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>

        <div class="flex-1 lg:ml-64 min-w-0 px-4 sm:px-6 lg:px-8 pb-32 sm:pb-20 lg:pb-8">
          <Component />
        </div>
      </div>

      <div class="lg:hidden fixed bottom-(--nav-h) sm:bottom-0 left-0 right-0 z-40 bg-base-100/95 backdrop-blur border-t border-base-300 px-3 py-2 overflow-x-auto scrollbar-hide">
        <ul class="flex gap-2 min-w-max">
          {manifest.map((item) => {
            const isActive = item.slug === currentSlug;
            return (
              <li key={item.slug}>
                <a
                  href={`/docs/${item.slug}`}
                  class={`btn btn-sm rounded-lg font-mono text-xs ${
                    isActive ? "btn-primary" : "btn-ghost"
                  }`}
                >
                  {item.title}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
