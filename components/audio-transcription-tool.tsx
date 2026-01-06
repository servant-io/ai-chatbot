'use client';

import { useCallback, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { upload } from '@vercel/blob/client';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { CopyIcon, LoaderIcon, UploadIcon, UserIcon } from '@/components/icons';

type Transcription = {
  text: string;
  utterances: Array<{
    transcript: string;
    start: number;
    end: number;
    speaker: number;
  }>;
  runId: string;
};

export function AudioTranscriptionTool() {
  const [transcription, setTranscription] = useState<Transcription | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [speakerNames, setSpeakerNames] = useState<Record<number, string>>({});
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const uniqueSpeakers = useMemo(() => {
    if (!transcription) return [];
    return Array.from(
      new Set(transcription.utterances.map((utterance) => utterance.speaker)),
    ).sort();
  }, [transcription]);

  const handleSaveSpeakerNames = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const names: Record<number, string> = {};

      uniqueSpeakers.forEach((speaker) => {
        const name = formData.get(`speaker-${speaker}`)?.toString();
        if (name) names[speaker] = name;
      });

      setSpeakerNames(names);
      setIsDialogOpen(false);
      toast.success('Speaker names updated');
    },
    [uniqueSpeakers],
  );

  const getSpeakerLabel = (speakerNumber: number) => {
    return speakerNames[speakerNumber] || `Speaker ${speakerNumber + 1}`;
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsLoading(true);
    setError('');

    try {
      const { url } = await upload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/audio/upload',
      });

      const transcribeResponse = await fetch('/api/audio/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ audioUrl: url }),
      });

      if (!transcribeResponse.ok) {
        const errorText = await transcribeResponse.text();
        throw new Error(
          errorText ||
            `Transcription failed: ${transcribeResponse.status} ${transcribeResponse.statusText}`,
        );
      }

      const data = (await transcribeResponse.json()) as Transcription;
      setTranscription(data);
      toast.success('Transcription complete');
    } catch (err) {
      console.error('Error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      toast.error('Failed to process file');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'audio/*': ['.mp3', '.m4a', '.wav', '.webm'],
      'video/*': ['.mp4', '.webm', '.mov'],
    },
    maxFiles: 1,
    maxSize: 800 * 1024 * 1024,
    onDropRejected: (fileRejections) => {
      const rejection = fileRejections[0];
      if (rejection?.errors[0]?.code === 'file-too-large') {
        toast.error('File is too large. Maximum size is 800MB');
      }
    },
  });

  const formatTimestamp = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const copyToClipboard = () => {
    if (!transcription) return;

    const formattedText = transcription.utterances
      .map((utterance) => {
        const speakerLabel = `${getSpeakerLabel(utterance.speaker)}: `;
        return `${speakerLabel}${utterance.transcript}`;
      })
      .join('\n');

    navigator.clipboard.writeText(formattedText);
    toast.success('Copied to clipboard');
  };

  const getSpeakerColor = (speakerNumber: number) => {
    const colors = [
      'bg-blue-500/20 text-blue-700 hover:bg-blue-500/20',
      'bg-green-500/20 text-green-700 hover:bg-green-500/20',
      'bg-purple-500/20 text-purple-700 hover:bg-purple-500/20',
      'bg-orange-500/20 text-orange-700 hover:bg-orange-500/20',
      'bg-pink-500/20 text-pink-700 hover:bg-pink-500/20',
    ];
    return colors[speakerNumber % colors.length];
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2 text-center">
        Audio / Video Transcription Tool
      </h1>
      <p className="text-sm text-center text-muted-foreground mb-6">
        Transcribe audio and video files into speaker-labeled text.
      </p>

      <Card className="p-6">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
            ${isDragActive ? 'border-primary bg-primary/10' : 'border-gray-300 hover:border-primary'}
            flex flex-col items-center justify-center min-h-[200px]`}
        >
          <input {...getInputProps()} />
          <div className="mb-4">
            <UploadIcon size={24} />
          </div>
          <p className="text-lg mb-2">
            {isDragActive
              ? 'Drop the audio file here'
              : 'Drag and drop an audio file here, or click to select'}
          </p>
          <p className="text-sm text-gray-500">
            Supported formats: MP3, MP4, M4A, WAV, WEBM (max 800MB)
          </p>
        </div>

        {isLoading && (
          <div className="mt-8 flex flex-col items-center justify-center">
            <div className="animate-spin">
              <LoaderIcon size={24} />
            </div>
            <p className="mt-2 text-sm text-gray-600">
              Transcribing your audio...
            </p>
          </div>
        )}

        {error && (
          <div className="mt-6 p-4 bg-red-50 text-red-600 rounded-lg text-center">
            {error}
          </div>
        )}

        {transcription && (
          <div className="mt-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-2 mb-4">
              <h2 className="text-xl font-semibold">Transcription</h2>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyToClipboard}
                  className="flex items-center gap-2 flex-1 sm:flex-initial justify-center"
                >
                  <CopyIcon />
                  Copy
                </Button>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="default"
                      size="sm"
                      className="flex items-center gap-2 flex-1 sm:flex-initial justify-center"
                    >
                      <UserIcon />
                      Name Speakers
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Name Speakers</DialogTitle>
                    </DialogHeader>
                    <form
                      onSubmit={handleSaveSpeakerNames}
                      className="space-y-4 mt-4"
                    >
                      {uniqueSpeakers.map((speaker) => (
                        <div key={speaker} className="flex flex-col gap-2">
                          <label
                            htmlFor={`speaker-${speaker}`}
                            className="text-sm font-medium"
                          >
                            Speaker {speaker + 1} Name
                          </label>
                          <Input
                            id={`speaker-${speaker}`}
                            name={`speaker-${speaker}`}
                            defaultValue={speakerNames[speaker] || ''}
                            placeholder={`Enter name for Speaker ${speaker + 1}`}
                          />
                        </div>
                      ))}
                      <Button type="submit" className="w-full">
                        Save Names
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              {transcription.utterances.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No utterances returned for this file.
                </p>
              ) : (
                transcription.utterances.map((utterance, index) => (
                  <div key={`${utterance.start}-${index}`} className="mb-6">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={getSpeakerColor(utterance.speaker)}>
                        {getSpeakerLabel(utterance.speaker)}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {formatTimestamp(utterance.start)}
                      </span>
                    </div>
                    <div className="whitespace-pre-wrap">
                      {utterance.transcript}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
