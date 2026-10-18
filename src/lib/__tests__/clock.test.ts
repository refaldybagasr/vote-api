import { ManualClock, systemClock } from '../clock';

describe('systemClock', () => {
  it('returns the current wall-clock time', () => {
    const before = Date.now();
    const now = systemClock.now().getTime();
    const after = Date.now();

    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(after);
  });
});

describe('ManualClock', () => {
  it('returns the fixed time it was created with', () => {
    const clock = new ManualClock(new Date('2026-01-01T00:00:00.000Z'));

    expect(clock.now()).toEqual(new Date('2026-01-01T00:00:00.000Z'));
  });

  it('advances by the given number of milliseconds', () => {
    const clock = new ManualClock(new Date('2026-01-01T00:00:00.000Z'));

    clock.advance(1000);

    expect(clock.now()).toEqual(new Date('2026-01-01T00:00:01.000Z'));
  });

  it('can be set to an arbitrary time', () => {
    const clock = new ManualClock(new Date('2026-01-01T00:00:00.000Z'));

    clock.set(new Date('2030-06-15T12:00:00.000Z'));

    expect(clock.now()).toEqual(new Date('2030-06-15T12:00:00.000Z'));
  });
});
