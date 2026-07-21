"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  FolderOpen,
  Target,
  Users,
  UserPlus,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  Save,
} from "lucide-react";
import {
  getProject,
  updateProject,
  listProjectMembers,
  addProjectMember,
  removeProjectMember,
  listProjectObjectives,
  createProjectObjective,
  deleteObjective,
  updateObjective,
  listUsers,
  listTeams,
  type Project_t,
  type ProjectMember_t,
  type Objective_t,
  type User_t,
  type Team_t,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  useAuth();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project_t | null>(null);
  const [members, setMembers] = useState<ProjectMember_t[]>([]);
  const [objectives, setObjectives] = useState<Objective_t[]>([]);
  const [allUsers, setAllUsers] = useState<User_t[]>([]);
  const [teams, setTeams] = useState<Team_t[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit project
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  // Add member
  const [addingMember, setAddingMember] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");

  // Add objective
  const [addingObjective, setAddingObjective] = useState(false);
  const [newObjectiveTitle, setNewObjectiveTitle] = useState("");
  const [newObjectiveDesc, setNewObjectiveDesc] = useState("");

  // Edit objective
  const [editingObjectiveId, setEditingObjectiveId] = useState<string | null>(null);
  const [editObjectiveTitle, setEditObjectiveTitle] = useState("");
  const [editObjectiveDesc, setEditObjectiveDesc] = useState("");

  const loadProject = useCallback(async () => {
    setLoading(true);
    try {
      const [proj, mems, objs] = await Promise.all([
        getProject(projectId),
        listProjectMembers(projectId),
        listProjectObjectives(projectId),
      ]);
      setProject(proj);
      setMembers(mems);
      setObjectives(objs);
    } catch {
      router.push("/projects");
    }
    setLoading(false);
  }, [projectId, router]);

  useEffect(() => {
    loadProject();
    listUsers().then((res) => setAllUsers(res.items)).catch(() => {});
    listTeams(undefined, true).then((res) => setTeams(res.items)).catch(() => {});
  }, [loadProject]);

  const teamName = teams.find((t) => t.id === project?.team_id)?.name ?? "";

  const memberUserIds = new Set(members.map((m) => m.user_id));
  const availableUsers = allUsers.filter((u) => !memberUserIds.has(u.id));

  const getUserName = (userId: string) => {
    const u = allUsers.find((u) => u.id === userId);
    return u ? u.display_name || u.username : "Unknown";
  };

  // --- Edit project ---
  const startEdit = () => {
    if (!project) return;
    setEditName(project.name);
    setEditDescription(project.description || "");
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!project) return;
    try {
      const updated = await updateProject(project.id, {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
      });
      setProject(updated);
      setEditing(false);
    } catch {}
  };

  // --- Members ---
  const handleAddMember = async () => {
    if (!selectedUserId) return;
    try {
      const member = await addProjectMember(projectId, {
        user_id: selectedUserId,
      });
      setMembers([...members, member]);
      setSelectedUserId("");
      setAddingMember(false);
    } catch {}
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm("Remove this member from the project?")) return;
    try {
      await removeProjectMember(projectId, userId);
      setMembers(members.filter((m) => m.user_id !== userId));
    } catch {}
  };

  // --- Objectives ---
  const handleAddObjective = async () => {
    if (!newObjectiveTitle.trim()) return;
    try {
      const obj = await createProjectObjective(projectId, {
        title: newObjectiveTitle.trim(),
        description: newObjectiveDesc.trim() || undefined,
      });
      setObjectives([...objectives, obj]);
      setNewObjectiveTitle("");
      setNewObjectiveDesc("");
      setAddingObjective(false);
    } catch {}
  };

  const handleDeleteObjective = async (id: string) => {
    if (!confirm("Delete this objective?")) return;
    try {
      await deleteObjective(id);
      setObjectives(objectives.filter((o) => o.id !== id));
    } catch {}
  };

  const startEditObjective = (o: Objective_t) => {
    setEditingObjectiveId(o.id);
    setEditObjectiveTitle(o.title);
    setEditObjectiveDesc(o.description || "");
  };

  const handleUpdateObjective = async () => {
    if (!editingObjectiveId) return;
    try {
      const updated = await updateObjective(editingObjectiveId, {
        title: editObjectiveTitle.trim(),
        description: editObjectiveDesc.trim() || undefined,
      });
      setObjectives(objectives.map((o) => (o.id === updated.id ? updated : o)));
      setEditingObjectiveId(null);
    } catch {}
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/projects">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-2">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="text-lg font-bold"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveEdit();
                  if (e.key === "Escape") setEditing(false);
                }}
              />
              <Input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Description"
                className="text-sm"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveEdit}>
                  <Save className="h-3.5 w-3.5 mr-1" />
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-primary" />
                <h1 className="text-2xl font-bold tracking-tight truncate">
                  {project.name}
                </h1>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={startEdit}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs font-mono text-muted-foreground">
                  {project.slug}
                </span>
                {teamName && (
                  <Badge variant="secondary" className="text-xs">
                    <Users className="h-3 w-3 mr-1" />
                    {teamName}
                  </Badge>
                )}
              </div>
              {project.description && (
                <p className="text-sm text-muted-foreground mt-2">
                  {project.description}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Objectives */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between py-3 px-5">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Objectives ({objectives.length})
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setAddingObjective(!addingObjective)}
            >
              {addingObjective ? (
                <X className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </CardHeader>
          <CardContent className="px-5 pb-4 pt-0">
            {addingObjective && (
              <div className="space-y-2 mb-4 p-3 rounded border border-dashed border-border">
                <Input
                  placeholder="Objective title"
                  value={newObjectiveTitle}
                  onChange={(e) => setNewObjectiveTitle(e.target.value)}
                  className="h-8 text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddObjective();
                    if (e.key === "Escape") setAddingObjective(false);
                  }}
                />
                <Input
                  placeholder="Description (optional)"
                  value={newObjectiveDesc}
                  onChange={(e) => setNewObjectiveDesc(e.target.value)}
                  className="h-8 text-sm"
                />
                <Button
                  size="sm"
                  className="h-8 text-sm"
                  onClick={handleAddObjective}
                  disabled={!newObjectiveTitle.trim()}
                >
                  Add Objective
                </Button>
              </div>
            )}
            {objectives.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No objectives yet. Add one to define project goals.
              </p>
            ) : (
              <div className="space-y-1 max-h-[400px] overflow-y-auto">
                {objectives.map((obj) => (
                  <div
                    key={obj.id}
                    className="flex items-start justify-between rounded px-3 py-2 hover:bg-secondary/50 transition-colors group"
                  >
                    {editingObjectiveId === obj.id ? (
                      <div className="flex-1 space-y-1.5 mr-2">
                        <Input
                          value={editObjectiveTitle}
                          onChange={(e) => setEditObjectiveTitle(e.target.value)}
                          className="h-7 text-sm"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleUpdateObjective();
                            if (e.key === "Escape") setEditingObjectiveId(null);
                          }}
                        />
                        <Input
                          value={editObjectiveDesc}
                          onChange={(e) => setEditObjectiveDesc(e.target.value)}
                          placeholder="Description"
                          className="h-7 text-xs"
                        />
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            className="h-6 text-xs"
                            onClick={handleUpdateObjective}
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-xs"
                            onClick={() => setEditingObjectiveId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Target className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                            <span className="text-sm font-medium">
                              {obj.title}
                            </span>
                          </div>
                          {obj.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 ml-5">
                              {obj.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => startEditObjective(obj)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-destructive"
                            onClick={() => handleDeleteObjective(obj.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Members */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between py-3 px-5">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Members ({members.length})
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setAddingMember(!addingMember)}
            >
              {addingMember ? (
                <X className="h-4 w-4" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
            </Button>
          </CardHeader>
          <CardContent className="px-5 pb-4 pt-0">
            {addingMember && (
              <div className="flex items-center gap-2 mb-3">
                <select
                  className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                >
                  <option value="">Select a user...</option>
                  {availableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.display_name || u.username} (@{u.username})
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  className="h-8 text-sm"
                  onClick={handleAddMember}
                  disabled={!selectedUserId}
                >
                  Add
                </Button>
              </div>
            )}
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No members yet. Add users from any team.
              </p>
            ) : (
              <div className="space-y-1 max-h-[400px] overflow-y-auto">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between rounded px-3 py-2 hover:bg-secondary/50 transition-colors group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm truncate">
                        {getUserName(member.user_id)}
                      </span>
                      <Badge variant="secondary" className="text-[10px] shrink-0">
                        {member.role}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-destructive shrink-0"
                      onClick={() => handleRemoveMember(member.user_id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
