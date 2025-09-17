/**
 * @file This file defines the main login page for the application.
 * It presents a tabbed interface for users to log in as either an Employee or an Admin.
 */
"use client";

import { useRouter } from "next/navigation";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "@/components/logo";
import app from "@/lib/firebase/config";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, Suspense } from "react";
import { getEmployeeById } from "@/lib/firebase/firestore";
import * as mock from "@/lib/mock-data";
import { Switch } from "@/components/ui/switch";
import { isTestMode, setTestMode } from "@/lib/test-mode";
import { Loader2 } from "lucide-react";

const auth = getAuth(app);
const TEST_USER_ID_KEY = 'perdiem-pro-test-user-id';

/**
 * The main interactive component for the login page, featuring separate tabs for employee and admin login.
 * @returns {JSX.Element} The rendered login card.
 */
function LoginCard() {
  const router = useRouter();
  const { toast } = useToast();
  const [employeeEmail, setEmployeeEmail] = useState("");
  const [employeePassword, setEmployeePassword] = useState("");
  const [adminEmail, setAdminEmail] = useState("admin@example.com");
  const [adminPassword, setAdminPassword] = useState("password");
  const [testMode, setTestModeState] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
    const currentTestMode = isTestMode();
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
   * Handles the employee login form submission.
   * Prevents the default form submission and redirects the user to the employee dashboard.
   * @param {React.FormEvent} e - The form submission event.
   */
  const handleEmployeeLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isTestMode()) {
        const mockUsers = await mock.getEmployees();
        // In test mode, log in as the first available non-admin user
        const user = mockUsers.find(u => u.role !== 'Admin');
        if (user) {
            localStorage.setItem(TEST_USER_ID_KEY, user.id);
            router.push("/dashboard");
        } else {
            toast({
                title: "Login Failed",
                description: "No mock employee found.",
                variant: "destructive",
            });
        }
        return;
    }
    try {
      await signInWithEmailAndPassword(auth, employeeEmail, employeePassword);
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
    if (isTestMode()) {
        const mockUsers = await mock.getEmployees();
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
      const employee = await getEmployeeById(user.uid);
      if (employee && employee.role === 'Admin') {
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
  
  if (!hasMounted) {
    return (
        <Card className="w-full max-w-sm">
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
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome Back</CardTitle>
          <CardDescription>
            Select your role to access your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="employee" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="employee">Employee</TabsTrigger>
              <TabsTrigger value="admin">Admin</TabsTrigger>
            </TabsList>
            <TabsContent value="employee">
              <form onSubmit={handleEmployeeLogin}>
                <div className="space-y-4 py-4">
                  {!testMode ? (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="employee-email">Email</Label>
                        <Input
                          id="employee-email"
                          type="email"
                          placeholder="your-email@health.org"
                          required
                          value={employeeEmail}
                          onChange={(e) => setEmployeeEmail(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                          id="password"
                          type="password"
                          required
                          value={employeePassword}
                          onChange={(e) => setEmployeePassword(e.target.value)}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="text-center text-sm text-muted-foreground py-8">
                      Click below to log in as a test employee.
                    </div>
                  )}
                </div>
                <Button type="submit" className="w-full">
                  Login as Employee
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
                      <div className="space-y-2">
                        <Label htmlFor="admin-password">Password</Label>
                        <Input
                          id="admin-password"
                          type="password"
                          required
                          value={adminPassword}
                          onChange={(e) => setAdminPassword(e.target.value)}
                        />
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
