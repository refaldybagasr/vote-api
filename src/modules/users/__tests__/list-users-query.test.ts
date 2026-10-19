import { parseListUsersQuery } from '../list-users-query';

describe('parseListUsersQuery', () => {
  it('defaults page and limit when nothing is given', () => {
    expect(parseListUsersQuery({})).toEqual({ page: 1, limit: 20 });
  });

  it.each(['abc', '-1', '9999'])('clamps an invalid/out-of-range limit=%s into [1, 100]', (raw) => {
    const { limit } = parseListUsersQuery({ limit: raw });
    expect(limit).toBeGreaterThanOrEqual(1);
    expect(limit).toBeLessThanOrEqual(100);
  });

  it('accepts a valid limit within range', () => {
    expect(parseListUsersQuery({ limit: '50' }).limit).toBe(50);
  });

  it('clamps page below 1 up to 1', () => {
    expect(parseListUsersQuery({ page: '-5' }).page).toBe(1);
  });

  it('clamps a non-numeric page to the default', () => {
    expect(parseListUsersQuery({ page: 'abc' }).page).toBe(1);
  });
});
