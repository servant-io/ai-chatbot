import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyDownloadToken } from '@/lib/mcp/download-token';
import {
  FULL_TRANSCRIPT_TEXT_SELECT,
  formatTranscriptMarkdown,
  isTranscriptContentRestrictedRole,
  parseTranscriptTextRecord,
} from '@/lib/transcripts/content';

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
      const response = Response.json(payload, { status: 400 });
      logResponse('invalid-transcript-id', response, payload);
      return response;
    }

    const token = request.nextUrl.searchParams.get('token');
    if (!token) {
      const payload = { error: 'Missing download token' };
      const response = Response.json(payload, { status: 401 });
      logResponse('missing-token', response, payload);
      return response;
    }

    const payload = await verifyDownloadToken(token);
    if (debug) {
      console.log('transcript download route token payload', {
        role: payload?.role,
        transcriptId: payload?.transcriptId,
      });
    }
    if (!payload) {
      const errorPayload = { error: 'Invalid or expired download token' };
      const response = Response.json(errorPayload, { status: 401 });
      logResponse('invalid-token', response, errorPayload);
      return response;
    }

    // Verify transcript ID matches token
    if (payload.transcriptId !== transcriptId) {
      const errorPayload = {
        error: 'Token does not match requested transcript',
      };
      const response = Response.json(errorPayload, { status: 403 });
      logResponse('token-mismatch', response, errorPayload);
      return response;
    }

    // Check role - members are blocked from downloading
    if (isTranscriptContentRestrictedRole(payload.role)) {
      const errorPayload = {
        error:
          'Access denied. Members cannot download transcript content.',
      };
      const response = Response.json(errorPayload, { status: 403 });
      logResponse('role-blocked', response, errorPayload);
      return response;
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      const errorPayload = {
        error: 'Supabase credentials not configured',
      };
      const response = Response.json(errorPayload, { status: 500 });
      logResponse('missing-supabase-config', response, errorPayload);
      return response;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    let query = supabase
      .from('transcripts')
      .select(`${FULL_TRANSCRIPT_TEXT_SELECT}, verified_participant_emails`)
      .eq('id', transcriptId);

    // Apply participant filter for non-admin roles (admin sees all)
    if (payload.role !== 'admin') {
      query = query.contains('verified_participant_emails', [payload.email]);
    }

    const { data, error } = await query.single();
    if (debug) {
      const transcriptContent =
        typeof data?.transcript_content === 'object' &&
        data.transcript_content !== null
          ? (data.transcript_content as Record<string, unknown>)
          : null;

      const transcriptRaw =
        transcriptContent && typeof transcriptContent.raw === 'string'
          ? transcriptContent.raw
          : null;

      const transcriptCleaned =
        transcriptContent && typeof transcriptContent.cleaned === 'string'
          ? transcriptContent.cleaned
          : null;

      console.log('transcript download route supabase result', {
        error,
        hasData: Boolean(data),
        dataSummary: data
          ? {
              id: data.id,
              recording_start: data.recording_start,
              summaryLength:
                typeof data.summary === 'string' ? data.summary.length : null,
              meetingType: data.meeting_type,
              projectsCount: Array.isArray(data.projects)
                ? data.projects.length
                : null,
              extractedParticipantsCount: Array.isArray(
                data.extracted_participants,
              )
                ? data.extracted_participants.length
                : null,
              verifiedParticipantEmailsCount: Array.isArray(
                data.verified_participant_emails,
              )
                ? data.verified_participant_emails.length
                : null,
              transcriptRawLength: transcriptRaw?.length ?? null,
              transcriptCleanedLength: transcriptCleaned?.length ?? null,
            }
          : null,
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
        const response = Response.json(errorPayload, { status: 404 });
        logResponse('not-found-or-denied', response, errorPayload);
        return response;
      }
      const errorPayload = {
        error: `Database error: ${error.message}`,
      };
      const response = Response.json(errorPayload, { status: 500 });
      logResponse('db-error', response, errorPayload);
      return response;
    }

    if (!data) {
      const errorPayload = {
        error: 'Transcript not found or access denied',
      };
      const response = Response.json(errorPayload, { status: 404 });
      logResponse('no-data', response, errorPayload);
      return response;
    }

    const transcript = parseTranscriptTextRecord(data);
    const markdown = formatTranscriptMarkdown(transcript);

    const response = new Response(markdown, {
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
    const response = Response.json(payload, { status: 500 });
    logResponse('catch', response, payload);
    return response;
  }
}
