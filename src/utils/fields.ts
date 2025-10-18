export function normalizeKey(s: string) {
  return (
    String(s ?? "")
      .toLowerCase()
      // eslint-disable-next-line no-useless-escape
      .replace(/[_\s\-]+/g, "") // remove unders, spaces, dashes
      .replace(/[^\w]/g, "")
  ); // remove any other non-words chars
}

export function fuzzyMatchColumn(
  suggested: string | null | undefined,
  columns: string[]
) {
  if (!suggested) return null;

  let suggestedCheck = suggested;

  if (Array.isArray(suggested)) suggestedCheck = suggested[0];

  // 1) exact
  if (columns.includes(suggestedCheck)) return suggestedCheck;

  // 2) case-insensitive exact
  const ci = columns.find(
    (c) => c.toLowerCase() === suggestedCheck.toLowerCase()
  );
  if (ci) return ci;

  // 3) normalized match (strip underscores/spaces/case)
  const target = normalizeKey(suggestedCheck);
  const byNorm = columns.find((c) => normalizeKey(c) === target);
  if (byNorm) return byNorm;

  //   partial/contais match: column contains the suggested token or vice-versa
  const token = suggestedCheck.toLowerCase();
  const contains = columns.find(
    (c) => c.toLowerCase().includes(token) || token.includes(c.toLowerCase())
  );
  if (contains) return contains;

  return null;
}
