import { jwtVerify, createRemoteJWKSet } from 'jose';
import authRedis from '../../modules/auth/auth.redis.js';

// URL JWKS của Supabase
const SUPABASE_JWKS_URL = `${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`;
const jwks = createRemoteJWKSet(new URL(SUPABASE_JWKS_URL));

export async function verifySupabaseJWT(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.split(' ')[1];

    let isBlacklisted = false;
    try {
      isBlacklisted = await authRedis.isBlacklisted(token);
    } catch (err) {
      console.warn('[JWT] Redis unavailable, skipping blacklist check:', err.message);
    }
    if (isBlacklisted) {
      return res.status(401).json({ message: 'Token has been revoked' });
    }

    let issuer = process.env.SUPABASE_JWT_ISSUER || `${process.env.SUPABASE_URL}/auth/v1`;
    if (typeof issuer === 'string' && issuer.includes('host.docker.internal')) {
      issuer = [issuer, issuer.replace('host.docker.internal', 'localhost')];
    }

    // Verify JWT
    const { payload } = await jwtVerify(token, jwks, {
      algorithms: ['ES256'],
      audience: 'authenticated',
      issuer,
    });

    req.user = payload;

    next();
  } catch (err) {
    console.error('JWT verify failed:', err.message);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}
