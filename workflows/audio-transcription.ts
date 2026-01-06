import { del } from '@vercel/blob';
import { getWorkflowMetadata } from 'workflow';
import { createAudioTranscription } from '@/lib/db/queries';
import type { AudioTranscriptionUtterance } from '@/lib/db/schema';

type DeepgramUtterance = AudioTranscriptionUtterance;

type DeepgramResponse = {
  results?: {
    channels?: Array<{
      alternatives?: Array<{
        transcript?: string;
      }>;
    }>;
    utterances?: DeepgramUtterance[];
  };
};

type AudioTranscriptionInput = {
  audioUrl: string;
  userId: string;
  fileName: string | null;
};

export type AudioTranscriptionResult = {
  id: string;
  runId: string;
  fileName: string | null;
  transcript: string;
  utterances: DeepgramUtterance[];
  speakerNames: Record<string, string>;
  createdAt: Date;
};

export async function transcribeAudioWorkflow(input: AudioTranscriptionInput) {
  'use workflow';
  const { workflowRunId } = getWorkflowMetadata();
  const transcription = await transcribeAudioStep(input.audioUrl);
  const saved = await saveTranscriptionStep({
    userId: input.userId,
    runId: workflowRunId,
    fileName: input.fileName,
    transcript: transcription.transcript,
    utterances: transcription.utterances,
  });
  await cleanupAudioBlobStep(input.audioUrl);
  return saved;
}

async function transcribeAudioStep(
  audioUrl: string,
): Promise<{ transcript: string; utterances: DeepgramUtterance[] }> {
  'use step';
  const response = await fetch(
    'https://api.deepgram.com/v1/listen?model=nova-2-meeting&smart_format=true&punctuate=true&diarize=true&utterances=true',
    {
      method: 'POST',
      headers: {
        Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: audioUrl }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Deepgram transcription failed: ${response.status} ${response.statusText} ${errorText}`,
    );
  }

  const data = (await response.json()) as DeepgramResponse;
  const transcript =
    data.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? '';
  const utterances = data.results?.utterances ?? [];

  return {
    transcript,
    utterances,
  };
}

async function saveTranscriptionStep({
  userId,
  runId,
  fileName,
  transcript,
  utterances,
}: {
  userId: string;
  runId: string;
  fileName: string | null;
  transcript: string;
  utterances: DeepgramUtterance[];
}): Promise<AudioTranscriptionResult> {
  'use step';
  return await createAudioTranscription({
    userId,
    runId,
    fileName,
    transcript,
    utterances,
    speakerNames: {},
  });
}

async function cleanupAudioBlobStep(audioUrl: string): Promise<void> {
  'use step';
  await del(audioUrl);
}
