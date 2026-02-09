import { withAuth } from '@workos-inc/authkit-nextjs';
import type { NextRequest } from 'next/server';
import { getChatsByUserId, getDatabaseUserFromWorkOS } from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const debug = process.env.HISTORY_DEBUG === '1';
  const logResponse = (label: string, response: Response) => {
    if (!debug) {
      return;
    }

    console.log('history route response', {
      label,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers),
      isResponseInstance: response instanceof Response,
      responseConstructor: response.constructor?.name,
      responseTag: Object.prototype.toString.call(response),
      responseHasBody: response.body !== null,
    });
  };

  console.log('history route request', {
    url: request.url,
    method: request.method,
    xWorkosMiddleware: request.headers.get('x-workos-middleware'),
    xMiddlewareSubrequest: request.headers.get('x-middleware-subrequest'),
  });
  const { searchParams } = request.nextUrl;

  const limit = Number.parseInt(searchParams.get('limit') || '10');
  const startingAfter = searchParams.get('starting_after');
  const endingBefore = searchParams.get('ending_before');

  if (startingAfter && endingBefore) {
    const response = new ChatSDKError(
      'bad_request:api',
      'Only one of starting_after or ending_before can be provided.',
    ).toResponse();
    logResponse('bad-request-pagination', response);
    return response;
  }

  const session = await withAuth();
  console.log('history route session', {
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
    const response = new ChatSDKError('unauthorized:chat').toResponse();
    logResponse('unauthorized', response);
    return response;
  }

  try {
    // Get the database user from the WorkOS user
    const databaseUser = await getDatabaseUserFromWorkOS({
      id: session.user.id,
      email: session.user.email,
      firstName: session.user.firstName ?? undefined,
      lastName: session.user.lastName ?? undefined,
    });

    if (!databaseUser) {
      const response = new ChatSDKError(
        'not_found:history',
        'User not found',
      ).toResponse();
      logResponse('user-not-found', response);
      return response;
    }

    const chats = await getChatsByUserId({
      id: databaseUser.id,
      limit,
      startingAfter,
      endingBefore,
    });

    const response = Response.json(chats);
    logResponse('success', response);
    return response;
  } catch (error) {
    console.error('Error in history API:', error);
    const response = new ChatSDKError(
      'bad_request:database',
      'Database error',
    ).toResponse();
    logResponse('catch', response);
    return response;
  }
}
