import { type NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { z } from 'zod/v4';
import { createClient } from '@supabase/supabase-js';
import {
  getTeamByIdForUserEmail,
  shareTranscriptToTeam,
} from '@/lib/db/queries';

const isServantEmail = (email: string): boolean =>
  email.toLowerCase().endsWith('@servant.io');

const paramsSchema = z.object({
  teamId: z.string().uuid(),
});

const postBodySchema = z.object({
  transcriptId: z.number().int().positive(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> },
) {
  try {
    const session = await withAuth();
    const actorEmail = session.user?.email;

    if (!actorEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!isServantEmail(actorEmail)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (session.role === 'member') {
      return NextResponse.json(
        { error: 'Members cannot share transcripts' },
        { status: 403 },
      );
    }

    const { teamId } = paramsSchema.parse(await params);
    const json = await request.json();
    const body = postBodySchema.parse(json);

    const team = await getTeamByIdForUserEmail({
      teamId,
      userEmail: actorEmail,
    });
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
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

    if (session.role !== 'admin') {
      const { data, error } = await supabase
        .from('transcripts')
        .select('id')
        .eq('id', body.transcriptId)
        .contains('verified_participant_emails', [actorEmail])
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: 'Transcript not found or access denied' },
          { status: 404 },
        );
      }
    }

    await shareTranscriptToTeam({
      teamId,
      transcriptId: body.transcriptId,
      createdByEmail: actorEmail,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('API /teams/[teamId]/shares POST error:', error);
    return NextResponse.json(
      { error: 'Failed to share transcript' },
      { status: 500 },
    );
  }
}
