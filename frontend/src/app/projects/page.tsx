"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FolderOpen,
  Plus,
  Trash2,
  Search,
  Users,
} from "lucide-react";
import {
  listProjects,
  listTeams,
  createProject,
  deleteProject,
  type Project_t,
  type Team_t,
} from "@/lib/api";
export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project_t[]>([]);
  const [teams, setTeams] = useState<Team_t[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");

  const loadProjects = useCallback(() => {
    setLoading(true);
    listProjects()
      .then((res) => setProjects(res.items))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadProjects();
    listTeams(undefined, true)
      .then((res) => {
        setTeams(res.items);
        if (res.items.length > 0) setSelectedTeamId(res.items[0].id);
      })
      .catch(() => {});
  }, [loadProjects]);

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.slug.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async () => {
    if (!newName.trim() || !selectedTeamId) return;
    const slug = newName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    try {
      await createProject({
        team_id: selectedTeamId,
        name: newName.trim(),
        slug,
        description: newDescription.trim() || undefined,
      });
      setNewName("");
      setNewDescription("");
      setCreating(false);
      loadProjects();
    } catch {}
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this project? This cannot be undone.")) return;
    try {
      await deleteProject(id);
      setProjects(projects.filter((p) => p.id !== id));
    } catch {}
  };

  const teamName = (teamId: string) =>
    teams.find((t) => t.id === teamId)?.name ?? "Unknown team";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Team-owned projects with objectives and members
          </p>
        </div>
        <Button onClick={() => setCreating(!creating)}>
          <Plus className="h-4 w-4 mr-1" />
          New Project
        </Button>
      </div>

      {creating && (
        <Card>
          <CardContent className="pt-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Name</label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Model Registry v2"
                  className="mt-1"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                    if (e.key === "Escape") setCreating(false);
                  }}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">
                  Owning Team
                </label>
                <select
                  className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">
                Description
              </label>
              <Input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Optional description"
                className="mt-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleCreate} disabled={!newName.trim() || !selectedTeamId}>
                Create Project
              </Button>
              <Button variant="outline" onClick={() => setCreating(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">
            {projects.length === 0
              ? "No projects yet. Create one to get started."
              : "No projects match your search."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer group h-full">
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <FolderOpen className="h-4 w-4 text-primary shrink-0" />
                        <h3 className="font-semibold text-sm truncate">
                          {project.name}
                        </h3>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                        {project.slug}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 text-destructive shrink-0"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDelete(project.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {project.description && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                      {project.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    <span>{teamName(project.team_id)}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
