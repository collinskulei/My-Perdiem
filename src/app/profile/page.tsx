/**
 * @file This file defines the user profile page.
 * It allows both employees and admins to view and edit their personal information.
 */
"use client";

import { useState, useEffect } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
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
import * as firestore from '@/lib/firebase/firestore';
import * as mock from '@/lib/mock-data';
import { isTestMode } from '@/lib/test-mode';
import type { Employee } from "@/lib/data";
import app from "@/lib/firebase/config";
import { Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const dataProvider = isTestMode() ? mock : firestore;
const auth = getAuth(app);

// Form values type, making some fields optional for the form state
type ProfileFormValues = Omit<Employee, "id" | "avatarUrl" | "email">;

/**
 * The main component for the user profile page.
 * Fetches user data, displays it in a form, and handles updates.
 * @returns {JSX.Element} The rendered profile page.
 */
export default function ProfilePage() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
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
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setAuthUser(user);
      } else {
        router.push("/"); // Redirect to login if not authenticated
      }
    });
    return () => unsubscribe();
  }, [router]);

  // Fetch employee data once authenticated
  useEffect(() => {
    async function fetchEmployeeData() {
      if (authUser) {
        setLoading(true);
        const employeeData = await dataProvider.getEmployeeById(authUser.uid);
        setEmployee(employeeData);
        if (employeeData) {
          // Once data is fetched, reset the form with the employee's details
          reset(employeeData);
        }
        setLoading(false);
      }
    }
    fetchEmployeeData();
  }, [authUser, reset]);

  /**
   * Handles the form submission to update the user's profile.
   * @param {ProfileFormValues} data - The updated form data.
   */
  const onSubmit = async (data: ProfileFormValues) => {
    if (!authUser) return;

    setIsSaving(true);
    try {
      await dataProvider.updateEmployee(authUser.uid, data);
      setEmployee(prev => prev ? { ...prev, ...data } : null);
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

  if (!employee) {
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
                    <AvatarImage src={employee.avatarUrl} data-ai-hint="person avatar" />
                    <AvatarFallback>{employee.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                    <h2 className="text-2xl font-semibold">{employee.name}</h2>
                    <p className="text-muted-foreground">{employee.email}</p>
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
                 <div className="space-y-2">
                    <Label htmlFor="gender">Gender</Label>
                    <Controller
                        name="gender"
                        control={control}
                        render={({ field }) => <Input id="gender" {...field} />}
                    />
                </div>
                {employee.role !== 'Admin' && (
                    <>
                        <div className="space-y-2">
                            <Label htmlFor="employeeNumber">Employee Number</Label>
                            <Controller
                                name="employeeNumber"
                                control={control}
                                render={({ field }) => <Input id="employeeNumber" {...field} />}
                            />
                        </div>
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
                            <Label htmlFor="role">Role/Designation</Label>
                             <Controller
                                name="role"
                                control={control}
                                render={({ field }) => <Input id="role" {...field} />}
                            />
                        </div>
                    </>
                )}
                 {employee.role === 'Admin' && (
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
