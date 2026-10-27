// Built-in product categories (stored by id, translated for display). Custom categories are stored as typed.

export const KNOWN_CATEGORIES = ['electronics', 'tools', 'packaging', 'office', 'safety', 'cleaning'];

/**
 * Maps typed text to a known category id when it matches an id or any translated label
 * (case-insensitive); otherwise returns the trimmed text unchanged.
 * `labelsById` is { id: [label, ...] } across all languages.
 */
export function resolveCategory(input, labelsById) {
  const text = String(input ?? '').trim();
  const needle = text.toLowerCase();
  for (const id of KNOWN_CATEGORIES) {
    if (id === needle || (labelsById[id] || []).some((l) => l.toLowerCase() === needle)) return id;
  }
  return text;
}
