import type { NextRequest } from 'next/server';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const debug = process.env.TRANSCRIPTS_DEBUG === '1';
  const logResponse = (
    label: string,
    response: Response,
    payload?: unknown,
  ) => {
    if (!debug) {
      return;
    }

    console.log('transcripts route response', {
      label,
      payload,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers),
      isResponseInstance: response instanceof Response,
      responseConstructor: response.constructor?.name,
      responseTag: Object.prototype.toString.call(response),
      responseHasBody: response.body !== null,
      responseName: Response.name,
    });
  };

  console.log('transcripts route request', {
    url: request.url,
    method: request.method,
    xWorkosMiddleware: request.headers.get('x-workos-middleware'),
    xMiddlewareSubrequest: request.headers.get('x-middleware-subrequest'),
  });
  let session:
    | Awaited<ReturnType<typeof withAuth>>
    | undefined;
  try {
    if (debug) {
      console.log('transcripts route before withAuth');
    }
    session = await withAuth();
    if (debug) {
      console.log('transcripts route session', {
        hasUser: Boolean(session?.user),
        sessionId: session?.sessionId,
        organizationId: session?.organizationId,
        role: session?.role,
        roles: session?.roles,
        permissions: session?.permissions,
      });
    }

    if (!session?.user) {
      const payload = { error: 'Unauthorized' };
      const response = Response.json(payload, { status: 401 });
      logResponse('unauthorized', response, payload);
      return response;
    }
    const { user } = session;

    // Parse pagination parameters
    const { searchParams } = new URL(request.url);
    const page = Number.parseInt(searchParams.get('page') || '1', 10);
    const limit = Number.parseInt(searchParams.get('limit') || '20', 10);
    const offset = (page - 1) * limit;

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      const payload = { error: 'Database configuration missing' };
      const response = Response.json(payload, { status: 500 });
      logResponse('missing-db-config', response, payload);
      return response;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Build base query
    let baseQuery = supabase
      .from('transcripts')
      .select(
        'id, recording_start, summary, projects, clients, meeting_type, extracted_participants, verified_participant_emails',
      );

    // Only return transcripts where user is a verified participant (applies to all users)
    if (user.email) {
      baseQuery = baseQuery.contains('verified_participant_emails', [
        user.email,
      ]);
    }

    // Get total count for pagination - match main query filtering
    let countQuery = supabase
      .from('transcripts')
      .select('*', { count: 'exact', head: true });

    if (user.email) {
      countQuery = countQuery.contains('verified_participant_emails', [
        user.email,
      ]);
    }

    const { count, error: countError } = await countQuery;
    console.log('transcripts route count result', {
      count,
      countError,
    });

    // Get paginated results
    const { data, error } = await baseQuery
      .order('recording_start', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Database error:', error);
      const payload = { error: 'Failed to fetch transcripts' };
      const response = Response.json(payload, { status: 500 });
      logResponse('query-error', response, payload);
      return response;
    }

    const payload = {
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        hasNext: page < Math.ceil((count || 0) / limit),
        hasPrev: page > 1,
      },
    };
    const response = Response.json(payload);
    logResponse('success', response, payload);
    return response;
  } catch (error) {
    console.error('API error:', error);
    if (debug) {
      console.log('transcripts route session on error', {
        hasSession: Boolean(session),
        hasUser: Boolean(session?.user),
        sessionId: session?.sessionId,
      });
    }
    const payload = { error: 'Internal server error' };
    const response = Response.json(payload, { status: 500 });
    logResponse('catch', response, payload);
    return response;
  }
}
