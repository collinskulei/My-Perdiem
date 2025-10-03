

/**
 * @file This file defines the new user registration page.
 * It features a dynamic form that adapts based on whether the user is registering as an Participant or an Admin.
 */
"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/logo";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import * as firestore from '@/lib/firebase/firestore';
import * as mock from '@/lib/mock-data';
import { isTestMode } from '@/lib/test-mode';
import type { ParticipantData } from "@/lib/firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import app from "@/lib/firebase/config";

const dataProvider = isTestMode() ? mock : firestore;
const auth = getAuth(app);


/**
 * The main component for the registration wizard.
 * It manages the state for the current step and handles navigation between steps.
 * @returns {JSX.Element} The rendered registration wizard.
 */
function RegistrationWizard() {
  const [formData, setFormData] = useState<Partial<ParticipantData & { password?: string, confirmPassword?: string, organizationName?: string, dateOfBirth?: string, phone?: string }>>({});
  const [isAgreed, setIsAgreed] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  /**
   * Handles input changes and updates the form data state.
   * @param {React.ChangeEvent<HTMLInputElement>} e - The input change event.
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  /**
   * Handles select changes and updates the form data state.
   * @param {string} id - The id of the select component.
   * @param {string} value - The selected value.
   */
  const handleSelectChange = (id: string, value: string) => {
    setFormData(prev => ({ ...prev, [id]: value }));
  };
  
  /**
   * Handles the final form submission.
   * Creates a user in Firebase Auth and then saves their profile to Firestore.
   * @param {React.FormEvent} e - The form submission event.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // --- Form Validation ---
     if (!isAgreed) {
      toast({ title: "Agreement Required", description: "You must agree to the terms and conditions and privacy policy to register.", variant: "destructive" });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast({ title: "Passwords do not match", description: "Please ensure your passwords match.", variant: "destructive" });
      return;
    }
    
    if ((formData.password?.length ?? 0) < 6) {
      toast({ title: "Weak Password", description: "Password must be at least 6 characters long.", variant: "destructive" });
      return;
    }

    if (formData.phone && !/^[17]/.test(formData.phone)) {
       toast({ title: "Invalid Phone Number", description: "Phone number must start with 7 or 1.", variant: "destructive" });
      return;
    }

    const requiredFields: (keyof typeof formData)[] = [
        "name", "phone", "idNumber", "dateOfBirth", "email", "password", "participantNumber", "role", "jobGroup", "dutyStation"
    ];


    for (const field of requiredFields) {
        if (!formData[field]) {
            toast({ title: "Missing required fields", description: `Please fill out the '${field}' field.`, variant: "destructive" });
            return;
        }
    }

    const fullPhoneNumber = `+254${formData.phone}`;

    // --- Uniqueness Validation ---
    const isEmailTaken = !(await dataProvider.isEmailUnique(formData.email!));
    if (isEmailTaken) {
      toast({ title: "Registration Failed", description: "This email address is already registered.", variant: "destructive" });
      return;
    }

    const isIdNumberTaken = !(await dataProvider.isIdNumberUnique(formData.idNumber!));
    if (isIdNumberTaken) {
      toast({ title: "Registration Failed", description: "This ID number is already registered.", variant: "destructive" });
      return;
    }

    const isPhoneTaken = !(await dataProvider.isPhoneNumberUnique(fullPhoneNumber));
    if (isPhoneTaken) {
      toast({ title: "Registration Failed", description: "This phone number is already registered.", variant: "destructive" });
      return;
    }
    
    try {
      // 1. Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email!, formData.password!);
      const user = userCredential.user;

      // 2. Save additional participant details to Firestore
      const participantData = {
          name: formData.name,
          phoneNumber: fullPhoneNumber,
          idNumber: formData.idNumber,
          email: user.email!, // Use email from the created user
          dateOfBirth: formData.dateOfBirth,
          role: formData.role,
          participantNumber: formData.participantNumber,
          dutyStation: formData.dutyStation,
          jobGroup: formData.jobGroup,
      };


      await dataProvider.addParticipant(participantData, user.uid);
      
      toast({
          title: "Registration Successful",
          description: `Your participant account has been created.`,
      });

      router.push("/dashboard");

    } catch (error: any) {
        console.error("Registration failed:", error);
        toast({
            title: "Registration Failed",
            description: error.message || `Could not create your participant account. Please try again.`,
            variant: "destructive",
        });
    }
  };

  const designations = [
    "Medical Director",
    "Chief Nursing Officer",
    "Resident Doctor",
    "Registered Nurse",
    "Clinical Officer",
    "Pharmacist",
    "Laboratory Technologist",
    "Radiographer",
    "Physiotherapist",
    "Hospital Administrator",
  ];
  
  const jobGroups = ["A", "B1", "B2", "B3", "B4", "B5", "C1", "C2", "C3", "C4", "C5", "D1", "D2", "D3", "D4", "D5", "E1", "E2", "E4", "H", "J", "K", "L", "M", "N", "P", "Q", "R", "S"];

  const emailOptions = [
    "participant1@example.com",
    "participant2@example.com",
    "participant3@example.com",
    "participant4@example.com",
    "admin@example.com",
    "admin2@example.com",
    "outreach@health.org",
    "wellness@health.org",
    "community@health.org",
    "training@health.org",
    "education@health.org",
    "research@health.org",
    "innovation@health.org",
    "telemedicine@health.org",
    "patientcare@health.org",
    "appointments@health.org"
  ];

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl">Create a Participant Account</CardTitle>
          <CardDescription>
            Fill out the form below to register. Fields marked with <span className="text-destructive">*</span> are required.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name <span className="text-destructive">*</span></Label>
                <Input id="name" placeholder="e.g., John Doe" required onChange={handleInputChange} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <Label htmlFor="phone">M-Pesa Phone Number <span className="text-destructive">*</span></Label>
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
                        onChange={handleInputChange}
                        />
                    </div>
                    <p className="text-xs text-muted-foreground">This number will be used to send per diem payments.</p>
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="idNumber">ID Number <span className="text-destructive">*</span></Label>
                    <Input 
                        id="idNumber" 
                        placeholder="e.g., 12345678" 
                        required 
                        onChange={handleInputChange}
                        maxLength={8}
                    />
                </div>
            </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="dateOfBirth">Date of Birth <span className="text-destructive">*</span></Label>
                    <Input 
                        id="dateOfBirth" 
                        type="date" 
                        required 
                        onChange={handleInputChange} 
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="participantNumber">Participant Number <span className="text-destructive">*</span></Label>
                    <Input id="participantNumber" placeholder="e.g., EMP123" required onChange={handleInputChange} />
                </div>
            </div>
            
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="role">Designation <span className="text-destructive">*</span></Label>
                   <Select required onValueChange={(value) => handleSelectChange('role', value)}>
                    <SelectTrigger id="role">
                      <SelectValue placeholder="Select a designation" />
                    </SelectTrigger>
                    <SelectContent>
                      {designations.map((designation) => (
                        <SelectItem key={designation} value={designation}>
                          {designation}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                 <div className="space-y-2">
                  <Label htmlFor="jobGroup">Job Group <span className="text-destructive">*</span></Label>
                   <Select required onValueChange={(value) => handleSelectChange('jobGroup', value)}>
                    <SelectTrigger id="jobGroup">
                      <SelectValue placeholder="Select a job group" />
                    </SelectTrigger>
                    <SelectContent>
                      {jobGroups.map((group) => (
                        <SelectItem key={group} value={group}>
                          {group}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="dutyStation">Duty Station <span className="text-destructive">*</span></Label>
                  <Input id="dutyStation" placeholder="e.g., Nairobi" required onChange={handleInputChange} />
                </div>
              </div>
            
            <div className="space-y-2">
                <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
                 <Select required onValueChange={(value) => handleSelectChange('email', value)}>
                    <SelectTrigger id="email">
                    <SelectValue placeholder="Select an email" />
                    </SelectTrigger>
                    <SelectContent>
                        {emailOptions.map((email) => (
                            <SelectItem key={email} value={email}>
                                {email}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="password">Password <span className="text-destructive">*</span></Label>
                    <Input id="password" type="password" required onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password <span className="text-destructive">*</span></Label>
                    <Input id="confirmPassword" type="password" required onChange={handleInputChange} />
                </div>
            </div>
            <div className="items-top flex space-x-2">
                <Checkbox id="terms" checked={isAgreed} onCheckedChange={(checked) => setIsAgreed(checked as boolean)} />
                <div className="grid gap-1.5 leading-none">
                    <label
                    htmlFor="terms"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                    I agree to the{" "}
                    <Link href="#" className="underline">
                        terms and conditions
                    </Link>{" "}
                    and{" "}
                    <Link href="#" className="underline">
                        privacy policy
                    </Link>
                    . <span className="text-destructive">*</span>
                    </label>
                </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <Button variant="ghost" asChild className="w-full sm:w-auto">
                <Link href="/">Cancel</Link>
            </Button>
            <Button type="submit" className="w-full sm:w-auto" disabled={!isAgreed}>
              Submit Registration
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export default function RegistrationPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <RegistrationWizard />
        </Suspense>
    );
}
    

    

