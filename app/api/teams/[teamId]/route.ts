import { NextResponse } from 'next/server';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { z } from 'zod/v4';
import {
  getTeamByIdForUserEmail,
  getTeamMembersByTeamId,
  getTeamTranscriptRulesByTeamId,
} from '@/lib/db/queries';

const isServantEmail = (email: string): boolean =>
  email.toLowerCase().endsWith('@servant.io');

const paramsSchema = z.object({
  teamId: z.string().uuid(),
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

    const [members, rules] = await Promise.all([
      getTeamMembersByTeamId({ teamId }),
      getTeamTranscriptRulesByTeamId({ teamId }),
    ]);

    return NextResponse.json({
      data: {
        team,
        members,
        rules,
      },
    });
  } catch (error) {
    console.error('API /teams/[teamId] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch team' },
      { status: 500 },
    );
  }
}
