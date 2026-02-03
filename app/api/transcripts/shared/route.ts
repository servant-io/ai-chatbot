import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { createClient } from '@supabase/supabase-js';
import { getSharedTranscriptTeamsByUserEmail } from '@/lib/db/queries';

export async function GET(request: NextRequest) {
  try {
    const session = await withAuth();
    const email = session.user?.email;

    if (!email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Number.parseInt(searchParams.get('page') || '1', 10);
    const limit = Number.parseInt(searchParams.get('limit') || '20', 10);
    const offset = (page - 1) * limit;

    const shareRows = await getSharedTranscriptTeamsByUserEmail({
      userEmail: email,
    });

    const sharedByTranscriptId = new Map<number, Array<string>>();
    for (const row of shareRows) {
      const teams = sharedByTranscriptId.get(row.transcriptId);
      if (teams) {
        teams.push(row.teamName);
      } else {
        sharedByTranscriptId.set(row.transcriptId, [row.teamName]);
      }
    }

    const sharedTranscriptIds = Array.from(sharedByTranscriptId.keys());
    const total = sharedTranscriptIds.length;

    if (sharedTranscriptIds.length === 0) {
      return NextResponse.json({
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Database configuration missing' },
        { status: 500 },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase
      .from('transcripts')
      .select(
        'id, recording_start, summary, projects, clients, meeting_type, extracted_participants, verified_participant_emails',
      )
      .in('id', sharedTranscriptIds)
      .order('recording_start', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch shared transcripts' },
        { status: 500 },
      );
    }

    const items = (data ?? []).map((row) => ({
      ...row,
      can_view_full_content: true,
      shared_in_teams: sharedByTranscriptId.get(row.id) ?? [],
    }));

    return NextResponse.json({
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error('API /transcripts/shared GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shared transcripts' },
      { status: 500 },
    );
  }
}
