export const canManageTranscriptAccess = (
  role: string | null | undefined,
): boolean => role === 'admin' || role === 'org-fte';

export const canShareTranscripts = canManageTranscriptAccess;

export const isServantEmail = (email: string): boolean =>
  email.toLowerCase().endsWith('@servant.io');
