import jwt from 'jsonwebtoken';
import { ManualClock } from '../clock';
import { InvalidAccessTokenError, signAccessToken, verifyAccessToken } from '../jwt';

const SECRET = 'a-sufficiently-long-test-secret-value';
const ISSUER = 'vote-api';
const AUDIENCE = 'vote-web';
const CLAIMS = { sub: 'user-1', role: 'user', tv: 1 };

function config(clock: ManualClock) {
  return { secret: SECRET, issuer: ISSUER, audience: AUDIENCE, clock };
}

describe('jwt helper', () => {
  it('signs and verifies a valid token', () => {
    const clock = new ManualClock(new Date('2026-01-01T00:00:00.000Z'));
    const token = signAccessToken(CLAIMS, 900, config(clock));

    expect(verifyAccessToken(token, config(clock))).toEqual(CLAIMS);
  });

  it('rejects an expired token', () => {
    const clock = new ManualClock(new Date('2026-01-01T00:00:00.000Z'));
    const token = signAccessToken(CLAIMS, 900, config(clock));

    clock.advance(901 * 1000);

    expect(() => verifyAccessToken(token, config(clock))).toThrow(InvalidAccessTokenError);
  });

  it('rejects a token signed with a different secret', () => {
    const clock = new ManualClock(new Date('2026-01-01T00:00:00.000Z'));
    const token = signAccessToken(CLAIMS, 900, config(clock));

    expect(() =>
      verifyAccessToken(token, { ...config(clock), secret: 'a-completely-different-secret' }),
    ).toThrow(InvalidAccessTokenError);
  });

  it('rejects a token with a tampered payload', () => {
    const clock = new ManualClock(new Date('2026-01-01T00:00:00.000Z'));
    const token = signAccessToken(CLAIMS, 900, config(clock));
    const [header, , signature] = token.split('.');
    const tamperedPayload = Buffer.from(JSON.stringify({ ...CLAIMS, role: 'admin' })).toString(
      'base64url',
    );

    expect(() =>
      verifyAccessToken(`${header}.${tamperedPayload}.${signature}`, config(clock)),
    ).toThrow(InvalidAccessTokenError);
  });

  it('rejects a token signed with alg "none"', () => {
    const clock = new ManualClock(new Date('2026-01-01T00:00:00.000Z'));
    const noneToken = jwt.sign(CLAIMS, '', {
      algorithm: 'none',
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    expect(() => verifyAccessToken(noneToken, config(clock))).toThrow(InvalidAccessTokenError);
  });

  it('rejects a token with the wrong issuer', () => {
    const clock = new ManualClock(new Date('2026-01-01T00:00:00.000Z'));
    const token = signAccessToken(CLAIMS, 900, { ...config(clock), issuer: 'someone-else' });

    expect(() => verifyAccessToken(token, config(clock))).toThrow(InvalidAccessTokenError);
  });

  it('rejects a token with the wrong audience', () => {
    const clock = new ManualClock(new Date('2026-01-01T00:00:00.000Z'));
    const token = signAccessToken(CLAIMS, 900, { ...config(clock), audience: 'someone-else' });

    expect(() => verifyAccessToken(token, config(clock))).toThrow(InvalidAccessTokenError);
  });
});
