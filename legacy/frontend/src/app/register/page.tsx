"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, Loader2 } from "lucide-react";
import { register, getOrgStatus } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function RegisterPage() {
  const router = useRouter();
  const { user, loginWithToken } = useAuth();

  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingOrg, setCheckingOrg] = useState(true);

  useEffect(() => {
    if (user) {
      router.replace("/");
      return;
    }
    getOrgStatus()
      .then((res) => {
        if (res.has_org) {
          router.replace("/login");
        }
      })
      .catch(() => {})
      .finally(() => setCheckingOrg(false));
  }, [user, router]);

  const orgSlug = orgName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const derivedUsername = email.trim().split("@")[0].toLowerCase().replace(/[^a-z0-9._-]/g, "");
      const derivedDisplayName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
      const res = await register({
        org_name: orgName.trim(),
        org_slug: orgSlug,
        email: email.trim(),
        username: derivedUsername,
        password,
        display_name: derivedDisplayName || undefined,
      });
      loginWithToken(res.token, res.user);
      router.push("/");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Registration failed.";
      if (msg.includes("409")) {
        setError("Organization already exists. Please sign in instead.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  if (checkingOrg) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">
            Set up <span className="text-primary">SpecHub</span>
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Create your organization and admin account.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                {error}
              </div>
            )}

            <div>
              <label className="text-xs text-muted-foreground">
                Organization Name
              </label>
              <Input
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Acme Corp"
                required
                autoFocus
                className="mt-1"
              />
              {orgSlug && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Slug: <code>{orgSlug}</code>
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">
                  First Name
                </label>
                <Input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Alice"
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">
                  Last Name
                </label>
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Smith"
                  required
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alice@acme.com"
                required
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">
                  Password
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">
                  Confirm
                </label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="mt-1"
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Building2 className="h-4 w-4 mr-1" />
              )}
              Create Organization
            </Button>
          </form>
          <p className="text-xs text-center text-muted-foreground mt-4">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
          <p className="text-xs text-center text-muted-foreground mt-1">
            <Link href="/welcome" className="hover:underline">
              &larr; Back to home
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
