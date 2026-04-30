import type { JSX } from "preact/jsx-runtime";
import type { PageProps } from "@hushkey/howl";
import { asset, Partial } from "@hushkey/howl/runtime";
import type { State } from "../../howl.config.ts";

export default function App({ Component, state }: PageProps<unknown, State>): JSX.Element {
  return (
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>{state.client?.title ?? "Docs"}</title>
        <link rel="stylesheet" href="/style.css" />
        <link rel="icon" type="image/svg+xml" href={asset("/logo.svg")} />
      </head>
      <body f-client-nav>
        <Partial name="main">
          <Component />
        </Partial>
      </body>
    </html>
  );
}
