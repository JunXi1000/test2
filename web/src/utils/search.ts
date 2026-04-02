export function normalizeForSearch(text: unknown) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[\s\-_/.,:]+/g, '')
    .trim()
}

