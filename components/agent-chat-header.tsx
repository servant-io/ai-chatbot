'use client';

import { BotIcon } from 'lucide-react';
import useSWR from 'swr';
import { fetcher } from '@/lib/utils';

interface AgentChatHeaderProps {
  agentContext: {
    agentName: string;
    agentDescription?: string;
    agentPrompt?: string;
    vectorStoreId?: string;
  };
}

export function AgentChatHeader({ agentContext }: AgentChatHeaderProps) {
  const { vectorStoreId } = agentContext;

  const { data, isLoading } = useSWR(
    vectorStoreId ? `/api/vector-stores/${vectorStoreId}` : null,
    fetcher,
  );

  return (
    <div className="border-b bg-muted/30">
      <div className="px-4 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <BotIcon className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">
            {agentContext.agentName}
          </span>
          {agentContext.agentDescription && (
            <span className="text-sm text-muted-foreground truncate">
              — {agentContext.agentDescription}
            </span>
          )}
        </div>
        {vectorStoreId && (
          <div className="mt-2 p-2 bg-muted/50 rounded">
            <h3 className="text-xs font-semibold text-foreground mb-1">
              Knowledge Base
            </h3>
            {isLoading ? (
              <p className="text-xs text-muted-foreground">
                Loading documents...
              </p>
            ) : data?.files && data.files.length > 0 ? (
              <ul className="text-xs text-muted-foreground space-y-1 max-h-32 overflow-y-auto">
                {data.files.map((file: any) => (
                  <li key={file.id} className="flex justify-between">
                    <span className="truncate">{file.name}</span>
                    <span className="ml-2">
                      {file.size
                        ? `${(file.size / 1024).toFixed(1)} KB`
                        : 'N/A'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">
                No documents in vector store.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
