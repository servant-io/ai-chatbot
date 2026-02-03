import type { NextRequest } from 'next/server';
import { withAuth } from '@workos-inc/authkit-nextjs';
import { createClient } from '@supabase/supabase-js';
import {
  getDirectlySharedTranscriptIdsByUserEmail,
  getEnabledTeamTranscriptRulesByUserEmail,
  getSharedTranscriptTeamsByUserEmail,
  shareTranscriptToTeam,
} from '@/lib/db/queries';

const extractTopicFromSummary = (summary: string): string => {
  if (!summary) return '';

  const topicMatch = summary.match(/Topic:\s*([^\n]*)/i);
  if (topicMatch?.[1]) {
    return topicMatch[1].trim();
  }

  return summary.split('\n')[0]?.trim() ?? '';
};

export async function GET(request: NextRequest) {
  console.log('transcripts route request', {
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers),
    xWorkosMiddleware: request.headers.get('x-workos-middleware'),
    xMiddlewareSubrequest: request.headers.get('x-middleware-subrequest'),
  });
  try {
    const session = await withAuth();
    console.log('transcripts route session', {
      user: session.user,
      sessionId: session.sessionId,
      organizationId: session.organizationId,
      role: session.role,
      roles: session.roles,
      permissions: session.permissions,
      entitlements: session.entitlements,
      featureFlags: session.featureFlags,
      impersonator: session.impersonator,
    });

    const { user } = session;

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse pagination parameters
    const { searchParams } = new URL(request.url);
    const page = Number.parseInt(searchParams.get('page') || '1', 10);
    const limit = Number.parseInt(searchParams.get('limit') || '20', 10);
    const offset = (page - 1) * limit;

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return Response.json(
        { error: 'Database configuration missing' },
        { status: 500 },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Build base query
    let baseQuery = supabase
      .from('transcripts')
      .select(
        'id, recording_start, summary, projects, clients, meeting_type, extracted_participants, verified_participant_emails',
      );

    // Only return transcripts where user is a verified participant (applies to all users)
    if (user.email) {
      baseQuery = baseQuery.contains('verified_participant_emails', [
        user.email,
      ]);
    }

    // Get total count for pagination - match main query filtering
    let countQuery = supabase
      .from('transcripts')
      .select('*', { count: 'exact', head: true });

    if (user.email) {
      countQuery = countQuery.contains('verified_participant_emails', [
        user.email,
      ]);
    }

    const { count, error: countError } = await countQuery;

    // Get paginated results
    const { data, error } = await baseQuery
      .order('recording_start', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Database error:', error);
      return Response.json(
        { error: 'Failed to fetch transcripts' },
        { status: 500 },
      );
    }

    const canShareTranscripts = session.role !== 'member';

    if (canShareTranscripts && user.email && data && data.length > 0) {
      const rules = await getEnabledTeamTranscriptRulesByUserEmail({
        userEmail: user.email,
      });

      if (rules.length > 0) {
        for (const transcript of data) {
          const topic = extractTopicFromSummary(transcript.summary ?? '');
          if (!topic) continue;

          for (const rule of rules) {
            if (rule.type !== 'summary_topic_exact') continue;

            if (topic.toLowerCase() === rule.value.trim().toLowerCase()) {
              await shareTranscriptToTeam({
                teamId: rule.teamId,
                transcriptId: transcript.id,
                createdByEmail: user.email,
              });
            }
          }
        }
      }
    }

    const sharedTeamMap = new Map<number, Array<string>>();
    let sharedTranscriptIds = new Set<number>();

    if (user.email) {
      const [teamShares, directShares] = await Promise.all([
        getSharedTranscriptTeamsByUserEmail({ userEmail: user.email }),
        getDirectlySharedTranscriptIdsByUserEmail({ userEmail: user.email }),
      ]);

      for (const share of teamShares) {
        const names = sharedTeamMap.get(share.transcriptId);
        if (names) {
          names.push(share.teamName);
        } else {
          sharedTeamMap.set(share.transcriptId, [share.teamName]);
        }
      }

      const teamShareIds = teamShares.map((share) => share.transcriptId);
      sharedTranscriptIds = new Set([...teamShareIds, ...directShares]);
    }

    const items = (data ?? []).map((row) => ({
      ...row,
      can_view_full_content:
        canShareTranscripts || sharedTranscriptIds.has(row.id),
      shared_in_teams: sharedTeamMap.get(row.id) ?? [],
    }));

    return Response.json({
      data: items,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        hasNext: page < Math.ceil((count || 0) / limit),
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error('API error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
