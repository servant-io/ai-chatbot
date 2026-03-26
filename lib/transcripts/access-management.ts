import 'server-only';

import { createClient } from '@supabase/supabase-js';
import {
  getTranscriptSharesByTranscriptIds,
  shareTranscriptToUser,
  unshareTranscriptFromUser,
} from '@/lib/db/queries';
import {
  canManageTranscriptAccess,
  isServantEmail,
} from '@/lib/transcripts/access';

export type TranscriptAccessAction = 'share' | 'unshare';

export type TranscriptAccessSummary = {
  transcriptId: number;
  changedTargetEmails: string[];
  sharedWithEmails: string[];
};

const normalizeEmails = (emails: string[]): string[] =>
  Array.from(
    new Set(
      emails
        .map((email) => email.trim().toLowerCase())
        .filter((email) => email.length > 0),
    ),
  ).sort();

const normalizeTranscriptIds = (transcriptIds: number[]): number[] =>
  Array.from(new Set(transcriptIds)).sort((a, b) => a - b);

const getSupabaseAdminClient = () => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Database configuration missing');
  }

  return createClient(supabaseUrl, supabaseKey);
};

const buildAccessSummaries = ({
  transcriptIds,
  shares,
  targetEmails,
}: {
  transcriptIds: number[];
  shares: Array<{ transcriptId: number; userEmail: string }>;
  targetEmails: string[];
}): TranscriptAccessSummary[] => {
  const shareMap = new Map<number, Set<string>>();

  for (const share of shares) {
    const emails = shareMap.get(share.transcriptId);
    if (emails) {
      emails.add(share.userEmail);
    } else {
      shareMap.set(share.transcriptId, new Set([share.userEmail]));
    }
  }

  return transcriptIds.map((transcriptId) => ({
    transcriptId,
    changedTargetEmails: targetEmails,
    sharedWithEmails: Array.from(shareMap.get(transcriptId) ?? []).sort(),
  }));
};

const assertActorCanManageTranscriptAccess = async ({
  actorEmail,
  actorRole,
  transcriptIds,
}: {
  actorEmail: string;
  actorRole: string | null | undefined;
  transcriptIds: number[];
}): Promise<void> => {
  if (!canManageTranscriptAccess(actorRole)) {
    throw new Error('Only org-fte and admins can manage transcript access');
  }

  const normalizedTranscriptIds = normalizeTranscriptIds(transcriptIds);

  if (normalizedTranscriptIds.length === 0) {
    throw new Error('At least one transcript ID is required');
  }

  if (actorRole === 'admin') {
    return;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('transcripts')
    .select('id')
    .in('id', normalizedTranscriptIds)
    .contains('verified_participant_emails', [actorEmail]);

  if (error) {
    throw new Error(`Failed to validate transcript access: ${error.message}`);
  }

  const accessibleTranscriptIds = new Set(
    (data ?? []).map((row) => Number(row.id)),
  );
  const deniedTranscriptIds = normalizedTranscriptIds.filter(
    (transcriptId) => !accessibleTranscriptIds.has(transcriptId),
  );

  if (deniedTranscriptIds.length > 0) {
    throw new Error(
      `Transcript not found or access denied: ${deniedTranscriptIds.join(', ')}`,
    );
  }
};

export async function getTranscriptAccessSummaries({
  transcriptIds,
}: {
  transcriptIds: number[];
}): Promise<TranscriptAccessSummary[]> {
  const normalizedTranscriptIds = normalizeTranscriptIds(transcriptIds);

  if (normalizedTranscriptIds.length === 0) {
    return [];
  }

  const shares = await getTranscriptSharesByTranscriptIds({
    transcriptIds: normalizedTranscriptIds,
  });

  return buildAccessSummaries({
    transcriptIds: normalizedTranscriptIds,
    shares,
    targetEmails: [],
  });
}

export async function manageTranscriptAccess({
  action,
  actorEmail,
  actorRole,
  transcriptIds,
  targetEmails,
}: {
  action: TranscriptAccessAction;
  actorEmail: string;
  actorRole: string | null | undefined;
  transcriptIds: number[];
  targetEmails: string[];
}): Promise<{
  action: TranscriptAccessAction;
  transcripts: TranscriptAccessSummary[];
}> {
  const normalizedTranscriptIds = normalizeTranscriptIds(transcriptIds);
  const normalizedTargetEmails = normalizeEmails(targetEmails);

  if (normalizedTargetEmails.length === 0) {
    throw new Error('At least one target email is required');
  }

  const invalidTargetEmails = normalizedTargetEmails.filter(
    (email) => !isServantEmail(email),
  );

  if (invalidTargetEmails.length > 0) {
    throw new Error(
      `Transcript access is limited to @servant.io emails: ${invalidTargetEmails.join(', ')}`,
    );
  }

  await assertActorCanManageTranscriptAccess({
    actorEmail,
    actorRole,
    transcriptIds: normalizedTranscriptIds,
  });

  for (const transcriptId of normalizedTranscriptIds) {
    await Promise.all(
      normalizedTargetEmails.map((userEmail) =>
        action === 'share'
          ? shareTranscriptToUser({
              transcriptId,
              userEmail,
              createdByEmail: actorEmail,
            })
          : unshareTranscriptFromUser({
              transcriptId,
              userEmail,
            }),
      ),
    );
  }

  const currentShares = await getTranscriptSharesByTranscriptIds({
    transcriptIds: normalizedTranscriptIds,
  });

  return {
    action,
    transcripts: buildAccessSummaries({
      transcriptIds: normalizedTranscriptIds,
      shares: currentShares,
      targetEmails: normalizedTargetEmails,
    }),
  };
}
