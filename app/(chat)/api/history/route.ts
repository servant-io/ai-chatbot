import { withAuth } from '@workos-inc/authkit-nextjs';
import type { NextRequest } from 'next/server';
import { getChatsByUserId, getDatabaseUserFromWorkOS } from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';

const redactHeaders = (
  headers: Headers,
): Record<string, string | undefined> => {
  const rawHeaders = Object.fromEntries(headers.entries());
  return {
    ...rawHeaders,
    authorization: rawHeaders.authorization ? '[redacted]' : undefined,
    cookie: rawHeaders.cookie ? '[redacted]' : undefined,
    'x-workos-session': rawHeaders['x-workos-session']
      ? '[redacted]'
      : undefined,
  };
};

const getConstructorName = (value: unknown) => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const constructor = (value as { constructor?: { name?: string } })
    .constructor;

  return typeof constructor?.name === 'string' ? constructor.name : null;
};

const logResponse = (label: string, response: unknown) => {
  console.log('[history] response', {
    label,
    type: typeof response,
    isResponse: response instanceof Response,
    constructorName: getConstructorName(response),
    tag: Object.prototype.toString.call(response),
  });
  console.log('[history] response raw', response);
};

export async function GET(request: NextRequest) {
  console.log('[history] request', {
    method: request.method,
    url: request.url,
    headers: redactHeaders(request.headers),
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
    logResponse('bad_request:api:invalid_pagination', response);
    return response;
  }

  const session = await withAuth();
  console.log('[history] withAuth', {
    ...session,
    accessToken: session.accessToken ? '[redacted]' : session.accessToken,
  });

  if (!session?.user) {
    const response = new ChatSDKError('unauthorized:chat').toResponse();
    logResponse('unauthorized:chat', response);
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

    console.log('[history] databaseUser', databaseUser);

    if (!databaseUser) {
      const response = new ChatSDKError(
        'not_found:history',
        'User not found',
      ).toResponse();
      logResponse('not_found:history', response);
      return response;
    }

    const chats = await getChatsByUserId({
      id: databaseUser.id,
      limit,
      startingAfter,
      endingBefore,
    });

    console.log('[history] chats', chats);

    const response = Response.json(chats);
    logResponse('history:success', response);
    return response;
  } catch (error) {
    console.error('Error in history API:', error);
    const response = new ChatSDKError(
      'bad_request:database',
      'Database error',
    ).toResponse();
    logResponse('bad_request:database', response);
    return response;
  }
}
