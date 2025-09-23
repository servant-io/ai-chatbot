export type ToolOption = {
  id: string;
  label: string;
  description?: string;
};

export type ToolGroup = {
  id: string;
  label: string;
  options: Array<ToolOption>;
};

export const TOOL_GROUPS: Array<ToolGroup> = [
  {
    id: 'web_search',
    label: 'Web search',
    options: [
      {
        id: 'web_search',
        label: 'Web search',
        description: 'Use OpenAI web search results when relevant.',
      },
    ],
  },
  {
    id: 'transcripts',
    label: 'Transcripts',
    options: [
      {
        id: 'searchTranscriptsByKeyword',
        label: 'Keyword search',
        description: 'Search Zoom transcripts for specific terms.',
      },
      {
        id: 'searchTranscriptsByUser',
        label: 'User search',
        description: 'Find meetings by host or participant.',
      },
      {
        id: 'getTranscriptDetails',
        label: 'Transcript details',
        description: 'Fetch full transcript context when available.',
      },
    ],
  },
  {
    id: 'slack',
    label: 'Slack',
    options: [
      {
        id: 'listAccessibleSlackChannels',
        label: 'List channels',
        description: 'Discover Slack channels you can access.',
      },
      {
        id: 'fetchSlackChannelHistory',
        label: 'Channel history',
        description: 'Pull recent Slack messages from a channel.',
      },
      {
        id: 'getSlackThreadReplies',
        label: 'Thread replies',
        description: 'Expand replies for a Slack thread.',
      },
      {
        id: 'getBulkSlackHistory',
        label: 'Bulk history',
        description: 'Retrieve Slack messages across channels at once.',
      },
    ],
  },
  {
    id: 'calendar',
    label: 'Calendar',
    options: [
      {
        id: 'listGoogleCalendarEvents',
        label: 'List events',
        description: 'Look up upcoming Google Calendar events.',
      },
    ],
  },
  {
    id: 'gmail',
    label: 'Gmail',
    options: [
      {
        id: 'listGmailMessages',
        label: 'List messages',
        description: 'Scan Gmail inbox for relevant threads.',
      },
      {
        id: 'getGmailMessageDetails',
        label: 'Message details',
        description: 'Open full Gmail threads and attachments.',
      },
    ],
  },
];

export const TOOL_OPTIONS: Array<ToolOption> = TOOL_GROUPS.flatMap(
  (group) => group.options,
);

const TOOL_ID_ORDER = TOOL_OPTIONS.map((option) => option.id);

export const DEFAULT_ACTIVE_TOOL_IDS = [...TOOL_ID_ORDER];

// Accept legacy persisted ids like `tool-web_search` by stripping the `tool-` prefix.
const normalizeToolId = (candidate: unknown) => {
  if (typeof candidate !== 'string') return null;
  if (candidate.startsWith('tool-')) {
    return candidate.slice('tool-'.length);
  }

  return candidate;
};

export const sortActiveTools = (tools: Array<string>) => {
  const normalizedIds = new Set(
    tools
      .map((toolId) => normalizeToolId(toolId))
      .filter((toolId): toolId is string => Boolean(toolId)),
  );

  return TOOL_ID_ORDER.filter((toolId) => normalizedIds.has(toolId));
};
