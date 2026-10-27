// Calls the public Hugging Face Hub API directly from the browser (no key needed for public data).

export type DatasetHit = {
  id: string;
  downloads: number;
  likes: number;
  license: string | null;
  sizeTag: string | null;
};

// Licenses that generally allow fine-tuning and redistribution of the result.
const OPEN_LICENSES = new Set([
  "apache-2.0",
  "mit",
  "cc-by-4.0",
  "cc-by-sa-4.0",
  "cc0-1.0",
  "odc-by",
  "bsd-3-clause",
  "openrail",
  "cc-by-3.0",
  "unlicense",
]);

export function isOpenLicense(license: string | null) {
  return !!license && OPEN_LICENSES.has(license.toLowerCase());
}

type RawDataset = { id: string; downloads?: number; likes?: number; tags?: string[] };

export async function searchDatasets(query: string, limit = 20): Promise<DatasetHit[]> {
  const url = new URL("https://huggingface.co/api/datasets");
  url.searchParams.set("search", query);
  url.searchParams.set("sort", "downloads");
  url.searchParams.set("direction", "-1");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("full", "true");
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Hugging Face search failed (${res.status})`);
  const data = (await res.json()) as RawDataset[];
  return data.map((d) => {
    const tags = d.tags ?? [];
    const license = tags.find((t) => t.startsWith("license:"))?.slice(8) ?? null;
    const sizeTag = tags.find((t) => t.startsWith("size_categories:"))?.slice(16) ?? null;
    return { id: d.id, downloads: d.downloads ?? 0, likes: d.likes ?? 0, license, sizeTag };
  });
}

// "Let Zebrain choose": run the purpose's searches, keep open-licensed text datasets, rank by downloads.
export async function suggestDatasets(queries: string[], max = 3): Promise<DatasetHit[]> {
  const results = await Promise.all(queries.map((q) => searchDatasets(q, 15).catch(() => [])));
  const seen = new Set<string>();
  const merged: DatasetHit[] = [];
  for (const hit of results.flat().sort((a, b) => b.downloads - a.downloads)) {
    if (seen.has(hit.id) || !isOpenLicense(hit.license)) continue;
    seen.add(hit.id);
    merged.push(hit);
  }
  return merged.slice(0, max);
}

export function formatCount(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(n);
}
