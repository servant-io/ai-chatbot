import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/utils';

export interface Transcript {
  id: number;
  recording_start: string;
  summary: string;
  projects: string[];
  clients: string[];
  meeting_type: 'internal' | 'external' | 'unknown';
  extracted_participants: string[];
  verified_participant_emails?: string[];
  can_view_full_content?: boolean;
  shared_in_teams?: string[];
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export function useTranscripts() {
  // Default scope is "mine" (/api/transcripts). Use "shared" for team-shared items.
  const [scope, setScopeState] = useState<'mine' | 'shared'>('mine');
  const [searchTerm, setSearchTermState] = useState('');
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  });

  const setScope = (nextScope: 'mine' | 'shared') => {
    setScopeState(nextScope);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const setSearchTerm = (nextTerm: string) => {
    setSearchTermState(nextTerm);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const cacheKey = useMemo(() => {
    const basePath =
      scope === 'shared' ? '/api/transcripts/shared' : '/api/transcripts';
    const params = new URLSearchParams({
      page: pagination.page.toString(),
      limit: pagination.limit.toString(),
    });
    return `${basePath}?${params}`;
  }, [pagination.page, pagination.limit, scope]);

  const { data, error, isLoading } = useSWR(cacheKey, fetcher);

  useEffect(() => {
    if (data?.pagination) {
      setPagination(data.pagination);
    }
  }, [data]);

  const filteredTranscripts = useMemo(() => {
    const transcripts: Transcript[] = data?.data || [];
    return transcripts.filter(
      (transcript) =>
        transcript.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transcript.extracted_participants.some((participant) =>
          participant.toLowerCase().includes(searchTerm.toLowerCase()),
        ),
    );
  }, [data?.data, searchTerm]);

  const groupedTranscripts = useMemo(() => {
    const groups: { [key: string]: Transcript[] } = {};
    filteredTranscripts.forEach((transcript) => {
      const date = new Date(transcript.recording_start);
      const dateKey = date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      });
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(transcript);
    });
    return groups;
  }, [filteredTranscripts]);

  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  return {
    scope,
    setScope,
    searchTerm,
    setSearchTerm,
    pagination,
    handlePageChange,
    groupedTranscripts,
    filteredTranscripts,
    isLoading,
    error,
  };
}
