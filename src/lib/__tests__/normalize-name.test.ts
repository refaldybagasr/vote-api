import { normalizeName } from '../normalize-name';

describe('normalizeName', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeName('  Budi   Santoso ')).toEqual({
      displayName: 'Budi Santoso',
      normalizedName: 'budi santoso',
    });
  });

  it('is case-insensitive for the normalized key', () => {
    expect(normalizeName('BUDI')?.normalizedName).toBe('budi');
  });

  it('applies NFKC normalization', () => {
    expect(normalizeName('Ｂｕｄｉ')?.normalizedName).toBe('budi');
  });

  it('strips zero-width characters', () => {
    expect(normalizeName('Bu​di')?.normalizedName).toBe('budi');
  });

  it('rejects empty input', () => {
    expect(normalizeName('')).toBeNull();
  });

  it('rejects whitespace-only input', () => {
    expect(normalizeName('   ')).toBeNull();
  });

  it('rejects input longer than 50 characters after normalization', () => {
    expect(normalizeName('a'.repeat(51))).toBeNull();
  });

  it.each(['<script>', '=cmd', '08123'])('rejects disallowed characters in %s', (input) => {
    expect(normalizeName(input)).toBeNull();
  });

  it('allows letters, spaces, periods, apostrophes and hyphens', () => {
    expect(normalizeName("Jean-Luc O'Brien Jr.")).toEqual({
      displayName: "Jean-Luc O'Brien Jr.",
      normalizedName: "jean-luc o'brien jr.",
    });
  });
});
