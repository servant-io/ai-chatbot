'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Copy, ChevronDown, ChevronUp } from 'lucide-react';
import { useCopyToClipboard } from 'usehooks-ts';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Transcript } from './list/use-transcripts';

interface TranscriptSheetProps {
  transcript: Transcript | null;
  isOpen: boolean;
  onClose: () => void;
  canShareTranscripts: boolean;
}

export function TranscriptSheet({
  transcript,
  isOpen,
  onClose,
  canShareTranscripts,
}: TranscriptSheetProps) {
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [transcriptExpanded, setTranscriptExpanded] = useState(false);
  const [_, copyToClipboard] = useCopyToClipboard();
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [isSharing, setIsSharing] = useState(false);

  // Use SWR to fetch transcript content when sheet is open and transcript exists (but not for members)
  const canViewFullContent = transcript?.can_view_full_content === true;
  const shouldFetch = isOpen && transcript?.id && canViewFullContent;
  const { data, error, isLoading } = useSWR(
    shouldFetch ? `/api/transcripts/${transcript.id}` : null,
    fetcher,
  );

  const transcriptContent = data?.content || null;

  const { data: teamsResponse, mutate: mutateTeams } = useSWR<{
    data: Array<{ id: string; name: string }>;
  }>(canShareTranscripts ? '/api/teams' : null, fetcher);

  const teams = teamsResponse?.data ?? [];

  const shareToTeam = async () => {
    if (!transcript || !selectedTeamId || isSharing) return;

    setIsSharing(true);
    try {
      const res = await fetch(`/api/teams/${selectedTeamId}/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcriptId: transcript.id }),
      });

      if (!res.ok) {
        throw new Error('Failed to share transcript');
      }

      setSelectedTeamId('');
      toast.success('Shared transcript to team');
    } catch (err) {
      console.error('Error sharing transcript:', err);
      toast.error('Failed to share transcript');
    } finally {
      setIsSharing(false);
      await mutateTeams();
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
      <SheetContent side="right" className="md:min-w-[600px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Meeting Transcript Details</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Meeting Info */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle>Meeting Information</CardTitle>
              {canShareTranscripts && (
                <div className="flex items-center gap-2">
                  <Select
                    value={selectedTeamId}
                    onValueChange={setSelectedTeamId}
                  >
                    <SelectTrigger className="h-8 w-[220px]">
                      <SelectValue placeholder="Share to team…" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={shareToTeam}
                    disabled={!selectedTeamId || isSharing}
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
                  className={`px-2 py-1 rounded-full text-xs ${
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
                          : 'max-h-32 overflow-hidden relative'
                      }
                    >
                      {transcript.summary && formatSummary(transcript.summary)}
                      {!summaryExpanded && (
                        <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-background to-transparent pointer-events-none" />
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

              {transcript?.shared_in_teams &&
                transcript.shared_in_teams.length > 0 && (
                  <div>
                    <span className="font-medium">Shared in teams: </span>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {transcript.shared_in_teams.map((teamName) => (
                        <span
                          key={teamName}
                          className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-sm"
                        >
                          {teamName}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
            </CardContent>
          </Card>

          {/* Transcript Content - Only show for elevated roles */}
          {canViewFullContent && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Full Transcript</CardTitle>
                {transcriptContent && (
                  <Button
                    className="py-1 px-2 h-fit text-muted-foreground"
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
                    <div className="animate-spin rounded-full size-6 border-b-2 border-primary" />
                    <span className="ml-2">Loading transcript...</span>
                  </div>
                ) : error ? (
                  <div className="text-center py-8">
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
                          : 'max-h-96 overflow-hidden relative'
                      }
                    >
                      <div className="whitespace-pre-wrap text-sm bg-gray-100 p-4 rounded-lg overflow-y-auto">
                        {transcriptContent}
                      </div>
                      {!transcriptExpanded && (
                        <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-background to-transparent pointer-events-none" />
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
                  <p className="text-muted-foreground text-center py-8">
                    No transcript content available
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Participants */}
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
                              className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-sm"
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
                                className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm"
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
