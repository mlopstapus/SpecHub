"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Plus,
  Shield,
  Target,
  Trash2,
  Lock,
  UserPlus,
  X,
  Crown,
  ChevronDown,
  ChevronRight,
  Pencil,
  Check,
} from "lucide-react";
import {
  listTeams,
  listUsers,
  createTeam,
  createUser,
  updateTeam,
  deleteTeam,
  deleteUser,
  createPolicy,
  updatePolicy,
  deletePolicy,
  createObjective,
  updateObjective,
  deleteObjective,
  getTeamEffectivePolicies,
  getTeamEffectiveObjectives,
  type Team_t,
  type User_t,
  type Policy_t,
  type Objective_t,
  type EnforcementType,
} from "@/lib/api";

/* ------------------------------------------------------------------ */
/*  Tree node type                                                     */
/* ------------------------------------------------------------------ */
interface TreeNode {
  team: Team_t;
  children: TreeNode[];
  members: User_t[];
  expanded: boolean;
}

/* ------------------------------------------------------------------ */
/*  Main page component                                                */
/* ------------------------------------------------------------------ */
export default function TeamsPage() {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState<Team_t | null>(null);
  const [detailMembers, setDetailMembers] = useState<User_t[]>([]);
  const [detailPolicies, setDetailPolicies] = useState<{
    inherited: Policy_t[];
    local: Policy_t[];
  } | null>(null);
  const [detailObjectives, setDetailObjectives] = useState<{
    inherited: Objective_t[];
    local: Objective_t[];
  } | null>(null);

  // Create team form — unified state
  // mode: "child" (add child to parentId), "sibling" (add sibling next to targetId), "root" (add root team)
  const [addMode, setAddMode] = useState<{
    mode: "child" | "sibling" | "root";
    targetId?: string;   // the node id relevant to the action
    parentId?: string;   // parent to create under
  } | null>(null);
  const [newTeamName, setNewTeamName] = useState("");

  // Drag-to-reorder state (visual only — does not change parent relationships)
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dragOverNodeId, setDragOverNodeId] = useState<string | null>(null);

  // Create user form (in detail panel)
  const [creatingUser, setCreatingUser] = useState(false);
  const [newUsername, setNewUsername] = useState("");

  // Create policy form (in detail panel)
  const [creatingPolicy, setCreatingPolicy] = useState(false);
  const [newPolicyName, setNewPolicyName] = useState("");
  const [newPolicyContent, setNewPolicyContent] = useState("");
  const [newPolicyType, setNewPolicyType] = useState<EnforcementType>("prepend");

  // Create objective form (in detail panel)
  const [creatingObjective, setCreatingObjective] = useState(false);
  const [newObjectiveTitle, setNewObjectiveTitle] = useState("");

  // Edit policy state
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);
  const [editPolicyName, setEditPolicyName] = useState("");
  const [editPolicyContent, setEditPolicyContent] = useState("");
  const [editPolicyType, setEditPolicyType] = useState<EnforcementType>("prepend");

  // Edit objective state
  const [editingObjectiveId, setEditingObjectiveId] = useState<string | null>(null);
  const [editObjectiveTitle, setEditObjectiveTitle] = useState("");
  const [editObjectiveDesc, setEditObjectiveDesc] = useState("");

  // Owner assignment
  const [assigningOwner, setAssigningOwner] = useState(false);

  // Resizable detail panel
  const [detailWidth, setDetailWidth] = useState(520);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(520);

  function handleResizeStart(e: React.MouseEvent) {
    e.preventDefault();
    isDragging.current = true;
    startX.current = e.clientX;
    startWidth.current = detailWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    function onMouseMove(ev: MouseEvent) {
      if (!isDragging.current) return;
      const delta = startX.current - ev.clientX;
      const newWidth = Math.min(Math.max(startWidth.current + delta, 320), 900);
      setDetailWidth(newWidth);
    }

    function onMouseUp() {
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  /* ---- Load full tree recursively ---- */
  const loadTree = useCallback(async () => {
    async function buildNode(team: Team_t): Promise<TreeNode> {
      const [subs, mems] = await Promise.all([
        listTeams(team.id),
        listUsers(team.id),
      ]);
      const children = await Promise.all(subs.items.map((t) => buildNode(t)));
      return { team, children, members: mems.items, expanded: true };
    }
    setLoading(true);
    try {
      const roots = await listTeams();
      const nodes = await Promise.all(roots.items.map((t) => buildNode(t)));
      setTree(nodes);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  /* ---- Select a team → load detail ---- */
  async function selectTeam(team: Team_t, members: User_t[]) {
    setSelectedTeam(team);
    setDetailMembers(members);
    setCreatingUser(false);
    setCreatingPolicy(false);
    setCreatingObjective(false);
    setAssigningOwner(false);
    try {
      const [pol, obj] = await Promise.all([
        getTeamEffectivePolicies(team.id),
        getTeamEffectiveObjectives(team.id),
      ]);
      setDetailPolicies(pol);
      setDetailObjectives(obj);
    } catch (err) {
      console.error("Failed to load team effective policies/objectives", err);
      setDetailPolicies({ inherited: [], local: [] });
      setDetailObjectives({ inherited: [], local: [] });
    }
  }

  /* ---- Toggle expand/collapse ---- */
  function toggleExpand(nodeId: string) {
    setTree((prev) => toggleInTree(prev, nodeId));
  }

  function toggleInTree(nodes: TreeNode[], id: string): TreeNode[] {
    return nodes.map((n) => {
      if (n.team.id === id) return { ...n, expanded: !n.expanded };
      return { ...n, children: toggleInTree(n.children, id) };
    });
  }

  /* ---- Create team ---- */
  async function handleCreateTeamSubmit() {
    if (!newTeamName.trim() || !addMode) return;
    const slug = newTeamName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    try {
      await createTeam({
        name: newTeamName.trim(),
        slug,
        parent_team_id: addMode.parentId,
      });
      setNewTeamName("");
      setAddMode(null);
      await loadTree();
    } catch {}
  }

  function startAdd(mode: "child" | "sibling" | "root", targetId?: string, parentId?: string) {
    setAddMode({ mode, targetId, parentId });
    setNewTeamName("");
  }

  function cancelAdd() {
    setAddMode(null);
    setNewTeamName("");
  }

  /* ---- Delete team ---- */
  async function handleDeleteTeam(id: string) {
    if (!confirm("Delete this team and all sub-teams?")) return;
    try {
      await deleteTeam(id);
      if (selectedTeam?.id === id) {
        setSelectedTeam(null);
      }
      await loadTree();
    } catch {}
  }

  /* ---- Create user in detail panel ---- */
  async function handleCreateUser() {
    if (!newUsername.trim() || !selectedTeam) return;
    try {
      const user = await createUser({
        username: newUsername.trim().toLowerCase().replace(/\s+/g, "-"),
        display_name: newUsername.trim(),
        team_id: selectedTeam.id,
      });
      setDetailMembers((prev) => [...prev, user]);
      setNewUsername("");
      setCreatingUser(false);
      await loadTree();
    } catch {}
  }

  /* ---- Delete user ---- */
  async function handleDeleteUser(id: string) {
    if (!confirm("Remove this member?")) return;
    try {
      await deleteUser(id);
      setDetailMembers((prev) => prev.filter((u) => u.id !== id));
      await loadTree();
    } catch {}
  }

  /* ---- Assign owner ---- */
  async function handleAssignOwner(userId: string) {
    if (!selectedTeam) return;
    try {
      const updated = await updateTeam(selectedTeam.id, { owner_id: userId });
      setSelectedTeam(updated);
      setAssigningOwner(false);
      await loadTree();
    } catch (err) {
      console.error("Failed to assign owner", err);
      alert(`Failed to assign owner: ${err}`);
    }
  }

  /* ---- Create policy ---- */
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
      const pol = await getTeamEffectivePolicies(selectedTeam.id);
      setDetailPolicies(pol);
    } catch {}
  }

  /* ---- Edit policy ---- */
  function startEditPolicy(p: Policy_t) {
    setEditingPolicyId(p.id);
    setEditPolicyName(p.name);
    setEditPolicyContent(p.content);
    setEditPolicyType(p.enforcement_type);
  }

  async function handleUpdatePolicy() {
    if (!editingPolicyId || !selectedTeam) return;
    try {
      await updatePolicy(editingPolicyId, {
        name: editPolicyName.trim(),
        content: editPolicyContent.trim(),
        enforcement_type: editPolicyType,
      });
      setEditingPolicyId(null);
      const pol = await getTeamEffectivePolicies(selectedTeam.id);
      setDetailPolicies(pol);
    } catch (err) {
      console.error("Failed to update policy", err);
      alert(`Failed to update policy: ${err}`);
    }
  }

  /* ---- Delete policy ---- */
  async function handleDeletePolicy(id: string) {
    if (!confirm("Delete this policy?") || !selectedTeam) return;
    try {
      await deletePolicy(id);
      const pol = await getTeamEffectivePolicies(selectedTeam.id);
      setDetailPolicies(pol);
    } catch (err) {
      console.error("Failed to delete policy", err);
      alert(`Failed to delete policy: ${err}`);
    }
  }

  /* ---- Edit objective ---- */
  function startEditObjective(o: Objective_t) {
    setEditingObjectiveId(o.id);
    setEditObjectiveTitle(o.title);
    setEditObjectiveDesc(o.description || "");
  }

  async function handleUpdateObjective() {
    if (!editingObjectiveId || !selectedTeam) return;
    try {
      await updateObjective(editingObjectiveId, {
        title: editObjectiveTitle.trim(),
        description: editObjectiveDesc.trim() || undefined,
      });
      setEditingObjectiveId(null);
      const obj = await getTeamEffectiveObjectives(selectedTeam.id);
      setDetailObjectives(obj);
    } catch (err) {
      console.error("Failed to update objective", err);
      alert(`Failed to update objective: ${err}`);
    }
  }

  /* ---- Delete objective ---- */
  async function handleDeleteObjective(id: string) {
    if (!confirm("Delete this objective?") || !selectedTeam) return;
    try {
      await deleteObjective(id);
      const obj = await getTeamEffectiveObjectives(selectedTeam.id);
      setDetailObjectives(obj);
    } catch (err) {
      console.error("Failed to delete objective", err);
      alert(`Failed to delete objective: ${err}`);
    }
  }

  /* ---- Create objective ---- */
  async function handleCreateObjective() {
    if (!newObjectiveTitle.trim() || !selectedTeam) return;
    try {
      await createObjective({
        team_id: selectedTeam.id,
        title: newObjectiveTitle.trim(),
      });
      setNewObjectiveTitle("");
      setCreatingObjective(false);
      const obj = await getTeamEffectiveObjectives(selectedTeam.id);
      setDetailObjectives(obj);
    } catch {}
  }

  /* ---- Helper: inline team name form ---- */
  function renderInlineForm() {
    if (!addMode) return null;
    const label = addMode.mode === "child" ? "New sub-team" : addMode.mode === "sibling" ? "New sibling team" : "New root team";
    return (
      <div className="flex flex-col items-center gap-1 animate-in fade-in zoom-in-95 duration-200">
        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
        <div className="flex items-center gap-1.5">
          <Input
            placeholder="Team name"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateTeamSubmit();
              if (e.key === "Escape") cancelAdd();
            }}
            className="h-8 w-40 text-sm"
            autoFocus
          />
          <Button size="sm" className="h-8 text-sm" onClick={handleCreateTeamSubmit}>
            Add
          </Button>
          <Button size="sm" variant="ghost" className="h-8" onClick={cancelAdd}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  /* ---- Helper: "+" button (reusable) ---- */
  function renderAddButton(
    onClick: () => void,
    size: "sm" | "md" | "lg" = "md",
    title: string = "Add team",
    direction: "horizontal" | "vertical" = "vertical",
  ) {
    const sizeMap = {
      sm: { btn: "h-6 w-6", icon: "h-3 w-3", connector: direction === "vertical" ? "w-px h-3" : "h-px w-4" },
      md: { btn: "h-8 w-8", icon: "h-4 w-4", connector: direction === "vertical" ? "w-px h-4" : "h-px w-6" },
      lg: { btn: "h-12 w-12", icon: "h-6 w-6", connector: direction === "vertical" ? "w-px h-5" : "h-px w-8" },
    };
    const s = sizeMap[size];
    return (
      <button
        className={`${s.btn} rounded-full border-2 border-dashed border-muted-foreground/30 hover:border-primary hover:bg-primary/10 bg-background flex items-center justify-center transition-all hover:shadow-md hover:scale-110 group/add`}
        title={title}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
      >
        <Plus className={`${s.icon} text-muted-foreground/50 group-hover/add:text-primary transition-colors`} />
      </button>
    );
  }

  /* ---- Drag-to-reorder helpers (visual only) ---- */
  function reorderChildren(nodes: TreeNode[], parentId: string | undefined, fromId: string, toId: string): TreeNode[] {
    return nodes.map((n) => {
      const isParent = parentId === undefined
        ? nodes.some((c) => c.team.id === fromId) && nodes.some((c) => c.team.id === toId)
        : n.team.id === parentId;

      if (isParent && parentId === undefined) {
        // Reorder root-level nodes
        const reordered = [...nodes];
        const fromIdx = reordered.findIndex((c) => c.team.id === fromId);
        const toIdx = reordered.findIndex((c) => c.team.id === toId);
        if (fromIdx !== -1 && toIdx !== -1) {
          const [moved] = reordered.splice(fromIdx, 1);
          reordered.splice(toIdx, 0, moved);
        }
        return reordered as unknown as TreeNode;
      }

      if (n.team.id === parentId) {
        const reordered = [...n.children];
        const fromIdx = reordered.findIndex((c) => c.team.id === fromId);
        const toIdx = reordered.findIndex((c) => c.team.id === toId);
        if (fromIdx !== -1 && toIdx !== -1) {
          const [moved] = reordered.splice(fromIdx, 1);
          reordered.splice(toIdx, 0, moved);
        }
        return { ...n, children: reordered };
      }

      return { ...n, children: reorderChildren(n.children, parentId, fromId, toId) };
    });
  }

  function handleDragStart(e: React.DragEvent, nodeId: string) {
    setDraggedNodeId(nodeId);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent, nodeId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (nodeId !== draggedNodeId) {
      setDragOverNodeId(nodeId);
    }
  }

  function handleDragEnd() {
    setDraggedNodeId(null);
    setDragOverNodeId(null);
  }

  function handleDrop(e: React.DragEvent, targetNodeId: string, parentId: string | undefined) {
    e.preventDefault();
    if (draggedNodeId && draggedNodeId !== targetNodeId) {
      if (parentId === undefined) {
        // Root-level reorder
        setTree((prev) => {
          const reordered = [...prev];
          const fromIdx = reordered.findIndex((c) => c.team.id === draggedNodeId);
          const toIdx = reordered.findIndex((c) => c.team.id === targetNodeId);
          if (fromIdx !== -1 && toIdx !== -1) {
            const [moved] = reordered.splice(fromIdx, 1);
            reordered.splice(toIdx, 0, moved);
          }
          return reordered;
        });
      } else {
        setTree((prev) => reorderChildren(prev, parentId, draggedNodeId, targetNodeId));
      }
    }
    setDraggedNodeId(null);
    setDragOverNodeId(null);
  }

  /* ================================================================ */
  /*  Render: Org-chart tree node                                      */
  /* ================================================================ */
  function renderNode(node: TreeNode, parentId?: string) {
    const isSelected = selectedTeam?.id === node.team.id;
    const hasChildren = node.children.length > 0;
    const isLeaf = !hasChildren;
    const owner = node.members.find((m) => m.id === node.team.owner_id);
    const isAddingChild = addMode?.mode === "child" && addMode.parentId === node.team.id;
    const isDragged = draggedNodeId === node.team.id;
    const isDragOver = dragOverNodeId === node.team.id && draggedNodeId !== node.team.id;

    return (
      <div key={node.team.id} className="flex flex-col items-center">
        {/* The node card with right-side sibling hover zone */}
        <div className="relative">
          <div
            className={`
              relative group rounded-lg border-2 px-5 py-3.5 min-w-[180px] max-w-[260px]
              transition-all duration-150 hover:shadow-md
              ${isSelected
                ? "border-primary bg-primary/5 shadow-md"
                : isDragOver
                  ? "border-primary/60 bg-primary/10 shadow-lg scale-[1.02]"
                  : "border-border bg-card hover:border-primary/50"
              }
              ${isDragged ? "opacity-40 scale-95" : ""}
            `}
            draggable
            onDragStart={(e) => handleDragStart(e, node.team.id)}
            onDragOver={(e) => handleDragOver(e, node.team.id)}
            onDragLeave={() => { if (dragOverNodeId === node.team.id) setDragOverNodeId(null); }}
            onDrop={(e) => handleDrop(e, node.team.id, parentId)}
            onDragEnd={handleDragEnd}
            onClick={() => selectTeam(node.team, node.members)}
            style={{ cursor: isDragged ? "grabbing" : "grab" }}
          >
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm font-semibold truncate">{node.team.name}</span>
            </div>
            {owner && (
              <div className="flex items-center gap-1 mt-1">
                <Crown className="h-3 w-3 text-amber-500" />
                <span className="text-xs text-muted-foreground truncate">
                  {owner.display_name || owner.username}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
              <span>{node.members.length} member{node.members.length !== 1 ? "s" : ""}</span>
              {hasChildren && (
                <span>{node.children.length} sub-team{node.children.length !== 1 ? "s" : ""}</span>
              )}
            </div>

            {/* Delete button on hover */}
            <button
              className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/80"
              title="Delete team"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteTeam(node.team.id);
              }}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>

          {/* Right side hover zone — add sibling */}
          {addMode?.mode === "sibling" && addMode.targetId === node.team.id ? (
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-10">{renderInlineForm()}</div>
          ) : (
            <div className="group/right absolute left-full top-1/2 -translate-y-1/2 flex items-center justify-center w-10 h-10">
              <button
                className="h-8 w-8 rounded-full border-2 border-dashed border-transparent group-hover/right:border-primary/40 group-hover/right:bg-primary/10 flex items-center justify-center transition-all opacity-0 group-hover/right:opacity-100 hover:scale-110"
                title="Add sibling team"
                onClick={(e) => { e.stopPropagation(); startAdd("sibling", node.team.id, parentId); }}
              >
                <Plus className="h-4 w-4 text-primary/60" />
              </button>
            </div>
          )}
        </div>

        {/* Expand/collapse toggle + children */}
        {hasChildren && (
          <div className="flex flex-col items-center">
            <div className="w-px h-1.5 bg-border" />
            <button
              className="h-5 w-5 rounded-full border border-border bg-background flex items-center justify-center hover:bg-secondary transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(node.team.id);
              }}
            >
              {node.expanded ? (
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              )}
            </button>
            {node.expanded && (
              <>
                <div className="w-px h-3 bg-border" />
                <div className="flex">
                  {node.children.map((child, idx) => {
                    const isFirst = idx === 0;
                    const isLast = idx === node.children.length - 1;
                    const isOnly = node.children.length === 1;
                    return (
                      <div
                        key={child.team.id}
                        className="flex flex-col items-center"
                        style={{
                          paddingLeft: isFirst || isOnly ? 0 : 20,
                          paddingRight: isLast || isOnly ? 0 : 20,
                        }}
                      >
                        <div className="flex w-full" style={{ height: "12px" }}>
                          <div
                            className="flex-1"
                            style={{
                              borderTop: isFirst || isOnly ? "none" : "1px solid hsl(var(--border))",
                            }}
                          />
                          <div
                            style={{
                              width: "1px",
                              height: "100%",
                              backgroundColor: "hsl(var(--border))",
                            }}
                          />
                          <div
                            className="flex-1"
                            style={{
                              borderTop: isLast || isOnly ? "none" : "1px solid hsl(var(--border))",
                            }}
                          />
                        </div>
                        {renderNode(child, node.team.id)}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* Leaf node: visible "+" below to add a child */}
        {isLeaf && (
          <div className="flex flex-col items-center mt-1">
            <div className="w-px h-4 bg-border" />
            {isAddingChild ? (
              renderInlineForm()
            ) : (
              renderAddButton(
                () => startAdd("child", node.team.id, node.team.id),
                "md",
                "Add sub-team",
              )
            )}
          </div>
        )}
      </div>
    );
  }

  /* ================================================================ */
  /*  Render: Detail panel                                             */
  /* ================================================================ */
  function renderDetailPanel() {
    if (!selectedTeam) return null;

    return (
      <div className="shrink-0 space-y-5 pl-6 overflow-y-auto" style={{ width: `${detailWidth}px` }}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">{selectedTeam.name}</h2>
            <p className="text-sm text-muted-foreground">{selectedTeam.slug}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setSelectedTeam(null)}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Owner */}
        <Card>
          <CardHeader className="py-3 px-5">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-500" />
              Owner
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4 pt-0">
            {selectedTeam.owner_id ? (
              <div className="flex items-center justify-between">
                <span className="text-base">
                  {detailMembers.find((m) => m.id === selectedTeam.owner_id)?.display_name ||
                    detailMembers.find((m) => m.id === selectedTeam.owner_id)?.username ||
                    "Unknown"}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-sm"
                  onClick={() => setAssigningOwner(!assigningOwner)}
                >
                  Change
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">No owner assigned</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-sm"
                  onClick={() => setAssigningOwner(!assigningOwner)}
                >
                  Assign
                </Button>
              </div>
            )}
            {assigningOwner && detailMembers.length > 0 && (
              <div className="mt-3 space-y-1">
                {detailMembers.map((m) => (
                  <button
                    key={m.id}
                    className="w-full text-left text-sm px-3 py-1.5 rounded hover:bg-secondary transition-colors"
                    onClick={() => handleAssignOwner(m.id)}
                  >
                    {m.display_name || m.username}
                  </button>
                ))}
              </div>
            )}
            {assigningOwner && detailMembers.length === 0 && (
              <p className="text-sm text-muted-foreground mt-2">Add members first.</p>
            )}
          </CardContent>
        </Card>

        {/* Members */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between py-3 px-5">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Members ({detailMembers.length})
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setCreatingUser(!creatingUser)}
            >
              {creatingUser ? <X className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            </Button>
          </CardHeader>
          <CardContent className="px-5 pb-4 pt-0">
            {creatingUser && (
              <div className="flex items-center gap-2 mb-3">
                <Input
                  placeholder="Username"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateUser();
                    if (e.key === "Escape") setCreatingUser(false);
                  }}
                  className="h-8 text-sm"
                  autoFocus
                />
                <Button size="sm" className="h-8 text-sm" onClick={handleCreateUser}>
                  Add
                </Button>
              </div>
            )}
            {detailMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-3">No members yet.</p>
            ) : (
              <div className="space-y-1 max-h-[260px] overflow-y-auto">
                {detailMembers.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between rounded px-3 py-2 hover:bg-secondary/50 transition-colors group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {u.id === selectedTeam.owner_id && (
                        <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      )}
                      <span className="text-sm truncate">{u.display_name || u.username}</span>
                      <span className="text-xs text-muted-foreground">@{u.username}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-destructive shrink-0"
                      onClick={() => handleDeleteUser(u.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Policies */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between py-3 px-5">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Policies
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setCreatingPolicy(!creatingPolicy)}
            >
              {creatingPolicy ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </Button>
          </CardHeader>
          <CardContent className="px-5 pb-4 pt-0">
            {creatingPolicy && (
              <div className="space-y-2 mb-4 p-3 rounded border border-dashed border-border">
                <Input
                  placeholder="Policy name"
                  value={newPolicyName}
                  onChange={(e) => setNewPolicyName(e.target.value)}
                  className="h-8 text-sm"
                  autoFocus
                />
                <select
                  className="w-full rounded border border-input bg-background px-3 py-1.5 text-sm"
                  value={newPolicyType}
                  onChange={(e) => setNewPolicyType(e.target.value as EnforcementType)}
                >
                  <option value="prepend">Prepend</option>
                  <option value="append">Append</option>
                  <option value="inject">Inject</option>
                  <option value="validate">Validate</option>
                </select>
                <textarea
                  placeholder="Policy content..."
                  value={newPolicyContent}
                  onChange={(e) => setNewPolicyContent(e.target.value)}
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm min-h-[60px] resize-y"
                />
                <Button size="sm" className="h-8 text-sm" onClick={handleCreatePolicy}>
                  Create
                </Button>
              </div>
            )}
            {detailPolicies ? (
              <div className="space-y-4 max-h-[320px] overflow-y-auto">
                {/* Immutable section — always visible */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-primary" /> <span className="text-primary">Immutable</span> — aggregated from parent teams
                  </p>
                  {detailPolicies.inherited.length > 0 ? (
                    detailPolicies.inherited.map((p) => (
                      <div key={p.id} className="flex items-center gap-2 rounded bg-secondary/30 px-3 py-2 mb-1.5">
                        <Badge variant="outline" className="text-[10px] shrink-0 h-5">
                          {p.enforcement_type}
                        </Badge>
                        <span className="text-sm font-medium truncate">{p.name}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground italic pl-5">None inherited</p>
                  )}
                </div>
                {/* Mutable section — always visible */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Mutable — this team
                  </p>
                  {detailPolicies.local.length > 0 ? (
                    detailPolicies.local.map((p) =>
                      editingPolicyId === p.id ? (
                        <div key={p.id} className="space-y-2 mb-2 p-3 rounded border border-primary/30 bg-primary/5">
                          <Input
                            value={editPolicyName}
                            onChange={(e) => setEditPolicyName(e.target.value)}
                            className="h-8 text-sm"
                            autoFocus
                          />
                          <select
                            className="w-full rounded border border-input bg-background px-3 py-1.5 text-sm"
                            value={editPolicyType}
                            onChange={(e) => setEditPolicyType(e.target.value as EnforcementType)}
                          >
                            <option value="prepend">Prepend</option>
                            <option value="append">Append</option>
                            <option value="inject">Inject</option>
                            <option value="validate">Validate</option>
                          </select>
                          <textarea
                            value={editPolicyContent}
                            onChange={(e) => setEditPolicyContent(e.target.value)}
                            className="w-full rounded border border-input bg-background px-3 py-2 text-sm min-h-[60px] resize-y"
                          />
                          <div className="flex gap-2">
                            <Button size="sm" className="h-7 text-xs" onClick={handleUpdatePolicy}>
                              <Check className="h-3 w-3 mr-1" /> Save
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingPolicyId(null)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div key={p.id} className="group/pol flex items-center gap-2 rounded border border-border px-3 py-2 mb-1.5">
                          <Badge variant="secondary" className="text-[10px] shrink-0 h-5">
                            {p.enforcement_type}
                          </Badge>
                          <span className="text-sm font-medium truncate flex-1">{p.name}</span>
                          <div className="flex gap-1 opacity-0 group-hover/pol:opacity-100 transition-opacity shrink-0">
                            <button
                              className="h-6 w-6 rounded flex items-center justify-center hover:bg-secondary transition-colors"
                              onClick={() => startEditPolicy(p)}
                              title="Edit policy"
                            >
                              <Pencil className="h-3 w-3 text-muted-foreground" />
                            </button>
                            <button
                              className="h-6 w-6 rounded flex items-center justify-center hover:bg-destructive/20 transition-colors"
                              onClick={() => handleDeletePolicy(p.id)}
                              title="Delete policy"
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </button>
                          </div>
                        </div>
                      )
                    )
                  ) : (
                    <p className="text-xs text-muted-foreground italic pl-5">No team policies yet</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-3">Loading...</p>
            )}
          </CardContent>
        </Card>

        {/* Objectives */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between py-3 px-5">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4" />
              Objectives
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setCreatingObjective(!creatingObjective)}
            >
              {creatingObjective ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </Button>
          </CardHeader>
          <CardContent className="px-5 pb-4 pt-0">
            {creatingObjective && (
              <div className="flex items-center gap-2 mb-3">
                <Input
                  placeholder="Objective title"
                  value={newObjectiveTitle}
                  onChange={(e) => setNewObjectiveTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateObjective();
                    if (e.key === "Escape") setCreatingObjective(false);
                  }}
                  className="h-8 text-sm"
                  autoFocus
                />
                <Button size="sm" className="h-8 text-sm" onClick={handleCreateObjective}>
                  Add
                </Button>
              </div>
            )}
            {detailObjectives ? (
              <div className="space-y-4 max-h-[320px] overflow-y-auto">
                {/* Immutable section — always visible */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-primary" /> <span className="text-primary">Immutable</span> — from direct parent
                  </p>
                  {detailObjectives.inherited.length > 0 ? (
                    detailObjectives.inherited.map((o) => (
                      <div key={o.id} className="rounded bg-secondary/30 px-3 py-2 mb-1.5">
                        <span className="text-sm font-medium">{o.title}</span>
                        {o.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{o.description}</p>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground italic pl-5">None inherited</p>
                  )}
                </div>
                {/* Mutable section — always visible */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Mutable — this team
                  </p>
                  {detailObjectives.local.length > 0 ? (
                    detailObjectives.local.map((o) =>
                      editingObjectiveId === o.id ? (
                        <div key={o.id} className="space-y-2 mb-2 p-3 rounded border border-primary/30 bg-primary/5">
                          <Input
                            value={editObjectiveTitle}
                            onChange={(e) => setEditObjectiveTitle(e.target.value)}
                            className="h-8 text-sm"
                            placeholder="Objective title"
                            autoFocus
                          />
                          <textarea
                            value={editObjectiveDesc}
                            onChange={(e) => setEditObjectiveDesc(e.target.value)}
                            className="w-full rounded border border-input bg-background px-3 py-2 text-sm min-h-[40px] resize-y"
                            placeholder="Description (optional)"
                          />
                          <div className="flex gap-2">
                            <Button size="sm" className="h-7 text-xs" onClick={handleUpdateObjective}>
                              <Check className="h-3 w-3 mr-1" /> Save
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingObjectiveId(null)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div key={o.id} className="group/obj rounded border border-border px-3 py-2 mb-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <span className="text-sm font-medium">{o.title}</span>
                              {o.description && (
                                <p className="text-xs text-muted-foreground mt-0.5">{o.description}</p>
                              )}
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover/obj:opacity-100 transition-opacity shrink-0 mt-0.5">
                              <button
                                className="h-6 w-6 rounded flex items-center justify-center hover:bg-secondary transition-colors"
                                onClick={() => startEditObjective(o)}
                                title="Edit objective"
                              >
                                <Pencil className="h-3 w-3 text-muted-foreground" />
                              </button>
                              <button
                                className="h-6 w-6 rounded flex items-center justify-center hover:bg-destructive/20 transition-colors"
                                onClick={() => handleDeleteObjective(o.id)}
                                title="Delete objective"
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    )
                  ) : (
                    <p className="text-xs text-muted-foreground italic pl-5">No team objectives yet</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-3">Loading...</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ================================================================ */
  /*  Page layout                                                      */
  /* ================================================================ */
  const isAddingRoot = addMode?.mode === "root";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Organization</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Team hierarchy — click a node to view details. Drag nodes to reorder.
        </p>
      </div>

      <div className="flex gap-6">
        {/* Org chart area */}
        <div className="flex-1 min-w-0 overflow-x-auto">
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="space-y-3 text-center">
                <div className="h-16 w-48 bg-secondary rounded-lg animate-pulse mx-auto" />
                <div className="flex gap-6 justify-center">
                  <div className="h-14 w-40 bg-secondary rounded-lg animate-pulse" />
                  <div className="h-14 w-40 bg-secondary rounded-lg animate-pulse" />
                </div>
              </div>
            </div>
          ) : tree.length === 0 ? (
            /* Empty state: big "+" to create first root team */
            <div className="flex flex-col items-center justify-center py-20 text-center">
              {isAddingRoot ? (
                renderInlineForm()
              ) : (
                <>
                  {renderAddButton(() => startAdd("root"), "lg", "Create first team")}
                  <p className="text-muted-foreground mt-4">Create your first team to get started</p>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-start justify-center py-8 px-8 min-w-fit gap-8">
              {tree.map((node) => (
                <div key={node.team.id} className="flex flex-col items-center">
                  {renderNode(node)}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Resize handle + Detail panel */}
        {selectedTeam && (
          <>
            <div
              className="shrink-0 w-3 cursor-col-resize group flex items-center justify-center hover:bg-primary/10 active:bg-primary/20 transition-colors rounded-md"
              onMouseDown={handleResizeStart}
              title="Drag to resize"
            >
              <div className="flex flex-col gap-1 items-center">
                <div className="w-1 h-1 rounded-full bg-muted-foreground/40 group-hover:bg-primary/70 group-active:bg-primary transition-colors" />
                <div className="w-1 h-1 rounded-full bg-muted-foreground/40 group-hover:bg-primary/70 group-active:bg-primary transition-colors" />
                <div className="w-1 h-1 rounded-full bg-muted-foreground/40 group-hover:bg-primary/70 group-active:bg-primary transition-colors" />
                <div className="w-1 h-1 rounded-full bg-muted-foreground/40 group-hover:bg-primary/70 group-active:bg-primary transition-colors" />
                <div className="w-1 h-1 rounded-full bg-muted-foreground/40 group-hover:bg-primary/70 group-active:bg-primary transition-colors" />
              </div>
            </div>
            {renderDetailPanel()}
          </>
        )}
      </div>
    </div>
  );
}
