import { withAuth } from '@workos-inc/authkit-nextjs';
import { SidebarPageHeader } from '@/components/sidebar-page-header';
import { TeamsManager } from './teams-manager';

export const dynamic = 'force-dynamic';

export default async function TeamsPage() {
  await withAuth({ ensureSignedIn: true });

  return (
    <>
      <SidebarPageHeader />
      <div className="container mx-auto px-4 md:px-12 py-8">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold">Teams</h1>
          <p className="text-muted-foreground mt-2 text-base md:text-lg">
            Share transcripts with your team members
          </p>
        </div>

        <TeamsManager />
      </div>
    </>
  );
}
