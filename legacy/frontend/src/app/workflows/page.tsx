"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Workflow as WorkflowIcon,
  Plus,
  Trash2,
  Play,
  Share2,
} from "lucide-react";
import {
  listWorkflows,
  deleteWorkflow,
  listWorkflowShares,
  shareWorkflow,
  unshareWorkflow,
  type Workflow_t,
  type Share_t,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { ShareDialog } from "@/components/share-dialog";

export default function WorkflowsPage() {
  const { user } = useAuth();
  const [workflows, setWorkflows] = useState<Workflow_t[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareTarget, setShareTarget] = useState<Workflow_t | null>(null);
  const [shares, setShares] = useState<Share_t[]>([]);

  const loadWorkflows = useCallback(() => {
    setLoading(true);
    listWorkflows(user?.id)
      .then(setWorkflows)
      .catch(() => setWorkflows([]))
      .finally(() => setLoading(false));
  }, [user?.id]);

  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this workflow? This cannot be undone.")) return;
    try {
      await deleteWorkflow(id);
      setWorkflows(workflows.filter((w) => w.id !== id));
    } catch {}
  };

  const handleOpenShare = async (wf: Workflow_t) => {
    setShareTarget(wf);
    try {
      const s = await listWorkflowShares(wf.id);
      setShares(s);
    } catch {
      setShares([]);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-secondary rounded w-48 animate-pulse" />
        <div className="h-64 bg-secondary rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Workflows</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Chain prompts together into multi-step workflows.
          </p>
        </div>
        <Button asChild>
          <Link href="/workflows/new">
            <Plus className="h-4 w-4 mr-1" />
            New Workflow
          </Link>
        </Button>
      </div>

      {workflows.length === 0 ? (
        <Card className="py-12">
          <CardContent className="text-center">
            <WorkflowIcon className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground mb-4">
              No workflows yet. Create one to chain prompts together.
            </p>
            <Button asChild>
              <Link href="/workflows/new">
                <Plus className="h-4 w-4 mr-1" />
                Create Workflow
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workflows.map((wf) => {
            const isOwner = wf.user_id === user?.id;
            const isShared = wf.user_id !== user?.id;
            return (
              <Card key={wf.id} className="group relative">
                {isOwner && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2 h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    onClick={() => handleOpenShare(wf)}
                    title="Share"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                  </Button>
                )}
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-3 pr-8">
                    <div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/workflows/${wf.id}`}
                          className="text-sm font-medium hover:underline"
                        >
                          {wf.name}
                        </Link>
                        {isShared && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground">
                            Shared with you
                          </Badge>
                        )}
                      </div>
                      {wf.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {wf.description}
                        </p>
                      )}
                    </div>
                    {isOwner && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(wf.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">
                        {wf.steps.length} step{wf.steps.length !== 1 ? "s" : ""}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        Updated {new Date(wf.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/workflows/${wf.id}`}>
                        <Play className="h-3.5 w-3.5 mr-1" />
                        Open
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ShareDialog
        open={!!shareTarget}
        onOpenChange={(open) => { if (!open) setShareTarget(null); }}
        title={shareTarget?.name ?? ""}
        shares={shares}
        onShare={async (userId) => {
          if (!shareTarget) return;
          const s = await shareWorkflow(shareTarget.id, userId);
          setShares((prev) => [...prev, s]);
        }}
        onUnshare={async (userId) => {
          if (!shareTarget) return;
          await unshareWorkflow(shareTarget.id, userId);
          setShares((prev) => prev.filter((s) => s.user_id !== userId));
        }}
      />
    </div>
  );
}
