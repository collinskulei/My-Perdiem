/**
 * @file This file defines the new employee registration page.
 * It features a multi-step wizard to guide users through entering their personal and employment details.
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

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
import { Progress } from "@/components/ui/progress";
import { Logo } from "@/components/logo";

/**
 * The main component for the registration wizard.
 * It manages the state for the current step and handles navigation between steps.
 * @returns {JSX.Element} The rendered registration wizard.
 */
export default function RegistrationWizard() {
  const [step, setStep] = useState(1);
  const [idNumber, setIdNumber] = useState("");
  const router = useRouter();

  /**
   * Advances the wizard to the next step, validating the ID number.
   */
  const handleNext = () => {
    if (step === 1) {
      if (!/^\d{8}$/.test(idNumber)) {
        alert("Please enter a valid 8-digit ID number.");
        return;
      }
    }
    setStep(step + 1);
  };
  
  /**
   * Returns the wizard to the previous step.
   */
  const handleBack = () => setStep(step - 1);
  
  /**
   * Handles the final form submission.
   * Prevents the default form action and redirects the user to the employee dashboard.
   * @param {React.FormEvent} e - The form submission event.
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real application, this would send data to a server.
    router.push("/dashboard");
  };

  // Calculate the progress bar value based on the current step.
  const progressValue = (step / 2) * 100;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="mb-4 flex justify-center">
            <Logo />
          </div>
          <CardTitle className="text-2xl">New Employee Registration</CardTitle>
          <CardDescription>
            Step {step} of 2: {step === 1 ? "Personal Details" : "Employment Details"}
          </CardDescription>
          <Progress value={progressValue} className="mt-2" />
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {/* Step 1: Personal Details */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="first-name">First Name</Label>
                    <Input id="first-name" placeholder="e.g., John" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="middle-name">Middle Name</Label>
                    <Input id="middle-name" placeholder="e.g., Owuor" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sir-name">Surname</Label>
                    <Input id="sir-name" placeholder="e.g., Doe" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <div className="flex items-center">
                    <span className="inline-flex h-10 items-center rounded-l-md border border-r-0 border-input bg-background px-3 text-muted-foreground">
                      +254
                    </span>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="712345678"
                      required
                      className="rounded-l-none"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="id-number">ID Number</Label>
                  <Input 
                    id="id-number" 
                    placeholder="e.g., 12345678" 
                    required 
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    maxLength={8}
                  />
                </div>
              </div>
            )}
            {/* Step 2: Employment Details */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="employee-number">Employee Number</Label>
                  <Input id="employee-number" placeholder="e.g., EMP123" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Input id="role" placeholder="e.g., Software Engineer" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duty-station">Duty Station</Label>
                  <Input id="duty-station" placeholder="e.g., Nairobi" required />
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            {step > 1 ? (
              <Button type="button" variant="outline" onClick={handleBack}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
            ) : (
                <Button variant="ghost" asChild>
                    <Link href="/">Cancel</Link>
                </Button>
            )}
            {step < 2 ? (
              <Button type="button" onClick={handleNext}>
                Next
              </Button>
            ) : (
              <Button type="submit">
                Submit Registration
              </Button>
            )}
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
