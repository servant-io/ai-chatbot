import { type NextRequest, NextResponse } from 'next/server';
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

    // Check role - members are blocked from downloading
    if (isTranscriptContentRestrictedRole(payload.role)) {
      return NextResponse.json(
        {
          error:
            'Access denied. Members cannot download transcript content.',
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
      .select(FULL_TRANSCRIPT_TEXT_SELECT)
      .eq('id', transcriptId);

    // Apply participant filter for non-admin roles (admin sees all)
    if (payload.role !== 'admin') {
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

    const transcript = parseTranscriptTextRecord(data);
    const markdown = formatTranscriptMarkdown(transcript);

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
