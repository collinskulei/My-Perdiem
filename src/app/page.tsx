
/**
 * @file This file defines the main login page for the application.
 * It presents a tabbed interface for users to log in as either an Participant or an Admin.
 */
"use client";

import { useRouter } from "next/navigation";
import { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import app from "@/lib/firebase/config";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, Suspense } from "react";
import * as firestore from '@/lib/firebase/firestore';
import * as mock from "@/lib/mock-data";
import { Switch } from "@/components/ui/switch";
import { isTestMode as getIsTestMode, setTestMode } from "@/lib/test-mode";
import { Eye, EyeOff, Loader2, Download } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import Link from "next/link";

const auth = getAuth(app);
const TEST_USER_ID_KEY = 'perdiem-pro-test-user-id';

/**
 * The main interactive component for the login page, featuring separate tabs for participant and admin login.
 * @returns {JSX.Element} The rendered login card.
 */
function LoginCard() {
  const router = useRouter();
  const { toast } = useToast();
  const [participantEmail, setParticipantEmail] = useState("");
  const [participantPassword, setParticipantPassword] = useState("");
  const [adminEmail, setAdminEmail] = useState("admin@example.com");
  const [adminPassword, setAdminPassword] = useState("password");
  const [testMode, setTestModeState] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // State for password reset
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [isSendingReset, setIsSendingReset] = useState(false);
  const isMobile = useIsMobile();


  const dataProvider = getIsTestMode() ? mock : firestore;

  useEffect(() => {
    setHasMounted(true);
    const currentTestMode = getIsTestMode();
    setTestModeState(currentTestMode);
    if (currentTestMode) {
      // Clear any previous test session on login page load
      localStorage.removeItem(TEST_USER_ID_KEY);
    }
  }, []);

  const handleTestModeChange = (checked: boolean) => {
    setTestMode(checked);
    setTestModeState(checked);
    window.location.reload(); 
  };


  /**
   * Handles the participant login form submission.
   * Prevents the default form submission and redirects the user to the participant dashboard.
   * @param {React.FormEvent} e - The form submission event.
   */
  const handleParticipantLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (getIsTestMode()) {
        const mockUsers = await mock.getParticipants();
        // In test mode, log in as the first available non-admin user
        const user = mockUsers.find(u => u.role !== 'Admin');
        if (user) {
            localStorage.setItem(TEST_USER_ID_KEY, user.id);
            router.push("/dashboard");
        } else {
            toast({
                title: "Login Failed",
                description: "No mock participant found.",
                variant: "destructive",
            });
        }
        return;
    }
    try {
      await signInWithEmailAndPassword(auth, participantEmail, participantPassword);
      router.push("/dashboard");
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  /**
   * Handles the admin login form submission.
   * Prevents the default form submission and redirects the user to the admin dashboard.
   * @param {React.FormEvent} e - The form submission event.
   */
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (getIsTestMode()) {
        const mockUsers = await mock.getParticipants();
        // In test mode, log in as the first available admin user
        const user = mockUsers.find(u => u.role === 'Admin');
        if (user) {
            localStorage.setItem(TEST_USER_ID_KEY, user.id);
            router.push("/admin");
        } else {
            toast({
                title: "Login Failed",
                description: "No mock admin found.",
                variant: "destructive",
            });
        }
        return;
    }
     try {
      const userCredential = await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
      const user = userCredential.user;

      // Check if the user has an 'Admin' role
      const participant = await dataProvider.getParticipantById(user.uid);
      if (participant && participant.role === 'Admin') {
        router.push("/admin");
      } else {
        await auth.signOut(); // Sign out the user if they are not an admin
        throw new Error("You do not have administrative privileges.");
      }
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
            await sendPasswordResetEmail(auth, resetEmail);
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
                Select your role to access your account.
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
            Select your role to access your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="participant" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="participant">Participant</TabsTrigger>
              <TabsTrigger value="admin">Admin</TabsTrigger>
            </TabsList>
            <TabsContent value="participant">
              <form onSubmit={handleParticipantLogin}>
                <div className="space-y-4 py-4">
                  {!testMode ? (
                    <>
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
                    </>
                  ) : (
                    <div className="text-center text-sm text-muted-foreground py-8">
                      Click below to log in as a test participant.
                    </div>
                  )}
                </div>
                <Button type="submit" className="w-full">
                  Login as Participant
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="admin">
              <form onSubmit={handleAdminLogin}>
                <div className="space-y-4 py-4">
                   {!testMode ? (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="admin-email">Email</Label>
                        <Input
                          id="admin-email"
                          type="email"
                          placeholder="admin@example.com"
                          required
                          value={adminEmail}
                          onChange={(e) => setAdminEmail(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2 relative">
                         <div className="flex items-center justify-between">
                            <Label htmlFor="admin-password">Password</Label>
                             <button type="button" onClick={() => { setResetEmail(adminEmail); setIsResetDialogOpen(true); }} className="text-xs text-primary underline-offset-4 hover:underline">
                                Forgot Password?
                             </button>
                        </div>
                        <Input
                          id="admin-password"
                          type={showPassword ? "text" : "password"}
                          required
                          value={adminPassword}
                          onChange={(e) => setAdminPassword(e.target.value)}
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
                    </>
                  ) : (
                    <div className="text-center text-sm text-muted-foreground py-8">
                      Click below to log in as a test admin.
                    </div>
                  )}
                </div>
                <Button type="submit" className="w-full">
                  Login as Admin
                </Button>
              </form>
            </TabsContent>
          </Tabs>
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
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Switch id="test-mode" checked={testMode} onCheckedChange={handleTestModeChange} />
              <Label htmlFor="test-mode">Test Mode</Label>
            </div>
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
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Suspense fallback={
        <div className="w-full max-w-sm h-[480px] flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }>
        <LoginCard />
      </Suspense>
    </div>
  );
}

    