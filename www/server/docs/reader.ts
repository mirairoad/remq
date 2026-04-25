import { join } from "@std/path";

export type BlockType =
  | { type: "p"; text: string }
  | { type: "code"; lang: string; text: string; filename?: string }
  | { type: "h3"; text: string }
  | { type: "tip"; text: string }
  | { type: "warning"; text: string }
  | { type: "list"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] };

export interface DocSection {
  id: string;
  heading: string;
  blocks: BlockType[];
}

export interface DocPage {
  slug: string;
  title: string;
  description: string;
  sections: DocSection[];
}

export interface ManifestItem {
  slug: string;
  title: string;
  description: string;
  order: number;
}

const _selfDir = import.meta.dirname!;

// Detect whether running from source (dev) or bundle (dist/).
// In dev:  import.meta.dirname = .../server/docs/
// In prod: import.meta.dirname = .../dist/ — go up one level then into server/docs/
async function resolveDocsDir(): Promise<string> {
  try {
    await Deno.stat(join(_selfDir, "manifest.json"));
    return _selfDir;
  } catch {
    return join(_selfDir, "..", "server", "docs");
  }
}

export async function readManifest(): Promise<ManifestItem[]> {
  const dir = await resolveDocsDir();
  const text = await Deno.readTextFile(join(dir, "manifest.json"));
  const items: ManifestItem[] = JSON.parse(text);
  return items.sort((a, b) => a.order - b.order);
}

export async function readDoc(slug: string): Promise<DocPage | null> {
  const dir = await resolveDocsDir();
  const safe = slug.replace(/[^a-z0-9-]/g, "");
  try {
    const text = await Deno.readTextFile(join(dir, `${safe}.json`));
    return JSON.parse(text) as DocPage;
  } catch {
    return null;
  }
}
