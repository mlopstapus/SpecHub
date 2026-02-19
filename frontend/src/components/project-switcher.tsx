"use client";

import { useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, FolderOpen, Plus, Check } from "lucide-react";
import {
  listProjects,
  listTeams,
  createProject,
  type Project_t,
  type Team_t,
} from "@/lib/api";

const STORAGE_KEY = "spechub-project-id";

export function useActiveProject() {
  const [projectId, setProjectId] = useState<string | null>(null);

  useEffect(() => {
    setProjectId(localStorage.getItem(STORAGE_KEY));
  }, []);

  const select = (id: string | null) => {
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    setProjectId(id);
  };

  return { projectId, select };
}

export function ProjectSwitcher() {
  const [projects, setProjects] = useState<Project_t[]>([]);
  const [teams, setTeams] = useState<Team_t[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setActiveId(localStorage.getItem(STORAGE_KEY));
    listProjects()
      .then((res) => setProjects(res.items))
      .catch(() => {});
    listTeams()
      .then((res) => {
        setTeams(res.items);
        if (res.items.length > 0) setSelectedTeamId(res.items[0].id);
      })
      .catch(() => {});
  }, []);

  const active = projects.find((p) => p.id === activeId);

  const handleSelect = (id: string | null) => {
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    setActiveId(id);
    setOpen(false);
  };

  const handleCreate = async () => {
    if (!newName.trim() || !selectedTeamId) return;
    const slug = newName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    try {
      const project = await createProject({
        team_id: selectedTeamId,
        name: newName.trim(),
        slug,
      });
      setProjects([...projects, project]);
      handleSelect(project.id);
      setNewName("");
      setCreating(false);
    } catch {
      // slug conflict or other error
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 max-w-[180px]">
          <FolderOpen className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate text-xs">
            {active ? active.name : "All Projects"}
          </span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuItem onClick={() => handleSelect(null)}>
          <span className="flex-1">All Projects</span>
          {!activeId && <Check className="h-3.5 w-3.5" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {projects.map((p) => (
          <DropdownMenuItem key={p.id} onClick={() => handleSelect(p.id)}>
            <span className="flex-1 truncate">{p.name}</span>
            {p.id === activeId && <Check className="h-3.5 w-3.5" />}
          </DropdownMenuItem>
        ))}
        {projects.length === 0 && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            No projects yet
          </div>
        )}
        <DropdownMenuSeparator />
        {creating ? (
          <div className="p-2 space-y-2">
            {teams.length > 0 && (
              <select
                className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
            <Input
              placeholder="Project name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") setCreating(false);
              }}
              autoFocus
              className="h-7 text-xs"
            />
            <div className="flex gap-1.5">
              <Button
                size="sm"
                className="h-6 text-xs flex-1"
                onClick={handleCreate}
                disabled={teams.length === 0}
              >
                Create
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-xs"
                onClick={() => setCreating(false)}
              >
                Cancel
              </Button>
            </div>
            {teams.length === 0 && (
              <p className="text-[10px] text-muted-foreground">
                Create a team first on the Teams page.
              </p>
            )}
          </div>
        ) : (
          <DropdownMenuItem onClick={() => setCreating(true)}>
            <Plus className="h-3.5 w-3.5 mr-2" />
            New Project
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
