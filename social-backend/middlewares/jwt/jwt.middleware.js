import { jwtVerify, createRemoteJWKSet } from 'jose';

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

    // Verify JWT
    const { payload } = await jwtVerify(token, jwks, {
      algorithms: ['ES256'],
      audience: 'authenticated',
      issuer: `${process.env.SUPABASE_URL}/auth/v1`,
    });

    req.user = payload;

    next();
  } catch (err) {
    console.error('JWT verify failed:', err.message);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}
