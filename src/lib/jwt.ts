import jwt from 'jsonwebtoken';
import type { Clock } from './clock';

export interface JwtClaims {
  sub: string;
  role: string;
  tv: number;
}

export interface JwtConfig {
  secret: string;
  issuer: string;
  audience: string;
  clock: Clock;
}

export class InvalidAccessTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidAccessTokenError';
  }
}

export function signAccessToken(claims: JwtClaims, ttlSeconds: number, config: JwtConfig): string {
  const iat = Math.floor(config.clock.now().getTime() / 1000);
  const exp = iat + ttlSeconds;

  return jwt.sign({ ...claims, iat, exp }, config.secret, {
    algorithm: 'HS256',
    issuer: config.issuer,
    audience: config.audience,
    noTimestamp: true,
  });
}

export function verifyAccessToken(token: string, config: JwtConfig): JwtClaims {
  const clockTimestamp = Math.floor(config.clock.now().getTime() / 1000);

  let decoded: jwt.JwtPayload | string;
  try {
    decoded = jwt.verify(token, config.secret, {
      algorithms: ['HS256'],
      issuer: config.issuer,
      audience: config.audience,
      clockTimestamp,
      clockTolerance: 5,
    });
  } catch (error) {
    throw new InvalidAccessTokenError(error instanceof Error ? error.message : 'Invalid token');
  }

  if (!isJwtClaims(decoded)) {
    throw new InvalidAccessTokenError('Malformed token payload');
  }

  return { sub: decoded.sub, role: decoded.role, tv: decoded.tv };
}

function isJwtClaims(payload: jwt.JwtPayload | string): payload is JwtClaims & jwt.JwtPayload {
  return (
    typeof payload === 'object' &&
    typeof payload.sub === 'string' &&
    typeof payload.role === 'string' &&
    typeof payload.tv === 'number'
  );
}
