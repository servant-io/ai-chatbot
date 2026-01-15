import * as jose from 'jose';
import { getWorkOS } from '@workos-inc/authkit-nextjs';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';

export type WorkOSUser = Awaited<
  ReturnType<ReturnType<typeof getWorkOS>['userManagement']['getUser']>
>;

const authkitDomain = process.env.AUTHKIT_DOMAIN;

if (!authkitDomain) {
  throw new Error('AUTHKIT_DOMAIN environment variable is required');
}

const jwks = jose.createRemoteJWKSet(
  new URL(`https://${authkitDomain}/oauth2/jwks`),
);

export const verifyToken = async (
  req: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> => {
  if (!bearerToken) return undefined;

  const { payload } = await jose.jwtVerify(bearerToken, jwks, {
    issuer: `https://${authkitDomain}`,
  });

  if (!payload.sub || typeof payload.sub !== 'string') return undefined;

  const workos = getWorkOS();
  const user = await workos.userManagement.getUser(payload.sub);

  return {
    token: bearerToken,
    scopes: ['read:transcripts'],
    clientId: user.id,
    extra: {
      user,
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      claims: payload,
    },
  };
};
