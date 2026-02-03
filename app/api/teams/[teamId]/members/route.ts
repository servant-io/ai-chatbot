import { type NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { z } from 'zod/v4';
import {
  addTeamMemberByEmail,
  getTeamByIdForUserEmail,
  removeTeamMemberByEmail,
} from '@/lib/db/queries';

const isServantEmail = (email: string): boolean =>
  email.toLowerCase().endsWith('@servant.io');

const paramsSchema = z.object({
  teamId: z.string().uuid(),
});

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(256),
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

    const { teamId } = paramsSchema.parse(await params);
    const json = await request.json();
    const body = bodySchema.parse(json);

    if (!isServantEmail(body.email)) {
      return NextResponse.json(
        { error: 'Only @servant.io emails can be added' },
        { status: 400 },
      );
    }

    const team = await getTeamByIdForUserEmail({
      teamId,
      userEmail: actorEmail,
    });
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }
    if (team.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only the team owner can add members' },
        { status: 403 },
      );
    }

    await addTeamMemberByEmail({
      teamId,
      userEmail: body.email,
      role: 'member',
      createdByEmail: actorEmail,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('API /teams/[teamId]/members POST error:', error);
    return NextResponse.json(
      { error: 'Failed to add member' },
      { status: 500 },
    );
  }
}

export async function DELETE(
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

    const { teamId } = paramsSchema.parse(await params);
    const json = await request.json();
    const body = bodySchema.parse(json);

    const team = await getTeamByIdForUserEmail({
      teamId,
      userEmail: actorEmail,
    });
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }
    if (team.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only the team owner can remove members' },
        { status: 403 },
      );
    }
    if (body.email === actorEmail) {
      return NextResponse.json(
        { error: 'Owner cannot remove themselves' },
        { status: 400 },
      );
    }

    await removeTeamMemberByEmail({ teamId, userEmail: body.email });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('API /teams/[teamId]/members DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to remove member' },
      { status: 500 },
    );
  }
}
