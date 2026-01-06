import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { withAuth } from '@workos-inc/authkit-nextjs';

export async function POST(request: Request): Promise<NextResponse> {
  const session = await withAuth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as HandleUploadBody;

  const jsonResponse = await handleUpload({
    body,
    request,
    onBeforeGenerateToken: async () => {
      return {
        allowedContentTypes: [
          'audio/mpeg',
          'audio/mp4',
          'audio/m4a',
          'audio/x-m4a',
          'audio/aac',
          'audio/mp4a-latm',
          'audio/wav',
          'audio/webm',
          'video/mp4',
          'video/webm',
          'video/quicktime',
        ],
        tokenPayload: JSON.stringify({
          userId: session.user.id,
        }),
      };
    },
    onUploadCompleted: async ({ blob, tokenPayload }) => {
      console.log('blob upload completed', blob, tokenPayload);
    },
  });

  return NextResponse.json(jsonResponse);
}
