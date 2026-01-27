import * as jose from 'jose';

export interface DownloadTokenPayload {
  sub: string; // user ID
  email: string;
  role: string;
  transcriptId: number;
}

const DOWNLOAD_TOKEN_EXPIRY = '5m';

function getSecret(): Uint8Array {
  const secret = process.env.WORKOS_COOKIE_PASSWORD;
  if (!secret) {
    throw new Error('WORKOS_COOKIE_PASSWORD environment variable is required');
  }
  return new TextEncoder().encode(secret);
}

export async function createDownloadToken(
  payload: DownloadTokenPayload,
): Promise<string> {
  const secret = getSecret();

  const jwt = await new jose.SignJWT({
    email: payload.email,
    role: payload.role,
    transcriptId: payload.transcriptId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(DOWNLOAD_TOKEN_EXPIRY)
    .sign(secret);

  return jwt;
}

export async function verifyDownloadToken(
  token: string,
): Promise<DownloadTokenPayload | null> {
  try {
    const secret = getSecret();
    const { payload } = await jose.jwtVerify(token, secret);

    if (
      typeof payload.sub !== 'string' ||
      typeof payload.email !== 'string' ||
      typeof payload.role !== 'string' ||
      typeof payload.transcriptId !== 'number'
    ) {
      return null;
    }

    return {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      transcriptId: payload.transcriptId,
    };
  } catch {
    return null;
  }
}
