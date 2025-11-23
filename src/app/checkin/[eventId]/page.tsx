
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import app from "@/lib/firebase/config";
import { Loader2 } from "lucide-react";
import { isTestMode } from "@/lib/test-mode";

const auth = getAuth(app);
const TEST_USER_ID_KEY = 'perdiem-pro-test-user-id';

export default function CheckinRedirectPage() {
    const router = useRouter();
    const params = useParams();
    const eventId = params.eventId as string;
    const [status, setStatus] = useState("Authenticating...");

    useEffect(() => {
        if (!eventId) {
            setStatus("Error: Event ID is missing.");
            // Consider redirecting to a generic error page or home
            router.push("/");
            return;
        }
        
        // Handle Test Mode
        if (isTestMode()) {
            const testUserId = localStorage.getItem(TEST_USER_ID_KEY);
            if (testUserId) {
                // In test mode and a test user is "logged in"
                setStatus("Redirecting to dashboard...");
                router.replace(`/dashboard?tab=checkins&eventId=${eventId}`);
            } else {
                // In test mode, but no user session
                setStatus("Redirecting to registration...");
                router.replace('/register');
            }
            return;
        }

        // Handle Live Mode
        const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
            if (user) {
                // User is logged in
                setStatus("User authenticated. Redirecting to dashboard...");
                router.replace(`/dashboard?tab=checkins&eventId=${eventId}`);
            } else {
                // User is not logged in
                setStatus("User not authenticated. Redirecting to registration...");
                router.replace('/register');
            }
        });

        // Cleanup subscription on unmount
        return () => unsubscribe();

    }, [router, eventId]);

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-background">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-lg text-muted-foreground">{status}</p>
        </div>
    );
}
