

/**
 * @file This file defines the user profile page.
 * It allows both participants and admins to view and edit their personal information.
 */
"use client";

import { useState, useEffect, Suspense } from "react";
import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";

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
import { useToast } from "@/hooks/use-toast";
import * as supabaseDb from '@/lib/supabase/database';
import type { Participant } from "@/lib/data";
import { supabase } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const TIER_LABELS: Record<string, string> = {
  master_admin: "Master Admin",
  super_admin: "Super Admin",
  client_admin: "Client Admin",
  client_user: "Participant",
};

const dataProvider = supabaseDb;

// Form values type, making some fields optional for the form state
type ProfileFormValues = Omit<Participant, "id" | "avatarUrl" | "email">;

/**
 * The main component for the user profile page.
 * Fetches user data, displays it in a form, and handles updates.
 * @returns {JSX.Element} The rendered profile page.
 */
function Profile() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm<ProfileFormValues>();

  // Authenticate user
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
            setAuthUser(session.user);
        } else {
            router.push("/"); // Redirect to login if not authenticated
        }
    });
    return () => subscription.unsubscribe();
  }, [router]);

  // Fetch participant data once authenticated
  useEffect(() => {
    async function fetchParticipantData() {
      if (authUser) {
        setLoading(true);
        const participantData = await dataProvider.getParticipantById(authUser.id);
        setParticipant(participantData);
        if (participantData) {
          // Once data is fetched, reset the form with the participant's details
          reset(participantData);
        }
        setLoading(false);
      }
    }
    fetchParticipantData();
  }, [authUser, reset]);

  /**
   * Handles the form submission to update the user's profile.
   * @param {ProfileFormValues} data - The updated form data.
   */
  const onSubmit = async (data: ProfileFormValues) => {
    if (!authUser) return;

    setIsSaving(true);
    try {
      await dataProvider.updateParticipant(authUser.id, data);
      setParticipant(prev => prev ? { ...prev, ...data } : null);
      reset(data); // Resets the form's dirty state
      toast({
        title: "Profile Updated",
        description: "Your information has been successfully saved.",
      });
    } catch (error) {
      console.error("Failed to update profile:", error);
      toast({
        title: "Update Failed",
        description: "Could not save your changes. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!participant) {
    return (
        <div className="flex items-center justify-center h-screen">
            <p>Could not load user profile.</p>
        </div>
    );
  }

  return (
    <div className="flex justify-center items-start p-4 sm:p-6">
    <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>My Profile</CardTitle>
          <CardDescription>
            View and update your personal information.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
                 <Avatar className="h-16 w-16">
                    <AvatarImage src={participant.avatarUrl} data-ai-hint="person avatar" />
                    <AvatarFallback>{participant.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="space-y-1 overflow-hidden">
                    <div className="flex items-center gap-2">
                        <h2 className="text-2xl font-semibold truncate">{participant.name}</h2>
                        <Badge variant={participant.accessTier === "client_user" ? "secondary" : "default"}>
                            {TIER_LABELS[participant.accessTier] ?? participant.accessTier}
                        </Badge>
                    </div>
                    <p className="text-muted-foreground truncate">{participant.email}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Controller
                        name="name"
                        control={control}
                        render={({ field }) => <Input id="name" {...field} />}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="phoneNumber">Phone Number</Label>
                    <Controller
                        name="phoneNumber"
                        control={control}
                        render={({ field }) => <Input id="phoneNumber" {...field} />}
                    />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="idNumber">ID Number</Label>
                    <Controller
                        name="idNumber"
                        control={control}
                        render={({ field }) => <Input id="idNumber" {...field} />}
                    />
                </div>
                {participant.accessTier === 'client_user' && (
                    <>
                        <div className="space-y-2">
                            <Label htmlFor="dutyStation">Duty Station</Label>
                             <Controller
                                name="dutyStation"
                                control={control}
                                render={({ field }) => <Input id="dutyStation" {...field} />}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="jobGroup">Job Group</Label>
                             <Controller
                                name="jobGroup"
                                control={control}
                                render={({ field }) => <Input id="jobGroup" {...field} />}
                            />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="designation">Role/Designation</Label>
                             <Controller
                                name="designation"
                                control={control}
                                render={({ field }) => <Input id="designation" {...field} />}
                            />
                        </div>
                    </>
                )}
                 {participant.accessTier !== 'client_user' && (
                    <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="organizationName">Organization Name</Label>
                        <Controller
                            name="organizationName"
                            control={control}
                            render={({ field }) => <Input id="organizationName" {...field} />}
                        />
                    </div>
                )}
            </div>

        </CardContent>
        <CardFooter className="flex justify-end">
          <Button type="submit" disabled={!isDirty || isSaving}>
            {isSaving ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                </>
            ) : "Save Changes"}
          </Button>
        </CardFooter>
      </Card>
    </form>
    </div>
  );
}

export default function ProfilePage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <Profile />
        </Suspense>
    );
}


    
