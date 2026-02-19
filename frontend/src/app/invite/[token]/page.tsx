"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Loader2, AlertCircle } from "lucide-react";
import { getInvitationInfo, acceptInvitation } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function AcceptInvitePage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;
  const { loginWithToken } = useAuth();

  const [inviteInfo, setInviteInfo] = useState<{
    email: string;
    team_id: string;
    role: string;
  } | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [infoError, setInfoError] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    getInvitationInfo(token)
      .then(setInviteInfo)
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Invalid invitation";
        if (msg.includes("410")) {
          setInfoError("This invitation has expired or already been used.");
        } else if (msg.includes("404")) {
          setInfoError("Invitation not found.");
        } else {
          setInfoError("Unable to load invitation.");
        }
      })
      .finally(() => setLoadingInfo(false));
  }, [token]);

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
      const derivedUsername = (inviteInfo?.email ?? "").split("@")[0].toLowerCase().replace(/[^a-z0-9._-]/g, "");
      const derivedDisplayName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
      const res = await acceptInvitation(token, {
        username: derivedUsername,
        password,
        display_name: derivedDisplayName || undefined,
      });
      loginWithToken(res.token, res.user);
      router.push("/");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to accept invitation.";
      if (msg.includes("409")) {
        setError("Username or email already taken.");
      } else {
        setError("Failed to accept invitation. It may have expired.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (loadingInfo) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (infoError) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-8 text-center">
            <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-3" />
            <p className="text-muted-foreground">{infoError}</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => router.push("/login")}
            >
              Go to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">
            Join <span className="text-primary">SpecHub</span>
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            You&apos;ve been invited as{" "}
            <Badge variant="secondary" className="text-xs">
              {inviteInfo?.role}
            </Badge>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {inviteInfo?.email}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                {error}
              </div>
            )}

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
                  autoFocus
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
                <UserPlus className="h-4 w-4 mr-1" />
              )}
              Create Account & Join
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
