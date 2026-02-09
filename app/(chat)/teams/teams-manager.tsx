'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { z } from 'zod/v4';
import { fetcher } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

type TeamListItem = {
  id: string;
  name: string;
  createdByEmail: string;
  createdAt: string | Date;
  role: 'owner' | 'member';
};

type TeamDetailsResponse = {
  data: {
    team: TeamListItem;
    members: Array<{
      teamId: string;
      userEmail: string;
      role: 'owner' | 'member';
      createdAt: string | Date;
      createdByEmail: string;
    }>;
    rules: Array<{
      id: string;
      teamId: string;
      type: 'summary_topic_exact';
      value: string;
      enabled: boolean;
      createdAt: string | Date;
      createdByEmail: string;
    }>;
  };
};

const createTeamSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

const memberEmailSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(256),
});

const createRuleSchema = z.object({
  value: z.string().trim().min(1).max(200),
});

export function TeamsManager() {
  const { data: teamsResponse, mutate: mutateTeams } = useSWR<{
    data: TeamListItem[];
  }>('/api/teams', fetcher);

  const teams = teamsResponse?.data ?? [];

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const selectedTeam = useMemo(
    () => teams.find((t) => t.id === selectedTeamId) ?? null,
    [teams, selectedTeamId],
  );

  const { data: teamDetailsResponse, mutate: mutateTeamDetails } =
    useSWR<TeamDetailsResponse>(
      selectedTeamId ? `/api/teams/${selectedTeamId}` : null,
      fetcher,
    );

  const teamDetails = teamDetailsResponse?.data ?? null;

  const [newTeamName, setNewTeamName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  const [ruleValue, setRuleValue] = useState('');
  const [isAddingRule, setIsAddingRule] = useState(false);

  const isOwner = teamDetails?.team.role === 'owner';

  const createTeam = async () => {
    const parsed = createTeamSchema.safeParse({ name: newTeamName });
    if (!parsed.success || isCreating) return;

    setIsCreating(true);
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });

      if (!res.ok) {
        throw new Error('Failed to create team');
      }

      setNewTeamName('');
      await mutateTeams();
    } finally {
      setIsCreating(false);
    }
  };

  const inviteMember = async () => {
    if (!selectedTeamId) return;
    const parsed = memberEmailSchema.safeParse({ email: inviteEmail });
    if (!parsed.success || isInviting) return;

    setIsInviting(true);
    try {
      const res = await fetch(`/api/teams/${selectedTeamId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });

      if (!res.ok) {
        throw new Error('Failed to add member');
      }

      setInviteEmail('');
      await mutateTeamDetails();
      await mutateTeams();
    } finally {
      setIsInviting(false);
    }
  };

  const removeMember = async (email: string) => {
    if (!selectedTeamId) return;

    setIsInviting(true);
    try {
      const res = await fetch(`/api/teams/${selectedTeamId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        throw new Error('Failed to remove member');
      }

      await mutateTeamDetails();
    } finally {
      setIsInviting(false);
    }
  };

  const addRule = async () => {
    if (!selectedTeamId) return;
    const parsed = createRuleSchema.safeParse({ value: ruleValue });
    if (!parsed.success || isAddingRule) return;

    setIsAddingRule(true);
    try {
      const res = await fetch(`/api/teams/${selectedTeamId}/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'summary_topic_exact',
          value: parsed.data.value,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to add rule');
      }

      setRuleValue('');
      await mutateTeamDetails();
    } finally {
      setIsAddingRule(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>Your teams</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="New team name"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') createTeam();
              }}
            />
            <Button
              onClick={createTeam}
              disabled={isCreating || !newTeamName.trim()}
            >
              Create
            </Button>
          </div>

          <Separator />

          <div className="space-y-2">
            {teams.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No teams yet. Create one to start sharing transcripts.
              </p>
            ) : (
              teams.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`w-full text-left px-3 py-2 rounded-md border transition-colors ${
                    selectedTeamId === t.id
                      ? 'bg-muted border-border'
                      : 'hover:bg-muted/50 border-transparent'
                  }`}
                  onClick={() => setSelectedTeamId(t.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{t.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {t.role}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    Owner: {t.createdByEmail}
                  </div>
                </button>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>
            {selectedTeam ? selectedTeam.name : 'Select a team'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {!teamDetails ? (
            <p className="text-sm text-muted-foreground">
              Choose a team to view members and rules.
            </p>
          ) : (
            <>
              <div className="space-y-3">
                <h3 className="font-semibold">Members</h3>

                {isOwner ? (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add @servant.io email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') inviteMember();
                      }}
                    />
                    <Button
                      onClick={inviteMember}
                      disabled={isInviting || !inviteEmail.trim()}
                    >
                      Add
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Only the team owner can add or remove members.
                  </p>
                )}

                <div className="space-y-2">
                  {teamDetails.members.map((m) => (
                    <div
                      key={`${m.teamId}-${m.userEmail}`}
                      className="flex items-center justify-between gap-2 border rounded-md px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate">
                          {m.userEmail}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {m.role}
                        </div>
                      </div>
                      {isOwner && m.role !== 'owner' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isInviting}
                          onClick={() => removeMember(m.userEmail)}
                        >
                          Remove
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="font-semibold">Auto-share rules (MVP)</h3>
                <p className="text-sm text-muted-foreground">
                  Currently matches the “Topic:” line extracted from transcript
                  summaries. Once we have the raw Zoom meeting title in the
                  transcript payload, we can switch rules to that field.
                </p>

                {isOwner ? (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Exact meeting title/topic"
                      value={ruleValue}
                      onChange={(e) => setRuleValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') addRule();
                      }}
                    />
                    <Button
                      onClick={addRule}
                      disabled={isAddingRule || !ruleValue.trim()}
                    >
                      Add rule
                    </Button>
                  </div>
                ) : null}

                <div className="space-y-2">
                  {teamDetails.rules.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No rules yet.
                    </p>
                  ) : (
                    teamDetails.rules.map((r) => (
                      <div key={r.id} className="border rounded-md px-3 py-2">
                        <div className="text-sm font-medium">{r.value}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.type} {r.enabled ? 'enabled' : 'disabled'}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
