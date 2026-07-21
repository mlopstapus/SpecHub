"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Key,
  Plus,
  Copy,
  Check,
  Trash2,
  Mail,
  Clock,
  CheckCircle2,
} from "lucide-react";
import {
  listApiKeys,
  createApiKey,
  revokeApiKey,
  listTeams,
  listInvitations,
  createInvitation,
  revokeInvitation,
  type ApiKey_t,
  type Team_t,
  type Invitation_t,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function SettingsPage() {
  const { user, isAdmin } = useAuth();

  // API Keys
  const [keys, setKeys] = useState<ApiKey_t[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [configCopied, setConfigCopied] = useState(false);

  // Invitations (admin only)
  const [invitations, setInvitations] = useState<Invitation_t[]>([]);
  const [teams, setTeams] = useState<Team_t[]>([]);
  const [inviting, setInviting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteTeamId, setInviteTeamId] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviteError, setInviteError] = useState("");
  const [inviteCopied, setInviteCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    listApiKeys(user.id)
      .then(setKeys)
      .catch(() => setKeys([]))
      .finally(() => setLoadingKeys(false));

    if (isAdmin) {
      listInvitations().then(setInvitations).catch(() => {});
      listTeams().then((res) => {
        setTeams(res.items);
        if (res.items.length > 0) setInviteTeamId(res.items[0].id);
      }).catch(() => {});
    }
  }, [user, isAdmin]);

  const handleCreateKey = async () => {
    if (!user || !newKeyName.trim()) return;
    try {
      const res = await createApiKey(user.id, {
        name: newKeyName.trim(),
        scopes: ["read", "expand", "write"],
      });
      setRawKey(res.raw_key);
      setKeys([res.key, ...keys]);
      setNewKeyName("");
      setCreating(false);
    } catch {}
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm("Revoke this API key? It will stop working immediately.")) return;
    try {
      await revokeApiKey(keyId);
      setKeys(keys.map((k) => (k.id === keyId ? { ...k, is_active: false } : k)));
    } catch {}
  };

  const handleCopy = () => {
    if (rawKey) {
      navigator.clipboard.writeText(rawKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const mcpConfig = rawKey
    ? JSON.stringify(
        {
          mcpServers: {
            spechub: {
              serverUrl: `${window.location.origin}/mcp/`,
              headers: {
                Authorization: `Bearer ${rawKey}`,
              },
            },
          },
        },
        null,
        2
      )
    : "";

  const handleCopyConfig = () => {
    if (mcpConfig) {
      navigator.clipboard.writeText(mcpConfig);
      setConfigCopied(true);
      setTimeout(() => setConfigCopied(false), 2000);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !inviteTeamId) return;
    setInviteError("");
    try {
      const inv = await createInvitation({
        email: inviteEmail.trim(),
        team_id: inviteTeamId,
        role: inviteRole,
      });
      setInvitations([inv, ...invitations]);
      setInviteEmail("");
      setInviting(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create invitation";
      if (msg.includes("409")) {
        setInviteError("A pending invitation already exists for this email.");
      } else {
        setInviteError(msg);
      }
    }
  };

  const handleRevokeInvite = async (id: string) => {
    if (!confirm("Revoke this invitation?")) return;
    try {
      await revokeInvitation(id);
      setInvitations(invitations.filter((i) => i.id !== id));
    } catch {}
  };

  const copyInviteLink = (token: string) => {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url);
    setInviteCopied(token);
    setTimeout(() => setInviteCopied(null), 2000);
  };

  if (loadingKeys) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-secondary rounded w-48 animate-pulse" />
        <div className="h-64 bg-secondary rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your API keys{isAdmin ? " and invite team members" : ""}.
        </p>
      </div>

      {/* Invitations (admin only) */}
      {isAdmin && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Invitations
            </CardTitle>
            {inviting ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setInviting(false);
                  setInviteError("");
                }}
              >
                Cancel
              </Button>
            ) : (
              <Button size="sm" onClick={() => setInviting(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Invite Member
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {inviting && (
              <div className="space-y-3 mb-4 p-3 rounded-md border border-dashed border-border">
                {inviteError && (
                  <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                    {inviteError}
                  </div>
                )}
                <Input
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleInvite();
                    if (e.key === "Escape") setInviting(false);
                  }}
                  autoFocus
                  className="h-8 text-sm"
                />
                <div className="flex gap-2">
                  <select
                    className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                    value={inviteTeamId}
                    onChange={(e) => setInviteTeamId(e.target.value)}
                  >
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <Button size="sm" onClick={handleInvite}>
                  Send Invitation
                </Button>
              </div>
            )}

            {invitations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No invitations yet. Invite someone to join your organization.
              </p>
            ) : (
              <div className="space-y-2">
                {invitations.map((inv) => {
                  const isPending = !inv.accepted_at;
                  const isExpired =
                    isPending && new Date(inv.expires_at) < new Date();
                  return (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between rounded-md border border-border px-4 py-2.5"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {inv.email}
                          </span>
                          <Badge
                            variant={
                              inv.accepted_at
                                ? "default"
                                : isExpired
                                ? "destructive"
                                : "secondary"
                            }
                            className="text-[10px]"
                          >
                            {inv.accepted_at ? (
                              <>
                                <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                                Accepted
                              </>
                            ) : isExpired ? (
                              "Expired"
                            ) : (
                              <>
                                <Clock className="h-2.5 w-2.5 mr-0.5" />
                                Pending
                              </>
                            )}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {inv.role}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          Invited{" "}
                          {new Date(inv.created_at).toLocaleDateString()}
                          {isPending &&
                            !isExpired &&
                            ` · Expires ${new Date(inv.expires_at).toLocaleDateString()}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {isPending && !isExpired && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => copyInviteLink(inv.token)}
                          >
                            {inviteCopied === inv.token ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        )}
                        {isPending && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-destructive hover:text-destructive"
                            onClick={() => handleRevokeInvite(inv.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Raw key banner */}
      {rawKey && (
        <Card className="border-primary">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Key className="h-5 w-5 text-primary mt-0.5" />
              <div className="flex-1 space-y-2">
                <p className="text-sm font-medium">
                  API key created. Copy it now — it won&apos;t be shown again.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm bg-[#0d0d0d] rounded px-3 py-2 font-[family-name:var(--font-geist-mono)] break-all">
                    {rawKey}
                  </code>
                  <Button variant="outline" size="sm" onClick={handleCopy}>
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <div className="mt-3 space-y-2">
                  <p className="text-sm font-medium">
                    MCP server config — paste into your IDE:
                  </p>
                  <div className="flex items-start gap-2">
                    <pre className="flex-1 text-xs bg-[#0d0d0d] rounded px-3 py-2 font-[family-name:var(--font-geist-mono)] overflow-x-auto">
                      {mcpConfig}
                    </pre>
                    <Button variant="outline" size="sm" onClick={handleCopyConfig}>
                      {configCopied ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  onClick={() => setRawKey(null)}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* API Keys */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Your API Keys</CardTitle>
          {creating ? (
            <div className="flex items-center gap-2">
              <Input
                placeholder="Key name (e.g. production)"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateKey();
                  if (e.key === "Escape") setCreating(false);
                }}
                className="h-8 w-48 text-sm"
                autoFocus
              />
              <Button size="sm" onClick={handleCreateKey}>
                Create
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCreating(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4 mr-1" />
              New Key
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {keys.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No API keys yet. Create one to get started.
            </p>
          ) : (
            <div className="space-y-3">
              {keys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between rounded-md border border-border px-4 py-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{key.name}</span>
                      {!key.is_active && (
                        <Badge variant="destructive" className="text-xs">
                          Revoked
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <code className="font-[family-name:var(--font-geist-mono)]">
                        {key.prefix}...
                      </code>
                      <Separator orientation="vertical" className="h-3" />
                      <span>{key.scopes.join(", ")}</span>
                      <Separator orientation="vertical" className="h-3" />
                      <span>
                        Created{" "}
                        {new Date(key.created_at).toLocaleDateString()}
                      </span>
                      {key.last_used_at && (
                        <>
                          <Separator orientation="vertical" className="h-3" />
                          <span>
                            Last used{" "}
                            {new Date(
                              key.last_used_at
                            ).toLocaleDateString()}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  {key.is_active && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleRevokeKey(key.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
