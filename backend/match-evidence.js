// Quotes are checked against individual decoded source fields, never JSON syntax.
export function matchEvidenceSources(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(matchEvidenceSources);
  if (value && typeof value === "object") return Object.values(value).flatMap(matchEvidenceSources);
  return [];
}

export function containsMatchEvidence(sources, quote) {
  const whitespace = value => String(value).replace(/\s+/gu, " ").trim();
  const needle = whitespace(quote);
  return Boolean(needle) && matchEvidenceSources(sources).some(source => whitespace(source).includes(needle));
}
