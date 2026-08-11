
/**
 * @file This file defines the main login page for the application, used by
 * Participants only - Client/Super/Master Admins sign in through their own
 * dedicated portals (/<clientSlug>-admin, /super-admin, /master-admin).
 */
"use client";

import { useRouter } from "next/navigation";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, Suspense } from "react";
import { Eye, EyeOff, Loader2, Download } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import Link from "next/link";

/**
 * The main interactive component for the login page.
 * @returns {JSX.Element} The rendered login card.
 */
function LoginCard() {
  const router = useRouter();
  const { toast } = useToast();
  const [participantEmail, setParticipantEmail] = useState("");
  const [participantPassword, setParticipantPassword] = useState("");
  const [hasMounted, setHasMounted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // State for password reset
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [isSendingReset, setIsSendingReset] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    setHasMounted(true);
  }, []);

  /**
   * Handles the participant login form submission.
   * Prevents the default form submission and redirects the user to the participant dashboard.
   * @param {React.FormEvent} e - The form submission event.
   */
  const handleParticipantLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: participantEmail, password: participantPassword });
      if (error) throw error;
      router.push("/dashboard");
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: error.message,
        variant: "destructive",
      });
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
  
  if (!hasMounted) {
    return (
        <Card className="w-full max-w-sm mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Welcome Back</CardTitle>
              <CardDescription>
                Sign in to access your account.
              </CardDescription>
            </CardHeader>
            <CardContent className="h-64 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </CardContent>
             <CardFooter className="flex flex-col gap-4">
                <div className="text-sm text-muted-foreground">
                  <p>
                    Don't have an account?&nbsp;
                    <a href="/register" className="text-primary underline-offset-4 hover:underline">
                      Register
                    </a>
                  </p>
                </div>
            </CardFooter>
        </Card>
    );
  }


  return (
    <>
      <Card className="w-full max-w-sm mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome Back</CardTitle>
          <CardDescription>
            Sign in to access your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleParticipantLogin}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="participant-email">Email</Label>
                <Input
                  id="participant-email"
                  type="email"
                  placeholder="email@example.com"
                  required
                  value={participantEmail}
                  onChange={(e) => setParticipantEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2 relative">
                <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                     <button type="button" onClick={() => { setResetEmail(participantEmail); setIsResetDialogOpen(true); }} className="text-xs text-primary underline-offset-4 hover:underline">
                        Forgot Password?
                     </button>
                </div>
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={participantPassword}
                  onChange={(e) => setParticipantPassword(e.target.value)}
                />
                 <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-7 h-7 w-7"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  <span className="sr-only">{showPassword ? 'Hide password' : 'Show password'}</span>
                </Button>
              </div>
            </div>
            <Button type="submit" className="w-full">
              Login
            </Button>
          </form>
        </CardContent>
         <CardFooter className="flex flex-col gap-4">
            {isMobile && (
                <Button variant="outline" className="w-full" asChild>
                    <Link href="https://firebasestorage.googleapis.com/v0/b/studio-4535556312-b9752.firebasestorage.app/o/my%20perdiem%201.0.5.apk?alt=media&token=f57460a1-4aa4-4043-83a3-077bbc80f02f">
                        <Download className="mr-2 h-4 w-4" />
                        Download Android App
                    </Link>
                </Button>
            )}
            <div className="text-sm text-muted-foreground">
              <p>
                Don't have an account?&nbsp;
                <a href="/register" className="text-primary underline-offset-4 hover:underline">
                  Register
                </a>
              </p>
            </div>
        </CardFooter>
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

export default function LoginPage() {
  return (
    <div className="flex flex-col min-h-screen items-center justify-center bg-background p-4">
      <Suspense fallback={
        <div className="w-full max-w-sm h-[480px] flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }>
        <LoginCard />
      </Suspense>
      <footer className="py-4 text-center text-xs text-muted-foreground">
        Myperdiem provided by <Link href="https://www.tuque.africa" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">Tuque Consulting</Link>
      </footer>
    </div>
  );
}
