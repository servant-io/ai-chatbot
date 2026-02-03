import { type NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { z } from 'zod/v4';
import {
  createTeamTranscriptRule,
  getTeamByIdForUserEmail,
  getTeamTranscriptRulesByTeamId,
} from '@/lib/db/queries';

const isServantEmail = (email: string): boolean =>
  email.toLowerCase().endsWith('@servant.io');

const paramsSchema = z.object({
  teamId: z.string().uuid(),
});

const postBodySchema = z.object({
  type: z.enum(['summary_topic_exact']),
  value: z.string().trim().min(1).max(200),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  try {
    const session = await withAuth();
    const email = session.user?.email;

    if (!email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!isServantEmail(email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { teamId } = paramsSchema.parse(await params);
    const team = await getTeamByIdForUserEmail({ teamId, userEmail: email });
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const rules = await getTeamTranscriptRulesByTeamId({ teamId });
    return NextResponse.json({ data: rules });
  } catch (error) {
    console.error('API /teams/[teamId]/rules GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rules' },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> },
) {
  try {
    const session = await withAuth();
    const email = session.user?.email;

    if (!email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!isServantEmail(email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { teamId } = paramsSchema.parse(await params);
    const team = await getTeamByIdForUserEmail({ teamId, userEmail: email });
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }
    if (team.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only the team owner can manage rules' },
        { status: 403 },
      );
    }

    const json = await request.json();
    const body = postBodySchema.parse(json);

    const created = await createTeamTranscriptRule({
      teamId,
      type: body.type,
      value: body.value,
      createdByEmail: email,
    });

    return NextResponse.json({ data: created });
  } catch (error) {
    console.error('API /teams/[teamId]/rules POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create rule' },
      { status: 500 },
    );
  }
}
