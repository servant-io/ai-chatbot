import { NextResponse } from 'next/server';
import { withAuth } from '@workos-inc/authkit-nextjs';
import {
  getDatabaseUserFromWorkOS,
  listAudioTranscriptionsByUserId,
} from '@/lib/db/queries';

export async function GET(request: Request) {
  console.log('audio transcriptions route request', {
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers),
    xWorkosMiddleware: request.headers.get('x-workos-middleware'),
    xMiddlewareSubrequest: request.headers.get('x-middleware-subrequest'),
  });
  const session = await withAuth();
  console.log('audio transcriptions route session', {
    user: session.user,
    sessionId: session.sessionId,
    organizationId: session.organizationId,
    role: session.role,
    roles: session.roles,
    permissions: session.permissions,
    entitlements: session.entitlements,
    featureFlags: session.featureFlags,
    impersonator: session.impersonator,
  });

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Number.parseInt(searchParams.get('limit') || '20', 10);

  const dbUser = await getDatabaseUserFromWorkOS({
    id: session.user.id,
    email: session.user.email,
    firstName: session.user.firstName || undefined,
    lastName: session.user.lastName || undefined,
  });

  if (!dbUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const rows = await listAudioTranscriptionsByUserId({
    userId: dbUser.id,
    limit,
  });

  return NextResponse.json(rows);
}
