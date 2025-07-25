import { GmailIcon, SlackIcon, ZoomIcon, CalendarIcon, MemoryIcon } from './icons';
import type { ToolConfig } from './unified-tool';



export const gmailToolConfig: ToolConfig = {
  icon: GmailIcon,
  
  getToolType: (toolCallId: string) => {
    if (toolCallId.includes('listGmailMessages')) return 'tool-listGmailMessages';
    if (toolCallId.includes('getGmailMessageDetails')) return 'tool-getGmailMessageDetails';
    return 'unknown';
  },
  
  formatParameters: (input: any, toolType: string) => {
    if (!input) return '';
    const params = [];
    
    switch (toolType) {
      case 'tool-listGmailMessages': {
        if (input.query) params.push(`query: "${input.query}"`);
        if (input.maxResults) params.push(`limit: ${input.maxResults}`);
        if (input.labelIds?.length) params.push(`labels: ${input.labelIds.join(', ')}`);
        if (input.includeSpamTrash) params.push('include spam/trash');
        break;
      }
      case 'tool-getGmailMessageDetails': {
        if (input.messageIds?.length) {
          const count = input.messageIds.length;
          params.push(`${count} message${count > 1 ? 's' : ''}`);
        }
        if (input.format) params.push(`format: ${input.format}`);
        if (input.includeAttachments === false) params.push('no attachments');
        break;
      }
    }
    
    return params.length > 0 ? `(${params.join(', ')})` : '';
  },
  
  getAction: (toolType: string, state: 'input' | 'output') => {
    const isInput = state === 'input';
    switch (toolType) {
      case 'tool-listGmailMessages':
        return isInput ? 'Listing Gmail messages' : 'Listed Gmail messages';
      case 'tool-getGmailMessageDetails':
        return isInput ? 'Fetching Gmail message details' : 'Fetched Gmail message details';
      default:
        return isInput ? 'Processing Gmail request' : 'Gmail request completed';
    }
  }
};

export const slackToolConfig: ToolConfig = {
  icon: SlackIcon,
  
  getToolType: (toolCallId: string) => {
    if (toolCallId.includes('listAccessibleSlackChannels')) return 'tool-listAccessibleSlackChannels';
    if (toolCallId.includes('fetchSlackChannelHistory')) return 'tool-fetchSlackChannelHistory';
    if (toolCallId.includes('getBulkSlackHistory')) return 'tool-getBulkSlackHistory';
    if (toolCallId.includes('getSlackThreadReplies')) return 'tool-getSlackThreadReplies';
    return 'unknown';
  },
  
  formatParameters: (input: any, toolType: string) => {
    if (!input) return '';
    const params = [];
    
    switch (toolType) {
      case 'tool-listAccessibleSlackChannels':
        return '(listing accessible channels)';
      case 'tool-fetchSlackChannelHistory':
        if (input.channel) params.push(`channel: ${input.channel}`);
        if (input.limit) params.push(`limit: ${input.limit}`);
        break;
      case 'tool-getBulkSlackHistory':
        if (input.channels?.length) params.push(`channels: ${input.channels.length}`);
        if (input.limit) params.push(`limit: ${input.limit}`);
        break;
      case 'tool-getSlackThreadReplies':
        if (input.channel) params.push(`channel: ${input.channel}`);
        if (input.thread_ts) params.push(`thread: ${input.thread_ts}`);
        break;
    }
    
    return params.length > 0 ? `(${params.join(', ')})` : '';
  },
  
  getAction: (toolType: string, state: 'input' | 'output') => {
    const isInput = state === 'input';
    switch (toolType) {
      case 'tool-listAccessibleSlackChannels':
        return isInput ? 'Listing slack channels' : 'Listed slack channels';
      default:
        return isInput ? 'Fetching slack messages' : 'Fetched slack messages';
    }
  }
};

export const transcriptToolConfig: ToolConfig = {
  icon: ZoomIcon,
  
  getToolType: (toolCallId: string) => {
    if (toolCallId.includes('searchTranscriptsByKeyword')) return 'tool-searchTranscriptsByKeyword';
    if (toolCallId.includes('searchTranscriptsByUser')) return 'tool-searchTranscriptsByUser';
    if (toolCallId.includes('getTranscriptDetails')) return 'tool-getTranscriptDetails';
    return 'unknown';
  },
  
  formatParameters: (input: any, toolType: string) => {
    if (!input) return '';
    const params = [];
    
    switch (toolType) {
      case 'tool-searchTranscriptsByKeyword':
        if (input.keyword) params.push(`keyword: "${input.keyword}"`);
        if (input.limit) params.push(`limit: ${input.limit}`);
        if (input.scope && input.scope !== 'summary') params.push(`scope: ${input.scope}`);
        if (input.fuzzy) params.push('fuzzy search');
        if (input.start_date) params.push(`from: ${input.start_date}`);
        if (input.end_date) params.push(`to: ${input.end_date}`);
        if (input.meeting_type) params.push(`type: ${input.meeting_type}`);
        break;
      case 'tool-searchTranscriptsByUser':
        if (input.participant_name) params.push(`participant: "${input.participant_name}"`);
        if (input.host_email) params.push(`host: "${input.host_email}"`);
        if (input.verified_participant_email) params.push(`verified: "${input.verified_participant_email}"`);
        if (input.limit) params.push(`limit: ${input.limit}`);
        if (input.start_date) params.push(`from: ${input.start_date}`);
        if (input.end_date) params.push(`to: ${input.end_date}`);
        if (input.meeting_type) params.push(`type: ${input.meeting_type}`);
        break;
      case 'tool-getTranscriptDetails':
        if (input.transcript_ids?.length) {
          const ids = input.transcript_ids.join(', ');
          params.push(`IDs: ${ids}`);
        }
        break;
    }
    
    return params.length > 0 ? `(${params.join(', ')})` : '';
  },
  
  getAction: (toolType: string, state: 'input' | 'output') => {
    const isInput = state === 'input';
    return isInput ? 'searching zoom' : 'Search completed';
  },
  
  getResultSummary: (output: any, input: any, toolType: string) => {
    if (!output || 'error' in output) return '';
    
    try {
      // Extract result count from transcript tool output
      if (typeof output.result === 'string') {
        const match = output.result.match(/<[^>]+>\s*(\[.*?\])\s*<\/[^>]+>/s);
        if (match) {
          const jsonArray = JSON.parse(match[1]);
          const count = Array.isArray(jsonArray) ? jsonArray.length : 0;
          return `(${count} results)`;
        }
      }
    } catch {
      // If parsing fails, no summary
    }
    
    return '';
  }
};

