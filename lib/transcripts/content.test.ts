import { describe, expect, it } from 'vitest';
import {
  extractCleanedTranscriptText,
  formatTranscriptMarkdown,
  parseTranscriptTextRecord,
} from './content';

describe('extractCleanedTranscriptText', () => {
  it('returns the cleaned transcript text when present', () => {
    expect(
      extractCleanedTranscriptText({
        raw: 'WEBVTT',
        cleaned: 'Speaker: Hello there',
      }),
    ).toBe('Speaker: Hello there');
  });

  it('returns null when the payload is not a transcript content object', () => {
    expect(extractCleanedTranscriptText(null)).toBeNull();
    expect(extractCleanedTranscriptText('plain text')).toBeNull();
    expect(extractCleanedTranscriptText(['raw', 'cleaned'])).toBeNull();
  });

  it('returns null when cleaned transcript text is missing', () => {
    expect(extractCleanedTranscriptText({ raw: 'WEBVTT' })).toBeNull();
    expect(extractCleanedTranscriptText({ cleaned: 123 })).toBeNull();
  });
});

describe('transcript text formatting', () => {
  it('formats the cleaned transcript as markdown text', () => {
    const transcript = parseTranscriptTextRecord({
      id: 7,
      recording_start: '2026-03-24T15:00:00.000Z',
      summary: 'Discussed transcript delivery in MCP.',
      transcript_content: {
        raw: 'WEBVTT',
        cleaned: 'Speaker: Hello there',
      },
      projects: ['AI Chatbot'],
      clients: ['Internal'],
      meeting_type: 'internal',
      extracted_participants: ['Ethan', 'Teammate'],
    });

    expect(formatTranscriptMarkdown(transcript)).toContain('# Transcript 7');
    expect(formatTranscriptMarkdown(transcript)).toContain(
      '**Date**: March 24, 2026',
    );
    expect(formatTranscriptMarkdown(transcript)).toContain(
      'Speaker: Hello there',
    );
    expect(formatTranscriptMarkdown(transcript)).not.toContain('WEBVTT');
  });
});
