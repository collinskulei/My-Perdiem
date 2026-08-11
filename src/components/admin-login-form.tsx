/**
 * @file Shared login form used by the three tier-specific admin portals
 * (/super-admin, /master-admin, /<clientSlug>-admin). Extracted from the
 * admin-login logic that used to live in the landing page's "Admin" tab.
 */
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase/client";
import * as supabaseDb from "@/lib/supabase/database";
import type { AccessTier } from "@/lib/data";

export function AdminLoginForm({
  title,
  description = "Sign in to manage your dashboard.",
  expectedTier,
  expectedClientId,
  redirectTo,
}: {
  title: string;
  description?: string;
  expectedTier: AccessTier;
  expectedClientId?: string;
  redirectTo: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [isSendingReset, setIsSendingReset] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const user = data.user;

      const participant = await supabaseDb.getParticipantById(user.id);
      // TEMPORARY (testing only, revoke before launch): master_admin can log
      // in through every portal regardless of expectedTier/expectedClientId,
      // so one account can exercise all three dashboards without needing
      // separate super_admin/client_admin test accounts. To revoke, delete
      // isMasterAdmin and go back to the two plain equality checks below.
      const isMasterAdmin = participant?.accessTier === 'master_admin';
      const tierMatches = participant?.accessTier === expectedTier || isMasterAdmin;
      const clientMatches = isMasterAdmin || !expectedClientId || participant?.clientId === expectedClientId;

      if (participant && tierMatches && clientMatches) {
        router.push(redirectTo);
      } else {
        await supabase.auth.signOut();
        throw new Error("You do not have access to this portal.");
      }
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!resetEmail) {
      toast({ title: "Email Required", description: "Please enter your email address.", variant: "destructive" });
      return;
    }
    setIsSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast({
        title: "Password Reset Email Sent",
        description: "Please check your inbox for instructions to reset your password.",
      });
      setIsResetDialogOpen(false);
      setResetEmail("");
    } catch (error: any) {
      toast({
        title: "Error Sending Email",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <>
      <Card className="w-full max-w-sm mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="admin-email">Email</Label>
                <Input
                  id="admin-email"
                  type="email"
                  placeholder="admin@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2 relative">
                <div className="flex items-center justify-between">
                  <Label htmlFor="admin-password">Password</Label>
                  <button
                    type="button"
                    onClick={() => {
                      setResetEmail(email);
                      setIsResetDialogOpen(true);
                    }}
                    className="text-xs text-primary underline-offset-4 hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>
                <Input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-7 h-7 w-7"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  <span className="sr-only">{showPassword ? "Hide password" : "Show password"}</span>
                </Button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign In
            </Button>
          </form>
        </CardContent>
      </Card>

      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Enter your email address and we will send you a link to reset your password.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="your.email@example.com"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResetDialogOpen(false)}>Cancel</Button>
            <Button onClick={handlePasswordReset} disabled={isSendingReset}>
              {isSendingReset && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Reset Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
