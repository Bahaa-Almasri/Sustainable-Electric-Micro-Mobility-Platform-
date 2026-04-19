/** Client-side filter for Account settings search. All tokens must appear in the combined haystack. */
export function matchesAccountSearch(query: string, haystack: string[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const blob = haystack.join(' ').toLowerCase();
  return q.split(/\s+/).every((tok) => blob.includes(tok));
}
