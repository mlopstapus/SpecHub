"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Users,
  Plus,
  ChevronRight,
  Shield,
  Target,
  Trash2,
  ArrowLeft,
  Lock,
  UserPlus,
} from "lucide-react";
import {
  listTeams,
  listUsers,
  createTeam,
  createUser,
  deleteTeam,
  deleteUser,
  createPolicy,
  createObjective,
  getEffectivePolicies,
  getEffectiveObjectives,
  type Team_t,
  type User_t,
  type Policy_t,
  type Objective_t,
  type EnforcementType,
} from "@/lib/api";

export default function TeamsPage() {
  const [rootTeams, setRootTeams] = useState<Team_t[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team_t | null>(null);
  const [subTeams, setSubTeams] = useState<Team_t[]>([]);
  const [members, setMembers] = useState<User_t[]>([]);
  const [breadcrumb, setBreadcrumb] = useState<Team_t[]>([]);
  const [loading, setLoading] = useState(true);

  // Create team form
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");

  // Create user form
  const [creatingUser, setCreatingUser] = useState(false);
  const [newUsername, setNewUsername] = useState("");

  // Policies & Objectives for selected user
  const [selectedUser, setSelectedUser] = useState<User_t | null>(null);
  const [effectivePolicies, setEffectivePolicies] = useState<{
    inherited: Policy_t[];
    local: Policy_t[];
  } | null>(null);
  const [effectiveObjectives, setEffectiveObjectives] = useState<{
    inherited: Objective_t[];
    local: Objective_t[];
  } | null>(null);

  // Create policy form
  const [creatingPolicy, setCreatingPolicy] = useState(false);
  const [newPolicyName, setNewPolicyName] = useState("");
  const [newPolicyContent, setNewPolicyContent] = useState("");
  const [newPolicyType, setNewPolicyType] = useState<EnforcementType>("prepend");

  // Create objective form
  const [creatingObjective, setCreatingObjective] = useState(false);
  const [newObjectiveTitle, setNewObjectiveTitle] = useState("");

  useEffect(() => {
    loadRootTeams();
  }, []);

  async function loadRootTeams() {
    setLoading(true);
    try {
      const res = await listTeams();
      setRootTeams(res.items);
    } catch {}
    setLoading(false);
  }

  async function selectTeam(team: Team_t) {
    setSelectedTeam(team);
    setSelectedUser(null);
    setEffectivePolicies(null);
    setEffectiveObjectives(null);

    const newBreadcrumb = [...breadcrumb];
    const idx = newBreadcrumb.findIndex((t) => t.id === team.id);
    if (idx >= 0) {
      newBreadcrumb.splice(idx + 1);
    } else {
      newBreadcrumb.push(team);
    }
    setBreadcrumb(newBreadcrumb);

    try {
      const [subs, mems] = await Promise.all([
        listTeams(team.id),
        listUsers(team.id),
      ]);
      setSubTeams(subs.items);
      setMembers(mems.items);
    } catch {}
  }

  async function goBack() {
    if (breadcrumb.length <= 1) {
      setSelectedTeam(null);
      setBreadcrumb([]);
      setSubTeams([]);
      setMembers([]);
      setSelectedUser(null);
      return;
    }
    const newBc = breadcrumb.slice(0, -1);
    setBreadcrumb(newBc);
    const parent = newBc[newBc.length - 1];
    await selectTeamDirect(parent, newBc);
  }

  async function selectTeamDirect(team: Team_t, bc: Team_t[]) {
    setSelectedTeam(team);
    setBreadcrumb(bc);
    setSelectedUser(null);
    setEffectivePolicies(null);
    setEffectiveObjectives(null);
    try {
      const [subs, mems] = await Promise.all([
        listTeams(team.id),
        listUsers(team.id),
      ]);
      setSubTeams(subs.items);
      setMembers(mems.items);
    } catch {}
  }

  async function handleCreateTeam() {
    if (!newTeamName.trim()) return;
    const slug = newTeamName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    try {
      const team = await createTeam({
        name: newTeamName.trim(),
        slug,
        parent_team_id: selectedTeam?.id,
      });
      if (selectedTeam) {
        setSubTeams([...subTeams, team]);
      } else {
        setRootTeams([...rootTeams, team]);
      }
      setNewTeamName("");
      setCreatingTeam(false);
    } catch {}
  }

  async function handleCreateUser() {
    if (!newUsername.trim() || !selectedTeam) return;
    try {
      const user = await createUser({
        username: newUsername.trim().toLowerCase().replace(/\s+/g, "-"),
        display_name: newUsername.trim(),
        team_id: selectedTeam.id,
      });
      setMembers([...members, user]);
      setNewUsername("");
      setCreatingUser(false);
    } catch {}
  }

  async function handleDeleteTeam(id: string) {
    if (!confirm("Delete this team?")) return;
    try {
      await deleteTeam(id);
      if (selectedTeam) {
        setSubTeams(subTeams.filter((t) => t.id !== id));
      } else {
        setRootTeams(rootTeams.filter((t) => t.id !== id));
      }
    } catch {}
  }

  async function handleDeleteUser(id: string) {
    if (!confirm("Delete this user?")) return;
    try {
      await deleteUser(id);
      setMembers(members.filter((u) => u.id !== id));
      if (selectedUser?.id === id) setSelectedUser(null);
    } catch {}
  }

  async function handleSelectUser(user: User_t) {
    setSelectedUser(user);
    try {
      const [pol, obj] = await Promise.all([
        getEffectivePolicies(user.id),
        getEffectiveObjectives(user.id),
      ]);
      setEffectivePolicies(pol);
      setEffectiveObjectives(obj);
    } catch {}
  }

  async function handleCreatePolicy() {
    if (!newPolicyName.trim() || !newPolicyContent.trim() || !selectedTeam) return;
    try {
      await createPolicy({
        team_id: selectedTeam.id,
        name: newPolicyName.trim(),
        enforcement_type: newPolicyType,
        content: newPolicyContent.trim(),
      });
      setNewPolicyName("");
      setNewPolicyContent("");
      setCreatingPolicy(false);
      // Refresh if user is selected
      if (selectedUser) await handleSelectUser(selectedUser);
    } catch {}
  }

  async function handleCreateObjective() {
    if (!newObjectiveTitle.trim() || !selectedTeam) return;
    try {
      await createObjective({
        team_id: selectedTeam.id,
        title: newObjectiveTitle.trim(),
      });
      setNewObjectiveTitle("");
      setCreatingObjective(false);
      if (selectedUser) await handleSelectUser(selectedUser);
    } catch {}
  }

  const teamsToShow = selectedTeam ? subTeams : rootTeams;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Teams</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your team hierarchy, members, policies, and objectives.
        </p>
      </div>

      {/* Breadcrumb */}
      {breadcrumb.length > 0 && (
        <div className="flex items-center gap-1 text-sm">
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={goBack}>
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Back
          </Button>
          <Separator orientation="vertical" className="h-4 mx-1" />
          <button
            className="text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => {
              setSelectedTeam(null);
              setBreadcrumb([]);
              setSubTeams([]);
              setMembers([]);
              setSelectedUser(null);
            }}
          >
            All Teams
          </button>
          {breadcrumb.map((t, i) => (
            <span key={t.id} className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
              <button
                className={
                  i === breadcrumb.length - 1
                    ? "font-medium"
                    : "text-muted-foreground hover:text-foreground transition-colors"
                }
                onClick={() => {
                  const bc = breadcrumb.slice(0, i + 1);
                  selectTeamDirect(t, bc);
                }}
              >
                {t.name}
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {/* Left column: Teams + Members */}
        <div className="md:col-span-1 space-y-4">
          {/* Sub-teams / Root teams */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="text-sm font-medium">
                {selectedTeam ? "Sub-teams" : "Teams"}
              </CardTitle>
              {creatingTeam ? (
                <div className="flex items-center gap-1.5">
                  <Input
                    placeholder="Team name"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateTeam();
                      if (e.key === "Escape") setCreatingTeam(false);
                    }}
                    className="h-7 w-32 text-xs"
                    autoFocus
                  />
                  <Button size="sm" className="h-7 text-xs" onClick={handleCreateTeam}>
                    Add
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7"
                  onClick={() => setCreatingTeam(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              )}
            </CardHeader>
            <CardContent className="pt-0">
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-10 bg-secondary rounded animate-pulse" />
                  ))}
                </div>
              ) : teamsToShow.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No {selectedTeam ? "sub-teams" : "teams"} yet.
                </p>
              ) : (
                <div className="space-y-1">
                  {teamsToShow.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between rounded-md border border-border px-3 py-2 hover:bg-secondary/50 transition-colors cursor-pointer group"
                      onClick={() => selectTeam(t)}
                    >
                      <div className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm">{t.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTeam(t.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Members (only when a team is selected) */}
          {selectedTeam && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <CardTitle className="text-sm font-medium">Members</CardTitle>
                {creatingUser ? (
                  <div className="flex items-center gap-1.5">
                    <Input
                      placeholder="Username"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCreateUser();
                        if (e.key === "Escape") setCreatingUser(false);
                      }}
                      className="h-7 w-28 text-xs"
                      autoFocus
                    />
                    <Button size="sm" className="h-7 text-xs" onClick={handleCreateUser}>
                      Add
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7"
                    onClick={() => setCreatingUser(true)}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                  </Button>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                {members.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No members yet.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {members.map((u) => (
                      <div
                        key={u.id}
                        className={`flex items-center justify-between rounded-md border px-3 py-2 cursor-pointer transition-colors group ${
                          selectedUser?.id === u.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-secondary/50"
                        }`}
                        onClick={() => handleSelectUser(u)}
                      >
                        <div>
                          <span className="text-sm font-medium">
                            {u.display_name || u.username}
                          </span>
                          <span className="text-xs text-muted-foreground ml-2">
                            @{u.username}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteUser(u.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column: Policies & Objectives */}
        <div className="md:col-span-2 space-y-4">
          {selectedTeam && (
            <>
              {/* Team Policies */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between py-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Policies — {selectedTeam.name}
                  </CardTitle>
                  {creatingPolicy ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => setCreatingPolicy(false)}
                    >
                      Cancel
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7"
                      onClick={() => setCreatingPolicy(true)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="pt-0">
                  {creatingPolicy && (
                    <div className="space-y-2 mb-4 p-3 rounded-md border border-dashed border-border">
                      <Input
                        placeholder="Policy name"
                        value={newPolicyName}
                        onChange={(e) => setNewPolicyName(e.target.value)}
                        className="h-8 text-sm"
                        autoFocus
                      />
                      <select
                        className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                        value={newPolicyType}
                        onChange={(e) =>
                          setNewPolicyType(e.target.value as EnforcementType)
                        }
                      >
                        <option value="prepend">Prepend (to system message)</option>
                        <option value="append">Append (to user message)</option>
                        <option value="inject">Inject (as template variable)</option>
                        <option value="validate">Validate (post-render check)</option>
                      </select>
                      <textarea
                        placeholder="Policy content..."
                        value={newPolicyContent}
                        onChange={(e) => setNewPolicyContent(e.target.value)}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px] resize-y"
                      />
                      <Button size="sm" onClick={handleCreatePolicy}>
                        Create Policy
                      </Button>
                    </div>
                  )}

                  {selectedUser && effectivePolicies ? (
                    <div className="space-y-3">
                      {effectivePolicies.inherited.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                            <Lock className="h-3 w-3" /> Inherited (immutable)
                          </p>
                          {effectivePolicies.inherited.map((p) => (
                            <div
                              key={p.id}
                              className="flex items-center gap-2 rounded-md bg-secondary/30 px-3 py-2 mb-1"
                            >
                              <Badge variant="outline" className="text-[10px] shrink-0">
                                {p.enforcement_type}
                              </Badge>
                              <span className="text-sm">{p.name}</span>
                              <span className="text-xs text-muted-foreground truncate">
                                — {p.content.slice(0, 60)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      {effectivePolicies.local.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">
                            Local (mutable)
                          </p>
                          {effectivePolicies.local.map((p) => (
                            <div
                              key={p.id}
                              className="flex items-center gap-2 rounded-md border border-border px-3 py-2 mb-1"
                            >
                              <Badge variant="secondary" className="text-[10px] shrink-0">
                                {p.enforcement_type}
                              </Badge>
                              <span className="text-sm">{p.name}</span>
                              <span className="text-xs text-muted-foreground truncate">
                                — {p.content.slice(0, 60)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      {effectivePolicies.inherited.length === 0 &&
                        effectivePolicies.local.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-4">
                            No policies for this user.
                          </p>
                        )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Select a member to see their effective policies.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Team Objectives */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between py-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Objectives — {selectedTeam.name}
                  </CardTitle>
                  {creatingObjective ? (
                    <div className="flex items-center gap-1.5">
                      <Input
                        placeholder="Objective title"
                        value={newObjectiveTitle}
                        onChange={(e) => setNewObjectiveTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleCreateObjective();
                          if (e.key === "Escape") setCreatingObjective(false);
                        }}
                        className="h-7 w-48 text-xs"
                        autoFocus
                      />
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        onClick={handleCreateObjective}
                      >
                        Add
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7"
                      onClick={() => setCreatingObjective(true)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="pt-0">
                  {selectedUser && effectiveObjectives ? (
                    <div className="space-y-3">
                      {effectiveObjectives.inherited.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                            <Lock className="h-3 w-3" /> Inherited (immutable)
                          </p>
                          {effectiveObjectives.inherited.map((o) => (
                            <div
                              key={o.id}
                              className="rounded-md bg-secondary/30 px-3 py-2 mb-1"
                            >
                              <span className="text-sm">{o.title}</span>
                              {o.description && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {o.description}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {effectiveObjectives.local.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">
                            Local (mutable)
                          </p>
                          {effectiveObjectives.local.map((o) => (
                            <div
                              key={o.id}
                              className="rounded-md border border-border px-3 py-2 mb-1"
                            >
                              <span className="text-sm">{o.title}</span>
                              {o.description && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {o.description}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {effectiveObjectives.inherited.length === 0 &&
                        effectiveObjectives.local.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-4">
                            No objectives for this user.
                          </p>
                        )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Select a member to see their effective objectives.
                    </p>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {!selectedTeam && (
            <Card className="py-12">
              <CardContent className="text-center">
                <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">
                  Select a team to view its members, policies, and objectives.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
