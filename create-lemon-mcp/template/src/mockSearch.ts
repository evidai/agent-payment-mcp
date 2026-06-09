/**
 * mockSearch — fixed demo results so the starter runs with ZERO keys.
 * Swap this for a real search API (Brave / Serper / Tavily / your own) later.
 */
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export function mockSearch(query: string): SearchResult[] {
  const q = query.trim() || "example";
  return [
    { title: `${q} — overview`, url: "https://example.com/1", snippet: `A concise overview of "${q}". (demo result — wire up a real search API to go live.)` },
    { title: `Top resources for ${q}`, url: "https://example.com/2", snippet: `Curated links about "${q}".` },
    { title: `${q}: getting started`, url: "https://example.com/3", snippet: `How to get started with "${q}".` },
  ];
}
