import { NextResponse } from 'next/server';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { start } from 'workflow/api';
import { transcribeAudioWorkflow } from '@/workflows/audio-transcription';

export const maxDuration = 300;

export async function POST(request: Request) {
  const session = await withAuth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { audioUrl } = (await request.json()) as { audioUrl: string };
  const run = await start(transcribeAudioWorkflow, [audioUrl]);
  const result = await run.returnValue;

  return NextResponse.json({
    runId: run.runId,
    ...result,
  });
}
