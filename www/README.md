# www

A documentation site built with [Howl](https://jsr.io/@hushkey/howl). Tailwind v4
+ daisyUI styling, JSON-driven content, syntax-highlighted code blocks out of
the box.

## Setup

```sh
deno install
cp .env.example .env
deno task dev
```

Open <http://127.0.0.1:8000>.

## Environment

| Variable        | Default        | Purpose                              |
| --------------- | -------------- | ------------------------------------ |
| `APP_NAME`      | `Docs`         | Brand title — shown in header / tab  |
| `DENO_PORT`     | `8000`         | Dev / start server port              |
| `DENO_HOSTNAME` | `127.0.0.1`    | Dev / start server bind hostname     |

## Adding a new doc page

Each doc is a JSON file under [`server/docs/`](server/docs/). Three steps:

1. Create `server/docs/my-topic.json` (same shape as
   [`getting-started.json`](server/docs/getting-started.json)).
2. Append a manifest entry in
   [`server/docs/manifest.json`](server/docs/manifest.json) with a unique
   `slug` and `order`.
3. Register the import in
   [`server/docs/reader.ts`](server/docs/reader.ts) — the file ships with
   commented examples showing exactly where.

The slug in the JSON body, the manifest entry, and the registry key must all
match.

## Project layout

```
server/
  main.ts              # Howl app, middleware order, env wiring
  apis/                # File-system API routes (.api.ts)
  docs/
    manifest.json      # ordered table of contents
    reader.ts          # registers each doc — edit when you add one
    *.json             # individual doc pages
client/
  pages/
    _app.tsx           # HTML shell + <head>
    _layout.tsx        # site chrome (top bar + mobile tabs)
    _error.tsx         # error page
    index.tsx          # landing
    docs/
      _layout.tsx      # docs sidebar + mobile tab strip
      index.tsx        # docs hub
      [slug].tsx       # generic doc renderer (block types, syntax highlight)
static/
  style.css            # Tailwind entry, theme tokens, animations
  logo.svg             # placeholder — swap for your own brand mark
howl.config.ts         # State, roles, defineApi factory
dev.ts                 # HowlBuilder entry — dev server + production build
tailwind.config.ts     # daisyUI plugin + content globs
```

## Production

```sh
deno task build && deno task start          # plain Deno run
deno task build && deno task compile         # single-binary
```
