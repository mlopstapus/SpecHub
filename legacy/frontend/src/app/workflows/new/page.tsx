"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react";
import Link from "next/link";
import {
  createWorkflow,
  listPrompts,
  type Prompt,
  type WorkflowStep_t,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

function NewWorkflowPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project") ?? "";

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState<WorkflowStep_t[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const { user: currentUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listPrompts(1, 100)
      .then((res) => setPrompts(res.items))
      .catch(() => {});
  }, []);

  const addStep = () => {
    const idx = steps.length + 1;
    setSteps([
      ...steps,
      {
        id: `step-${idx}`,
        prompt_name: prompts[0]?.name ?? "",
        prompt_version: null,
        depends_on: steps.length > 0 ? [steps[steps.length - 1].id] : [],
      },
    ]);
  };

  const removeStep = (idx: number) => {
    const removed = steps[idx];
    const updated = steps.filter((_, i) => i !== idx).map((s) => ({
      ...s,
      depends_on: s.depends_on.filter((d) => d !== removed.id),
    }));
    setSteps(updated);
  };

  const updateStep = (idx: number, partial: Partial<WorkflowStep_t>) => {
    setSteps(steps.map((s, i) => (i === idx ? { ...s, ...partial } : s)));
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const wf = await createWorkflow({
        project_id: projectId || undefined,
        name: name.trim(),
        description: description.trim() || undefined,
        steps,
      });
      router.push(`/workflows/${wf.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create workflow");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/workflows">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            New Workflow
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Chain prompts together into a multi-step pipeline.
          </p>
        </div>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <div className="max-w-2xl space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. PRD Pipeline"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">
                Description
              </label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium">
            Steps ({steps.length})
          </h2>
          <Button size="sm" variant="outline" onClick={addStep}>
            <Plus className="h-4 w-4 mr-1" />
            Add Step
          </Button>
        </div>

        {steps.length === 0 ? (
          <Card className="py-8">
            <CardContent className="text-center">
              <p className="text-sm text-muted-foreground mb-3">
                No steps yet. Add a step to start building your workflow.
              </p>
              <Button size="sm" onClick={addStep}>
                <Plus className="h-4 w-4 mr-1" />
                Add First Step
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {steps.map((step, idx) => (
              <Card key={step.id}>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono bg-secondary px-2 py-0.5 rounded">
                        {step.id}
                      </span>
                      {step.depends_on.length > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          depends on: {step.depends_on.join(", ")}
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => removeStep(idx)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground">
                      Prompt
                    </label>
                    <select
                      className="w-full mt-1 rounded-md border border-input bg-[#0d0d0d] px-3 py-1.5 text-sm"
                      value={step.prompt_name}
                      onChange={(e) =>
                        updateStep(idx, { prompt_name: e.target.value })
                      }
                    >
                      <option value="">Select prompt...</option>
                      {prompts.map((p) => (
                        <option key={p.name} value={p.name}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <Button
            onClick={handleSave}
            disabled={!name.trim() || !currentUser || saving}
          >
            <Save className="h-4 w-4 mr-1" />
            {saving ? "Saving..." : "Create Workflow"}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/workflows">Cancel</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function NewWorkflowPage() {
  return (
    <Suspense fallback={<div className="h-64 bg-secondary rounded animate-pulse" />}>
      <NewWorkflowPageInner />
    </Suspense>
  );
}
