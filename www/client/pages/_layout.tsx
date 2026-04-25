import type { PageProps } from "@hushkey/howl";
import type { State } from "../../howl.config.ts";
import type { JSX } from "preact/jsx-runtime";

export default function Layout(
  { Component, url }: PageProps<unknown, State>,
): JSX.Element {
  const path = url?.pathname ?? "/";
  const isHome = path === "/";
  const isDocs = path.startsWith("/docs");

  const navLink = (href: string, label: string, active: boolean) => (
    <a
      href={href}
      class={`btn btn-ghost btn-sm relative ${
        active ? "text-primary font-semibold" : ""
      }`}
    >
      {label}
      {active && (
        <span class="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
      )}
    </a>
  );

  return (
    <>
      {!isHome && (
        <div class="navbar bg-base-200">
          <div class="navbar-start">
            <a href="/" class="btn btn-ghost text-xl">🐶 Hound</a>
          </div>
          <div class="navbar-end">
            {navLink("/", "Home", isHome)}
            {navLink("/docs", "Docs", isDocs)}
          </div>
        </div>
      )}
      <main>
        <Component />
      </main>
    </>
  );
}
