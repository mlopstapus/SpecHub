"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogIn, Loader2 } from "lucide-react";
import { login, getOrgStatus } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const router = useRouter();
  const { user, loginWithToken } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        if (!res.has_org) {
          router.replace("/register");
        }
      })
      .catch(() => {})
      .finally(() => setCheckingOrg(false));
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await login({ email, password });
      loginWithToken(res.token, res.user);
      router.push("/");
    } catch {
      setError("Invalid email or password.");
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
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">
            Sign in to <span className="text-primary">SpecHub</span>
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Enter your credentials to continue.
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
              <label className="text-xs text-muted-foreground">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                autoFocus
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="mt-1"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <LogIn className="h-4 w-4 mr-1" />
              )}
              Sign In
            </Button>
          </form>
          <p className="text-xs text-center text-muted-foreground mt-4">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-primary hover:underline">
              Set up your organization
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
