'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { upload, type UploadOptions } from '@vercel/blob/client';
import { toast } from 'sonner';
import useSWR, { mutate as mutateCache } from 'swr';

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
import { cn } from '@/lib/utils';

const getMediaDurationSeconds = (file: File) =>
  new Promise<number>((resolve) => {
    const url = URL.createObjectURL(file);
    const element = document.createElement(
      file.type.startsWith('video') ? 'video' : 'audio',
    );

    element.preload = 'metadata';
    element.onloadedmetadata = () => {
      const duration = element.duration;
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(duration) ? duration : 0);
    };
    element.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
    element.src = url;
  });

const getUploadContentType = (file: File) => {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith('.qta')) return 'audio/quicktime';
  return file.type || undefined;
};

type TranscriptionListItem = {
  id: string;
  fileName: string | null;
  createdAt: string;
};

type TranscriptionDetail = {
  id: string;
  runId: string;
  fileName: string | null;
  transcript: string;
  utterances: Array<{
    transcript: string;
    start: number;
    end: number;
    speaker: number;
  }>;
  speakerNames: Record<string, string>;
  createdAt: string;
};

const fetcher = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Request failed');
  }
  return (await response.json()) as T;
};

export function AudioTranscriptionTool() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingEstimate, setLoadingEstimate] = useState<number | null>(null);
  const [loadingElapsed, setLoadingElapsed] = useState(0);

  const { data: history, mutate: mutateHistory } = useSWR<
    TranscriptionListItem[]
  >('/api/audio/transcriptions', fetcher);

  const activeId = selectedId ?? history?.[0]?.id ?? null;
  const { data: activeTranscription, mutate: mutateTranscription } =
    useSWR<TranscriptionDetail>(
      activeId ? `/api/audio/transcriptions/${activeId}` : null,
      fetcher,
    );

  const speakerNames = activeTranscription?.speakerNames ?? {};

  const uniqueSpeakers = useMemo(() => {
    if (!activeTranscription) return [];
    return Array.from(
      new Set(
        activeTranscription.utterances.map((utterance) => utterance.speaker),
      ),
    ).sort();
  }, [activeTranscription]);

  useEffect(() => {
    if (!isLoading || loadingEstimate === null) {
      setLoadingElapsed(0);
      return;
    }

    const startedAt = Date.now();
    const intervalId = window.setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
      setLoadingElapsed(elapsedSeconds);
    }, 500);

    return () => window.clearInterval(intervalId);
  }, [isLoading, loadingEstimate]);

  const loadingProgress = useMemo(() => {
    if (loadingEstimate === null || loadingEstimate === 0) return 0;
    return Math.min(1, loadingElapsed / loadingEstimate);
  }, [loadingElapsed, loadingEstimate]);

  const remainingSeconds = useMemo(() => {
    if (loadingEstimate === null) return null;
    return Math.max(0, Math.ceil(loadingEstimate - loadingElapsed));
  }, [loadingElapsed, loadingEstimate]);

  const handleSaveSpeakerNames = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!activeId) return;

      const formData = new FormData(event.currentTarget);
      const names: Record<string, string> = {};

      uniqueSpeakers.forEach((speaker) => {
        const name = formData.get(`speaker-${speaker}`)?.toString();
        if (name) names[speaker] = name;
      });

      const response = await fetch(`/api/audio/transcriptions/${activeId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ speakerNames: names }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        toast.error(errorText || 'Failed to save speaker names');
        return;
      }

      const updated = (await response.json()) as TranscriptionDetail;
      mutateTranscription(updated, { revalidate: false });
      setIsDialogOpen(false);
      toast.success('Speaker names updated');
    },
    [activeId, mutateTranscription, uniqueSpeakers],
  );

  const getSpeakerLabel = (speakerNumber: number) => {
    return speakerNames[speakerNumber] || `Speaker ${speakerNumber + 1}`;
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setIsLoading(true);
      setError('');

      try {
        const contentType = getUploadContentType(file);

        const durationSeconds = await getMediaDurationSeconds(file);
        const estimateSeconds =
          durationSeconds > 0
            ? Math.max(10, Math.ceil(durationSeconds / 120))
            : null;
        setLoadingEstimate(estimateSeconds);

        const uploadOptions: UploadOptions = {
          access: 'public',
          handleUploadUrl: '/api/audio/upload',
          clientPayload: JSON.stringify({
            name: file.name,
            type: file.type,
            size: file.size,
            contentType: contentType ?? null,
          }),
        };

        if (contentType) {
          uploadOptions.contentType = contentType;
        }

        const { url } = await upload(file.name, file, uploadOptions);

        const transcribeResponse = await fetch('/api/audio/transcribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ audioUrl: url, fileName: file.name }),
        });

        if (!transcribeResponse.ok) {
          const errorText = await transcribeResponse.text();
          throw new Error(
            errorText ||
              `Transcription failed: ${transcribeResponse.status} ${transcribeResponse.statusText}`,
          );
        }

        const data = (await transcribeResponse.json()) as TranscriptionDetail;
        const listItem: TranscriptionListItem = {
          id: data.id,
          fileName: data.fileName,
          createdAt: data.createdAt,
        };

        mutateHistory((current) => [listItem, ...(current || [])], {
          revalidate: false,
        });
        mutateCache(`/api/audio/transcriptions/${data.id}`, data, {
          revalidate: false,
        });
        setSelectedId(data.id);
        toast.success('Transcription complete');
      } catch (err) {
        console.error('Error:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
        toast.error('Failed to process file');
      } finally {
        setIsLoading(false);
        setLoadingEstimate(null);
      }
    },
    [mutateHistory],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'audio/*': ['.mp3', '.m4a', '.wav', '.webm', '.qta'],
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
    if (!activeTranscription) return;

    const formattedText = activeTranscription.utterances
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
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-semibold tracking-tight mb-2">
          Transcription Studio
        </h1>
        <p className="text-muted-foreground">
          Convert audio and video into speaker-labeled text
        </p>
      </div>

      {/* Upload Zone - Primary Action */}
      <div
        {...getRootProps()}
        className={cn(
          'relative group cursor-pointer rounded-2xl border-2 border-dashed p-10 transition-all duration-300',
          'bg-gradient-to-b from-muted/30 to-muted/10',
          isDragActive
            ? 'border-primary bg-primary/5 scale-[1.02]'
            : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/40',
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center gap-4">
          <div
            className={cn(
              'rounded-full p-4 transition-all duration-300',
              isDragActive
                ? 'bg-primary/20 text-primary'
                : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary',
            )}
          >
            <UploadIcon size={28} />
          </div>
          <div className="text-center">
            <p className="text-lg font-medium mb-1">
              {isDragActive ? 'Drop to transcribe' : 'Drop your file here'}
            </p>
            <p className="text-sm text-muted-foreground">
              or click to browse
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2 mt-2">
            {['MP3', 'MP4', 'M4A', 'WAV', 'WEBM', 'MOV'].map((format) => (
              <span
                key={format}
                className="px-2 py-0.5 text-xs rounded-md bg-muted text-muted-foreground"
              >
                {format}
              </span>
            ))}
          </div>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Maximum file size: 800MB
          </p>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <Card className="mt-6 p-6">
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="animate-spin text-primary">
              <LoaderIcon size={28} />
            </div>
            <div className="text-center">
              <p className="font-medium">Transcribing your audio...</p>
              <p className="text-sm text-muted-foreground mt-1">
                This may take a moment
              </p>
            </div>
            {remainingSeconds !== null && (
              <div className="w-full max-w-xs mt-2">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-[width] duration-500 ease-out"
                    style={{ width: `${loadingProgress * 100}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground text-center">
                  ~{remainingSeconds}s remaining
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Card className="mt-6 p-4 border-destructive/50 bg-destructive/5">
          <p className="text-sm text-destructive text-center">{error}</p>
        </Card>
      )}

      {/* Recent Transcriptions - Secondary Navigation */}
      {history && history.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Recent Transcriptions
            </h2>
            {selectedId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedId(null)}
                className="text-xs h-7 px-2"
              >
                View Latest
              </Button>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
            {history.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={cn(
                  'flex-shrink-0 rounded-lg border px-3 py-2 text-left transition-all duration-200 min-w-[180px] max-w-[240px]',
                  activeId === item.id
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border bg-card hover:bg-muted hover:border-muted-foreground/30',
                )}
              >
                <div className="text-sm font-medium truncate">
                  {item.fileName || 'Untitled'}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {new Date(item.createdAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Transcription Result */}
      {activeTranscription && (
        <Card className="mt-6 overflow-hidden">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-4 border-b bg-muted/30">
            <div>
              <h2 className="font-semibold">
                {activeTranscription.fileName || 'Transcription'}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {activeTranscription.utterances.length} segments
              </p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={copyToClipboard}
                className="flex items-center gap-2 flex-1 sm:flex-initial justify-center h-8"
              >
                <CopyIcon />
                Copy
              </Button>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="default"
                    size="sm"
                    className="flex items-center gap-2 flex-1 sm:flex-initial justify-center h-8"
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
          <div className="p-4 max-h-[60vh] overflow-y-auto">
            {activeTranscription.utterances.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No speech detected in this file.
              </p>
            ) : (
              <div className="space-y-4">
                {activeTranscription.utterances.map((utterance, index) => (
                  <div
                    key={`${utterance.start}-${index}`}
                    className="group flex gap-3"
                  >
                    <div className="flex-shrink-0 pt-0.5">
                      <Badge
                        className={cn(
                          'text-xs font-medium',
                          getSpeakerColor(utterance.speaker),
                        )}
                      >
                        {getSpeakerLabel(utterance.speaker)}
                      </Badge>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-relaxed">
                        {utterance.transcript}
                      </p>
                      <span className="text-xs text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity">
                        {formatTimestamp(utterance.start)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
