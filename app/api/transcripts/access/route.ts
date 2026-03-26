import { type NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { z } from 'zod/v4';
import { manageTranscriptAccess } from '@/lib/transcripts/access-management';
import {
  canManageTranscriptAccess,
  isServantEmail,
} from '@/lib/transcripts/access';

const requestBodySchema = z.object({
  action: z.enum(['share', 'unshare']),
  transcriptIds: z.array(z.number().int().positive()).min(1).max(25),
  targetEmails: z.array(z.string().email()).min(1).max(25),
});

export async function POST(request: NextRequest) {
  try {
    const session = await withAuth();
    const actorEmail = session.user?.email;

    if (!actorEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isServantEmail(actorEmail)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!canManageTranscriptAccess(session.role)) {
      return NextResponse.json(
        { error: 'Only org-fte and admins can manage transcript access' },
        { status: 403 },
      );
    }

    const json = await request.json();
    const body = requestBodySchema.parse(json);

    const result = await manageTranscriptAccess({
      action: body.action,
      actorEmail,
      actorRole: session.role,
      transcriptIds: body.transcriptIds,
      targetEmails: body.targetEmails,
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('API /transcripts/access POST error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid transcript access request' },
        { status: 400 },
      );
    }

    const message =
      error instanceof Error
        ? error.message
        : 'Failed to manage transcript access';
    const status = message.includes('access denied') ? 404 : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
