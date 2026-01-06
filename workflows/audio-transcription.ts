import { del } from '@vercel/blob';

type DeepgramUtterance = {
  start: number;
  end: number;
  transcript: string;
  speaker: number;
};

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

export type AudioTranscriptionResult = {
  text: string;
  utterances: DeepgramUtterance[];
};

export async function transcribeAudioWorkflow(audioUrl: string) {
  'use workflow';
  const transcription = await transcribeAudioStep(audioUrl);
  await cleanupAudioBlobStep(audioUrl);
  return transcription;
}

async function transcribeAudioStep(audioUrl: string): Promise<AudioTranscriptionResult> {
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
  const text =
    data.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? '';
  const utterances = data.results?.utterances ?? [];

  return {
    text,
    utterances,
  };
}

async function cleanupAudioBlobStep(audioUrl: string): Promise<void> {
  'use step';
  await del(audioUrl);
}
