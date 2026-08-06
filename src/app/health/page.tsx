

/**
 * @file This file defines a health check page to verify Supabase connectivity.
 * It attempts to fetch data from the Supabase database and displays the connection status.
 */
"use client";

import { useState, useEffect, Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { isTestMode } from "@/lib/test-mode";
import * as supabaseDb from '@/lib/supabase/database';
import * as mock from '@/lib/mock-data';

const TEST_USER_ID_KEY = 'perdiem-pro-test-user-id';

// Mock User shape that is compatible with Supabase's User
type MockUser = {
    id: string;
}


/**
 * The main component for the Supabase health check page.
 * @returns {JSX.Element} The rendered health check page.
 */
function HealthCheck() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState<Error | null>(null);
  const [projectUrl, setProjectUrl] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | MockUser | null>(null);
  const [testMode, setTestMode] = useState(false);

  const dataProvider = testMode ? mock : supabaseDb;


  useEffect(() => {
    setTestMode(isTestMode());

    if (isTestMode()) {
        const testUserId = localStorage.getItem(TEST_USER_ID_KEY);
        if (testUserId) {
            setCurrentUser({ id: testUserId });
        }
    } else {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setCurrentUser(session?.user ?? null);
        });
        return () => subscription.unsubscribe();
    }
  }, []);

  useEffect(() => {
    async function checkSupabase() {
      setStatus("loading");
      try {
        // Set project URL from environment variable for display
        const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        if (!testMode && !configuredUrl) {
            throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set in your environment variables.");
        }
        setProjectUrl(configuredUrl ?? "N/A (Test Mode)");

        // Attempt to fetch data
        await dataProvider.getVenues();

        setStatus("success");
      } catch (e: any) {
        setError(e);
        setStatus("error");
      }
    }

    checkSupabase();
  }, [testMode, dataProvider]);

  return (
    <div className="flex flex-col min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Application Health Check
          </CardTitle>
          <CardDescription>
            This page checks the connectivity and configuration of the app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
             <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-1">
                    <p className="font-medium">Application Mode</p>
                     <p className="text-sm text-muted-foreground">
                        Indicates if the app is using live data or local test data.
                    </p>
                </div>
                 <Badge variant={testMode ? "destructive" : "secondary"}>
                    {testMode ? "Test Mode" : "Live Mode"}
                </Badge>
             </div>
             <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-1">
                    <p className="font-medium">Supabase Project URL</p>
                    <p className="text-sm text-muted-foreground">
                        The Supabase project URL configured in your environment.
                    </p>
                </div>
                {projectUrl ? (
                     <Badge variant={projectUrl.startsWith("N/A") ? "outline" : "secondary"}>{projectUrl}</Badge>
                ) : (
                    <Badge variant="destructive">Not Found</Badge>
                )}
             </div>
             <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-1">
                    <p className="font-medium">Authentication</p>
                     <p className="text-sm text-muted-foreground">
                        Checks if a user is currently signed in. UID: {currentUser?.id ?? 'None'}
                    </p>
                </div>
                {currentUser ? (
                     <Badge variant="secondary">Authenticated</Badge>
                ) : (
                    <Badge variant="outline">Not Authenticated</Badge>
                )}
             </div>
             <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-1">
                    <p className="font-medium">Data Store Connectivity</p>
                     <p className="text-sm text-muted-foreground">
                        Tests reading from the primary data source ({testMode ? 'localStorage' : 'Supabase'}).
                    </p>
                </div>
                {status === "loading" && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
                {status === "success" && <CheckCircle2 className="h-6 w-6 text-green-500" />}
                {status === "error" && <XCircle className="h-6 w-6 text-destructive" />}
             </div>
          </div>

          {status === "success" && (
            <Alert variant="default" className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
                <CheckCircle2 className="h-4 w-4 !text-green-600" />
              <AlertTitle className="text-green-800 dark:text-green-300">Connection Successful!</AlertTitle>
              <AlertDescription className="text-green-700 dark:text-green-400">
                The application is successfully connected to the data source ({testMode ? 'localStorage' : 'Supabase'}).
              </AlertDescription>
            </Alert>
          )}

          {status === "error" && error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Connection Failed</AlertTitle>
              <AlertDescription>
                <p className="mb-2">The application could not connect to {testMode ? 'localStorage' : 'Supabase'}. {testMode ? 'There might be an issue with your browser.' : 'This is often due to Supabase Row Level Security policies or missing environment variables.'}</p>
                <p className="font-mono bg-muted p-2 rounded-md text-xs">{error.message}</p>
                {!testMode && <p className="mt-2">Please ensure your Row Level Security policies allow authenticated users to read from the tables.</p>}
              </AlertDescription>
            </Alert>
          )}
           <div className="text-center pt-4">
                <Button asChild variant="link">
                    <Link href="/">Return to Login</Link>
                </Button>
           </div>
        </CardContent>
      </Card>
      <footer className="py-4 text-center text-xs text-muted-foreground">
          Myperdiem provided by <Link href="https://www.tuque.africa" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">Tuque Consulting</Link>
      </footer>
    </div>
  );
}

export default function HealthCheckPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center h-full w-full"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <HealthCheck />
        </Suspense>
    );
}
