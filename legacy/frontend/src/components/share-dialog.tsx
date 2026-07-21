"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Search, X, UserPlus } from "lucide-react";
import {
  listUsers,
  type User_t,
  type Share_t,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  shares: Share_t[];
  onShare: (userId: string) => Promise<void>;
  onUnshare: (userId: string) => Promise<void>;
}

export function ShareDialog({
  open,
  onOpenChange,
  title,
  shares,
  onShare,
  onUnshare,
}: ShareDialogProps) {
  const { user: currentUser } = useAuth();
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<User_t[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      listUsers()
        .then((res) => setUsers(res.items))
        .catch(() => {});
    }
  }, [open]);

  const sharedUserIds = new Set(shares.map((s) => s.user_id));

  const filteredUsers = users.filter((u) => {
    if (u.id === currentUser?.id) return false;
    if (sharedUserIds.has(u.id)) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.username.toLowerCase().includes(q) ||
      u.display_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q)
    );
  });

  const handleShare = async (userId: string) => {
    setLoading(true);
    try {
      await onShare(userId);
    } finally {
      setLoading(false);
    }
  };

  const handleUnshare = async (userId: string) => {
    setLoading(true);
    try {
      await onUnshare(userId);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[360px] sm:max-w-[360px]">
        <SheetHeader>
          <SheetTitle className="text-base">Share</SheetTitle>
          <SheetDescription className="text-xs">
            {title}
          </SheetDescription>
        </SheetHeader>

        {shares.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Shared with
            </p>
            <div className="space-y-1.5">
              {shares.map((share) => (
                <div
                  key={share.user_id}
                  className="flex items-center justify-between py-1.5 px-2 rounded-md bg-secondary/50"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {share.display_name || share.username}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      @{share.username}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleUnshare(share.user_id)}
                    disabled={loading}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Add people
          </p>
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            {filteredUsers.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                {search ? "No users found" : "No users to share with"}
              </p>
            ) : (
              filteredUsers.slice(0, 20).map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-secondary/50"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {u.display_name || u.username}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      @{u.username}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 shrink-0 text-primary"
                    onClick={() => handleShare(u.id)}
                    disabled={loading}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
