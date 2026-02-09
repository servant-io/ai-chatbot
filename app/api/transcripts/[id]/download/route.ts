import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyDownloadToken } from '@/lib/mcp/download-token';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const debug = process.env.TRANSCRIPT_DOWNLOAD_DEBUG === '1';

  const logResponse = (
    label: string,
    response: Response,
    payload?: unknown,
  ) => {
    if (!debug) {
      return;
    }

    console.log('transcript download route response', {
      label,
      payload,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers),
      isResponseInstance: response instanceof Response,
      isNextResponseInstance: response instanceof NextResponse,
      responseConstructor: response.constructor?.name,
      responseTag: Object.prototype.toString.call(response),
      responseHasBody: response.body !== null,
    });
  };

  try {
    const sanitizedUrl = new URL(request.url);
    const tokenFromUrl = sanitizedUrl.searchParams.get('token');
    if (tokenFromUrl) {
      sanitizedUrl.searchParams.set('token', '[redacted]');
    }
    if (debug) {
      console.log('transcript download route request', {
        method: request.method,
        url: sanitizedUrl.toString(),
        tokenPresent: Boolean(tokenFromUrl),
        tokenLength: tokenFromUrl?.length ?? 0,
      });
    }

    const { id } = await params;
    const transcriptId = Number.parseInt(id, 10);

    if (Number.isNaN(transcriptId)) {
      const payload = { error: 'Invalid transcript ID' };
      const response = NextResponse.json(payload, { status: 400 });
      logResponse('invalid-transcript-id', response, payload);
      return response;
    }

    const token = request.nextUrl.searchParams.get('token');
    if (!token) {
      const payload = { error: 'Missing download token' };
      const response = NextResponse.json(payload, { status: 401 });
      logResponse('missing-token', response, payload);
      return response;
    }

    const payload = await verifyDownloadToken(token);
    if (debug) {
      console.log('transcript download route token payload', payload);
    }
    if (!payload) {
      const errorPayload = { error: 'Invalid or expired download token' };
      const response = NextResponse.json(errorPayload, { status: 401 });
      logResponse('invalid-token', response, errorPayload);
      return response;
    }

    // Verify transcript ID matches token
    if (payload.transcriptId !== transcriptId) {
      const errorPayload = {
        error: 'Token does not match requested transcript',
      };
      const response = NextResponse.json(errorPayload, { status: 403 });
      logResponse('token-mismatch', response, errorPayload);
      return response;
    }

    // Check role - members are blocked from downloading
    if (payload.role === 'member') {
      const errorPayload = {
        error:
          'Access denied. Members cannot download transcript content.',
      };
      const response = NextResponse.json(errorPayload, { status: 403 });
      logResponse('role-blocked', response, errorPayload);
      return response;
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      const errorPayload = {
        error: 'Supabase credentials not configured',
      };
      const response = NextResponse.json(errorPayload, { status: 500 });
      logResponse('missing-supabase-config', response, errorPayload);
      return response;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    let query = supabase
      .from('transcripts')
      .select(
        'id, recording_start, summary, transcript_content, projects, clients, meeting_type, extracted_participants, verified_participant_emails',
      )
      .eq('id', transcriptId);

    // Apply participant filter for non-admin roles (admin sees all)
    if (payload.role !== 'admin') {
      query = query.contains('verified_participant_emails', [payload.email]);
    }

    const { data, error } = await query.single();
    if (debug) {
      console.log('transcript download route supabase result', {
        data,
        error,
      });
    } else {
      console.log('transcript download route supabase result', {
        transcriptId,
        hasData: Boolean(data),
        error,
      });
    }

    if (error) {
      if (error.code === 'PGRST116') {
        const errorPayload = {
          error: 'Transcript not found or access denied',
        };
        const response = NextResponse.json(errorPayload, { status: 404 });
        logResponse('not-found-or-denied', response, errorPayload);
        return response;
      }
      const errorPayload = {
        error: `Database error: ${error.message}`,
      };
      const response = NextResponse.json(errorPayload, { status: 500 });
      logResponse('db-error', response, errorPayload);
      return response;
    }

    if (!data) {
      const errorPayload = {
        error: 'Transcript not found or access denied',
      };
      const response = NextResponse.json(errorPayload, { status: 404 });
      logResponse('no-data', response, errorPayload);
      return response;
    }

    // Format the transcript as markdown
    const recordingDate = data.recording_start
      ? new Date(data.recording_start).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : 'Unknown';

    const participants = data.extracted_participants
      ? (data.extracted_participants as string[]).join(', ')
      : 'Unknown';

    const projects = data.projects
      ? (data.projects as string[]).join(', ')
      : 'None';

    const clients = data.clients
      ? (data.clients as string[]).join(', ')
      : 'None';

    const transcriptContent =
      typeof data.transcript_content === 'object' &&
      data.transcript_content !== null &&
      'cleaned' in data.transcript_content
        ? (data.transcript_content as { cleaned: string }).cleaned
        : 'No transcript content available';

    const markdown = `# Transcript ${data.id}

**Date**: ${recordingDate}
**Meeting Type**: ${data.meeting_type || 'Unknown'}
**Participants**: ${participants}
**Projects**: ${projects}
**Clients**: ${clients}

## Summary

${data.summary || 'No summary available'}

## Content

${transcriptContent}
`;

    const response = new NextResponse(markdown, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="transcript-${transcriptId}.md"`,
      },
    });
    logResponse('success', response);
    return response;
  } catch (err) {
    console.error('Download route error:', err);
    const payload = { error: 'Internal server error' };
    const response = NextResponse.json(payload, { status: 500 });
    logResponse('catch', response, payload);
    return response;
  }
}
