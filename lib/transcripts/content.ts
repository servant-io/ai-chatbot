import { z } from 'zod/v4';

type TranscriptContentRecord = {
  cleaned?: unknown;
};

const isTranscriptContentRecord = (
  value: unknown,
): value is TranscriptContentRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function extractCleanedTranscriptText(value: unknown): string | null {
  if (!isTranscriptContentRecord(value)) {
    return null;
  }

  return typeof value.cleaned === 'string' ? value.cleaned : null;
}

const transcriptTextRecordSchema = z.object({
  id: z.number().int(),
  recording_start: z.string().nullable(),
  summary: z.string().nullable(),
  transcript_content: z.unknown().nullable(),
  projects: z.array(z.string()).nullable(),
  clients: z.array(z.string()).nullable(),
  meeting_type: z.string().nullable(),
  extracted_participants: z.array(z.string()).nullable(),
});

export type TranscriptTextRecord = z.infer<typeof transcriptTextRecordSchema>;

export const FULL_TRANSCRIPT_TEXT_SELECT =
  'id, recording_start, summary, transcript_content, projects, clients, meeting_type, extracted_participants';

export const parseTranscriptTextRecord = (
  value: unknown,
): TranscriptTextRecord => transcriptTextRecordSchema.parse(value);

const formatStringList = (
  values: string[] | null,
  fallback: string,
): string => {
  if (!values || values.length === 0) {
    return fallback;
  }

  return values.join(', ');
};

export const formatTranscriptMarkdown = (
  transcript: TranscriptTextRecord,
): string => {
  const recordingDate = transcript.recording_start
    ? new Date(transcript.recording_start).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Unknown';

  const transcriptContent =
    extractCleanedTranscriptText(transcript.transcript_content) ??
    'No transcript content available';

  return `# Transcript ${transcript.id}

**Date**: ${recordingDate}
**Meeting Type**: ${transcript.meeting_type || 'Unknown'}
**Participants**: ${formatStringList(transcript.extracted_participants, 'Unknown')}
**Projects**: ${formatStringList(transcript.projects, 'None')}
**Clients**: ${formatStringList(transcript.clients, 'None')}

## Summary

${transcript.summary || 'No summary available'}

## Content

${transcriptContent}
`;
};