export const calendarToolConfig: ToolConfig = {
  icon: CalendarIcon,
  
  getToolType: () => 'tool-listGoogleCalendarEvents',
  
  formatParameters: (input: any) => {
    if (!input) return '';
    const params = [];
    
    if (input.timeMin) params.push(`from: ${new Date(input.timeMin).toLocaleDateString()}`);
    if (input.timeMax) params.push(`to: ${new Date(input.timeMax).toLocaleDateString()}`);
    if (input.maxResults) params.push(`limit: ${input.maxResults}`);
    
    return params.length > 0 ? `(${params.join(', ')})` : '';
  },
  
  getAction: (toolType: string, state: 'input' | 'output') => {
    const isInput = state === 'input';
    return isInput ? 'Listing calendar events' : 'Listed calendar events';
  }
};

export const mem0ToolConfig: ToolConfig = {
  icon: MemoryIcon, // Using calendar icon for now, could add a specific Mem0 icon later
  
  getToolType: (toolCallId: string) => {
    if (toolCallId.includes('getMem0Projects')) return 'tool-getMem0Projects';
    if (toolCallId.includes('getMem0Memories')) return 'tool-getMem0Memories';
    if (toolCallId.includes('createMem0Project')) return 'tool-createMem0Project';
    if (toolCallId.includes('createMem0Memory')) return 'tool-createMem0Memory';
    return 'unknown';
  },
  
  formatParameters: (input: any, toolType: string) => {
    if (!input) return '';
    const params = [];
    
    switch (toolType) {
      case 'tool-getMem0Projects':
        return '(listing all projects)';
      case 'tool-getMem0Memories':
        if (input.projectId) params.push(`project: ${input.projectId}`);
        if (input.query) params.push(`query: "${input.query}"`);
        if (input.userId) params.push(`user: ${input.userId}`);
        break;
      case 'tool-createMem0Project':
        if (input.name) params.push(`name: "${input.name}"`);
        if (input.description) params.push(`description: "${input.description}"`);
        break;
      case 'tool-createMem0Memory':
        if (input.projectId) params.push(`project: ${input.projectId}`);
        if (input.messages) params.push(`messages: ${input.messages.length}`);
        if (input.metadata) params.push(`metadata: ${Object.keys(input.metadata).length} fields`);
        break;
    }
    
    return params.length > 0 ? `(${params.join(', ')})` : '';
  },
  
  getAction: (toolType: string, state: 'input' | 'output') => {
    const isInput = state === 'input';
    switch (toolType) {
      case 'tool-getMem0Projects':
        return isInput ? 'Fetching projects' : 'Fetched projects';
      case 'tool-getMem0Memories':
        return isInput ? 'Fetching memories' : 'Fetched memories';
      case 'tool-createMem0Project':
        return isInput ? 'Creating project' : 'Created project';
      case 'tool-createMem0Memory':
        return isInput ? 'Creating memory' : 'Created memory';
      default:
        return isInput ? 'Processing' : 'Completed';
    }
  },
  
  getResultSummary: (output: any, input: any, toolType: string) => {
    if (!output || 'error' in output) return '';
    
    try {
      if (typeof output.result === 'string') {
        // Parse the wrapped result to get the actual data
        const boundaryMatch = output.result.match(/<[^>]+>\s*({.*?})\s*<\/[^>]+>/s);
        if (boundaryMatch) {
          const data = JSON.parse(boundaryMatch[1]);
          
          switch (toolType) {
            case 'tool-getMem0Projects':
              if (data.projects && Array.isArray(data.projects)) {
                return `(${data.projects.length} projects)`;
              }
              break;
            case 'tool-getMem0Memories':
              if (data.memories && Array.isArray(data.memories)) {
                return `(${data.memories.length} memories)`;
              }
              break;
            case 'tool-createMem0Project':
              if (data.project) {
                return `(project created)`;
              }
              break;
            case 'tool-createMem0Memory':
              if (data.memory) {
                return `(memory created)`;
              }
              break;
          }
        }
      }
    } catch {
      // If parsing fails, no summary
    }
    
    return '';
  }
};