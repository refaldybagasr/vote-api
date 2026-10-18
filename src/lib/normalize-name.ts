const ALLOWED_NAME_PATTERN = /^[\p{L} .'-]+$/u;
const ZERO_WIDTH_PATTERN = /\p{Cf}/gu;
const WHITESPACE_PATTERN = /\s+/g;
const MIN_LENGTH = 1;
const MAX_LENGTH = 50;

export interface NormalizedName {
  displayName: string;
  normalizedName: string;
}

export function normalizeName(raw: string): NormalizedName | null {
  const cleaned = raw
    .normalize('NFKC')
    .replace(ZERO_WIDTH_PATTERN, '')
    .trim()
    .replace(WHITESPACE_PATTERN, ' ');

  if (cleaned.length < MIN_LENGTH || cleaned.length > MAX_LENGTH) {
    return null;
  }

  if (!ALLOWED_NAME_PATTERN.test(cleaned)) {
    return null;
  }

  return {
    displayName: cleaned,
    normalizedName: cleaned.toLowerCase(),
  };
}
