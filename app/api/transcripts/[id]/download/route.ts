import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyDownloadToken } from '@/lib/mcp/download-token';
import { isTranscriptSharedWithUserEmail } from '@/lib/db/queries';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const transcriptId = Number.parseInt(id, 10);

    if (Number.isNaN(transcriptId)) {
      return NextResponse.json(
        { error: 'Invalid transcript ID' },
        { status: 400 },
      );
    }

    const token = request.nextUrl.searchParams.get('token');
    if (!token) {
      return NextResponse.json(
        { error: 'Missing download token' },
        { status: 401 },
      );
    }

    const payload = await verifyDownloadToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid or expired download token' },
        { status: 401 },
      );
    }

    // Verify transcript ID matches token
    if (payload.transcriptId !== transcriptId) {
      return NextResponse.json(
        { error: 'Token does not match requested transcript' },
        { status: 403 },
      );
    }

    const isShared = await isTranscriptSharedWithUserEmail({
      transcriptId,
      userEmail: payload.email,
    });

    // Check role - members can download only when shared
    if (payload.role === 'member' && !isShared) {
      return NextResponse.json(
        {
          error: 'Access denied. Members can only download shared transcripts.',
        },
        { status: 403 },
      );
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Supabase credentials not configured' },
        { status: 500 },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    let query = supabase
      .from('transcripts')
      .select(
        'id, recording_start, summary, transcript_content, projects, clients, meeting_type, extracted_participants, verified_participant_emails',
      )
      .eq('id', transcriptId);

    // Apply participant filter for non-admin roles (admin sees all)
    if (payload.role !== 'admin' && !isShared) {
      query = query.contains('verified_participant_emails', [payload.email]);
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Transcript not found or access denied' },
          { status: 404 },
        );
      }
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Transcript not found or access denied' },
        { status: 404 },
      );
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

    return new NextResponse(markdown, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="transcript-${transcriptId}.md"`,
      },
    });
  } catch (err) {
    console.error('Download route error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
