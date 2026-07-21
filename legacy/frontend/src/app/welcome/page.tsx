"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Shield,
  Users,
  FileText,
  Zap,
  GitBranch,
  Lock,
} from "lucide-react";
import { getOrgStatus } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function WelcomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [hasOrg, setHasOrg] = useState<boolean | null>(null);

  useEffect(() => {
    if (user) {
      router.replace("/");
      return;
    }
    getOrgStatus()
      .then((res) => setHasOrg(res.has_org))
      .catch(() => setHasOrg(true));
  }, [user, router]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="SpecHub"
              width={32}
              height={32}
              className="rounded-md"
            />
            <span className="text-base font-bold tracking-tight">
              Spec<span className="text-primary">Hub</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            {hasOrg === false ? (
              <Button asChild>
                <Link href="/register">
                  Get Started
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/login">Sign In</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href="/register">
                    Get Started
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex items-center">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-24 text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-secondary/50 px-3 py-1 text-xs text-muted-foreground mb-6">
            <Lock className="h-3 w-3" />
            Self-hosted &middot; Open Source
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
            Your Prompt
            <br />
            <span className="text-primary">Control Plane</span>
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            A self-hosted prompt registry with team governance, policy
            enforcement, and MCP distribution. Manage prompts like
            infrastructure.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            {hasOrg === false ? (
              <Button size="lg" asChild>
                <Link href="/register">
                  Create Organization
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            ) : (
              <>
                <Button size="lg" asChild>
                  <Link href="/login">
                    Sign In
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/register">Create Organization</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border/50 bg-secondary/20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: FileText,
                title: "Prompt Registry",
                desc: "Version-controlled prompts with Jinja2 templating, tagging, and include support.",
              },
              {
                icon: Users,
                title: "Team Governance",
                desc: "Hierarchical teams, role-based access, and invitation-based onboarding.",
              },
              {
                icon: Shield,
                title: "Policy Enforcement",
                desc: "Inherited policies that prepend, append, or inject rules into every prompt expansion.",
              },
              {
                icon: GitBranch,
                title: "MCP Distribution",
                desc: "Every prompt becomes an MCP tool. Connect your AI agents directly.",
              },
              {
                icon: Zap,
                title: "Workflows",
                desc: "Chain prompts into multi-step workflows with dependency resolution.",
              },
              {
                icon: Lock,
                title: "Self-Hosted",
                desc: "Your data stays on your infrastructure. No external dependencies.",
              },
            ].map((f) => (
              <div key={f.title} className="space-y-2">
                <div className="flex items-center gap-2">
                  <f.icon className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">{f.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-6">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 flex items-center justify-between text-xs text-muted-foreground">
          <span>SpecHub &mdash; Prompt Control Plane</span>
          <span>Open Source</span>
        </div>
      </footer>
    </div>
  );
}
