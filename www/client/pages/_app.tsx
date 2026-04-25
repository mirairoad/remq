import type { FunctionComponent, JSX } from "preact";
import { Partial } from "@hushkey/howl/runtime";

export default function (
  { Component }: { Component: FunctionComponent },
): JSX.Element {
  return (
    <html>
      <head>
        <title>Hound</title>
        <link rel="stylesheet" href="/style.css" />
      </head>
      <body f-client-nav>
        <Partial name="main">
          <Component />
        </Partial>
      </body>
    </html>
  );
}
