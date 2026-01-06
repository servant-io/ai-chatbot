import { withAuth } from '@workos-inc/authkit-nextjs';
import { SidebarPageHeader } from '@/components/sidebar-page-header';
import { AudioTranscriptionTool } from '@/components/audio-transcription-tool';

export default async function AudioTranscriptionPage() {
  await withAuth({ ensureSignedIn: true });

  return (
    <>
      <SidebarPageHeader />
      <div className="container mx-auto px-4 md:px-12 py-8">
        <AudioTranscriptionTool />
      </div>
    </>
  );
}
