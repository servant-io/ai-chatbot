import { withAuth } from '@workos-inc/authkit-nextjs';
import { TranscriptsList } from './components/transcripts-list';
import { SidebarPageHeader } from '@/components/sidebar-page-header';
import { canShareTranscripts } from '@/lib/transcripts/access';

export default async function TranscriptsPage() {
  const session = await withAuth({ ensureSignedIn: true });
  const { user } = session;

  // Role-based access check
  const canCurrentUserShareTranscripts = canShareTranscripts(session.role);
  console.log(
    `📋 Transcripts page - User ${user.email} has role '${session.role}' (${canCurrentUserShareTranscripts ? 'CAN SHARE TRANSCRIPTS' : 'LIMITED TO ASSIGNED SHARES'})`,
  );

  return (
    <>
      <SidebarPageHeader />
      <div className="container mx-auto px-12 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Meeting Transcripts</h1>
          <p className="text-muted-foreground mt-2">
            View and manage your Zoom meeting transcripts
          </p>
        </div>

        <TranscriptsList canShareTranscripts={canCurrentUserShareTranscripts} />
      </div>
    </>
  );
}
