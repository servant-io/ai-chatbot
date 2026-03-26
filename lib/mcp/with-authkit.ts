import * as jose from 'jose';
import { getWorkOS } from '@workos-inc/authkit-nextjs';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';

export type WorkOSUser = Awaited<
  ReturnType<ReturnType<typeof getWorkOS>['userManagement']['getUser']>
>;

const authkitDomain = process.env.AUTHKIT_DOMAIN;
const workosClientId = process.env.WORKOS_CLIENT_ID;

if (!authkitDomain) {
  throw new Error('AUTHKIT_DOMAIN environment variable is required');
}

if (!workosClientId) {
  throw new Error('WORKOS_CLIENT_ID environment variable is required');
}

const jwks = jose.createRemoteJWKSet(
  new URL(getWorkOS().userManagement.getJwksUrl(workosClientId)),
);

const acceptedIssuers = [
  `https://${authkitDomain}`,
  `https://api.workos.com/user_management/${workosClientId}`,
];

export const verifyToken = async (
  req: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> => {
  if (!bearerToken) return undefined;

  const { payload } = await jose.jwtVerify(bearerToken, jwks, {
    issuer: acceptedIssuers,
  });

  if (!payload.sub || typeof payload.sub !== 'string') return undefined;

  const workos = getWorkOS();
  const user = await workos.userManagement.getUser(payload.sub);

  // Fetch role from organization membership
  let role: string | null = null;
  const orgId = typeof payload.org_id === 'string' ? payload.org_id : null;

  if (orgId) {
    try {
      const memberships =
        await workos.userManagement.listOrganizationMemberships({
          userId: payload.sub,
          organizationId: orgId,
        });

      if (memberships.data.length > 0) {
        role = memberships.data[0].role?.slug || null;
      }
    } catch (err) {
      console.error('🔐 MCP Auth - Failed to fetch org membership:', err);
    }
  }

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
      role,
    },
  };
};
