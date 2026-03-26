'use client';

import { useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { fetcher } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ChevronDown, ChevronUp, Copy, X } from 'lucide-react';
import { useCopyToClipboard } from 'usehooks-ts';
import { toast } from 'sonner';
import type { Transcript } from './list/use-transcripts';

interface TranscriptSheetProps {
  transcript: Transcript | null;
  isOpen: boolean;
  onClose: () => void;
  canShareTranscripts: boolean;
  onTranscriptShared: (share: {
    transcriptId: number;
    sharedWithEmails: string[];
  }) => void;
}

type TranscriptAccessResponse = {
  data?: {
    transcripts?: Array<{
      transcriptId: number;
      sharedWithEmails: string[];
    }>;
  };
  error?: string;
};

export function TranscriptSheet({
  transcript,
  isOpen,
  onClose,
  canShareTranscripts,
  onTranscriptShared,
}: TranscriptSheetProps) {
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [transcriptExpanded, setTranscriptExpanded] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [_, copyToClipboard] = useCopyToClipboard();
  const { mutate } = useSWRConfig();

  const canViewFullContent = transcript?.can_view_full_content === true;
  const shouldFetch = isOpen && transcript?.id && canViewFullContent;
  const { data, error, isLoading } = useSWR(
    shouldFetch ? `/api/transcripts/${transcript.id}` : null,
    fetcher,
  );

  const transcriptContent = data?.content || null;

  const manageAccess = async ({
    action,
    targetEmail,
  }: {
    action: 'share' | 'unshare';
    targetEmail: string;
  }) => {
    if (!transcript || isSharing) {
      return;
    }

    const normalizedEmail = targetEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      return;
    }

    setIsSharing(true);
    try {
      const res = await fetch('/api/transcripts/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          transcriptIds: [transcript.id],
          targetEmails: [normalizedEmail],
        }),
      });
      const payload = (await res.json()) as TranscriptAccessResponse;

      if (!res.ok) {
        throw new Error(payload.error ?? 'Failed to manage transcript access');
      }

      const updatedTranscript = payload.data?.transcripts?.find(
        (item) => item.transcriptId === transcript.id,
      );

      if (!updatedTranscript) {
        throw new Error(
          'Transcript access update did not return the transcript',
        );
      }

      onTranscriptShared({
        transcriptId: transcript.id,
        sharedWithEmails: updatedTranscript.sharedWithEmails,
      });

      if (action === 'share') {
        setShareEmail('');
        toast.success(`Shared transcript with ${normalizedEmail}`);
      } else {
        toast.success(`Removed access for ${normalizedEmail}`);
      }
    } catch (err) {
      console.error('Error managing transcript access:', err);
      toast.error(
        err instanceof Error
          ? err.message
          : 'Failed to manage transcript access',
      );
    } finally {
      setIsSharing(false);
      await mutate(
        (key) => typeof key === 'string' && key.startsWith('/api/transcripts'),
      );
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  };

  const formatSummary = (summary: string) => {
    return summary.split('\n').map((line, index) => {
      const isHeader = line.trim().endsWith(':') && line.trim().length > 0;
      return (
        <div
          key={`summary-line-${index}-${line.substring(0, 10)}`}
          className={isHeader ? 'mb-1 font-semibold' : 'mb-3 last:mb-0'}
        >
          {line}
        </div>
      );
    });
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="overflow-y-auto md:min-w-[600px]">
        <SheetHeader>
          <SheetTitle>Meeting Transcript Details</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle>Meeting Information</CardTitle>
              {canShareTranscripts && (
                <div className="flex items-center gap-2">
                  <Input
                    type="email"
                    value={shareEmail}
                    onChange={(event) => setShareEmail(event.target.value)}
                    className="h-8 w-[240px]"
                    placeholder="Share with @servant.io email"
                  />
                  <Button
                    size="sm"
                    onClick={() =>
                      manageAccess({
                        action: 'share',
                        targetEmail: shareEmail,
                      })
                    }
                    disabled={!shareEmail.trim() || isSharing}
                  >
                    Share
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <span className="font-medium">Date & Time: </span>
                <span>
                  {transcript?.recording_start
                    ? formatDate(transcript.recording_start)
                    : 'N/A'}
                </span>
              </div>

              <div>
                <span className="font-medium">Meeting Type: </span>
                <span
                  className={`rounded-full px-2 py-1 text-xs ${
                    transcript?.meeting_type === 'internal'
                      ? 'bg-blue-100 text-blue-800'
                      : transcript?.meeting_type === 'external'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {transcript?.meeting_type || 'unknown'}
                </span>
              </div>

              {transcript?.summary && (
                <div>
                  <span className="font-medium">Summary: </span>
                  <div className="mt-1 leading-relaxed">
                    <div
                      className={
                        summaryExpanded
                          ? ''
                          : 'relative max-h-32 overflow-hidden'
                      }
                    >
                      {transcript.summary && formatSummary(transcript.summary)}
                      {!summaryExpanded && (
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent" />
                      )}
                    </div>
                    {transcript.summary.length > 200 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => setSummaryExpanded(!summaryExpanded)}
                      >
                        {summaryExpanded ? (
                          <>
                            Show less <ChevronUp className="ml-1 size-4" />
                          </>
                        ) : (
                          <>
                            See more <ChevronDown className="ml-1 size-4" />
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {transcript?.shared_with_emails &&
                transcript.shared_with_emails.length > 0 && (
                  <div>
                    <span className="font-medium">Shared with: </span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {transcript.shared_with_emails.map((email) => (
                        <div
                          key={email}
                          className="flex items-center gap-1 rounded-full bg-purple-100 px-2 py-1 text-sm text-purple-800"
                        >
                          <span>{email}</span>
                          {canShareTranscripts && (
                            <button
                              type="button"
                              className="rounded-full p-0.5 transition-colors hover:bg-purple-200"
                              onClick={() =>
                                manageAccess({
                                  action: 'unshare',
                                  targetEmail: email,
                                })
                              }
                              disabled={isSharing}
                              aria-label={`Remove access for ${email}`}
                            >
                              <X className="size-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </CardContent>
          </Card>

          {canViewFullContent && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Full Transcript</CardTitle>
                {transcriptContent && (
                  <Button
                    className="h-fit px-2 py-1 text-muted-foreground"
                    variant="outline"
                    onClick={async () => {
                      if (!transcriptContent) {
                        toast.error("There's no transcript to copy!");
                        return;
                      }

                      await copyToClipboard(transcriptContent);
                      toast.success('Copied transcript to clipboard!');
                    }}
                  >
                    <Copy className="size-4" />
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="size-6 animate-spin rounded-full border-b-2 border-primary" />
                    <span className="ml-2">Loading transcript...</span>
                  </div>
                ) : error ? (
                  <div className="py-8 text-center">
                    <p className="text-destructive">
                      Error: {error.message || String(error)}
                    </p>
                    <Button
                      onClick={() => window.location.reload()}
                      className="mt-4"
                      size="sm"
                    >
                      Try Again
                    </Button>
                  </div>
                ) : transcriptContent ? (
                  <div className="prose max-w-none">
                    <div
                      className={
                        transcriptExpanded
                          ? ''
                          : 'relative max-h-96 overflow-hidden'
                      }
                    >
                      <div className="overflow-y-auto rounded-lg bg-gray-100 p-4 text-sm whitespace-pre-wrap">
                        {transcriptContent}
                      </div>
                      {!transcriptExpanded && (
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent" />
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => setTranscriptExpanded(!transcriptExpanded)}
                    >
                      {transcriptExpanded ? (
                        <>
                          Show less <ChevronUp className="ml-1 size-4" />
                        </>
                      ) : (
                        <>
                          See more <ChevronDown className="ml-1 size-4" />
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <p className="py-8 text-center text-muted-foreground">
                    No transcript content available
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Participants</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <span className="font-medium">Extracted Participants: </span>
                  <div className="mt-1">
                    {transcript?.extracted_participants &&
                    transcript.extracted_participants.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {transcript.extracted_participants.map(
                          (participant) => (
                            <span
                              key={participant}
                              className="rounded-full bg-gray-100 px-2 py-1 text-sm text-gray-800"
                            >
                              {participant}
                            </span>
                          ),
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">None listed</span>
                    )}
                  </div>
                </div>

                {transcript?.verified_participant_emails &&
                  transcript.verified_participant_emails.length > 0 && (
                    <div>
                      <span className="font-medium">
                        Verified Participants (with access):{' '}
                      </span>
                      <div className="mt-1">
                        <div className="flex flex-wrap gap-2">
                          {transcript.verified_participant_emails.map(
                            (email) => (
                              <span
                                key={email}
                                className="rounded-full bg-green-100 px-2 py-1 text-sm text-green-800"
                              >
                                {email}
                              </span>
                            ),
                          )}
                        </div>
                      </div>
                    </div>
                  )}
              </div>
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}
