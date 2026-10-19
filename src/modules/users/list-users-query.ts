const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MIN_LIMIT = 1;
const MAX_LIMIT = 100;

export interface ListUsersQuery {
  page: number;
  limit: number;
}

export function parseListUsersQuery(raw: { page?: unknown; limit?: unknown }): ListUsersQuery {
  return {
    page: Math.max(toFiniteIntOr(raw.page, DEFAULT_PAGE), 1),
    limit: clamp(toFiniteIntOr(raw.limit, DEFAULT_LIMIT), MIN_LIMIT, MAX_LIMIT),
  };
}

function toFiniteIntOr(raw: unknown, fallback: number): number {
  if (raw === undefined) {
    return fallback;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}
