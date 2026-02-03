import { type NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { z } from 'zod/v4';
import { createTeam, getTeamsByUserEmail } from '@/lib/db/queries';

const isServantEmail = (email: string): boolean =>
  email.toLowerCase().endsWith('@servant.io');

const postBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export async function GET() {
  try {
    const session = await withAuth();
    const email = session.user?.email;

    if (!email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isServantEmail(email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const teams = await getTeamsByUserEmail({ userEmail: email });
    return NextResponse.json({ data: teams });
  } catch (error) {
    console.error('API /teams GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch teams' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await withAuth();
    const email = session.user?.email;

    if (!email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isServantEmail(email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const json = await request.json();
    const body = postBodySchema.parse(json);

    const created = await createTeam({
      name: body.name,
      createdByEmail: email,
    });

    return NextResponse.json({ data: created });
  } catch (error) {
    console.error('API /teams POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create team' },
      { status: 500 },
    );
  }
}
