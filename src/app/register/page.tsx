
/**
 * @file This file defines the new user registration page.
 * It features a dynamic form that adapts based on whether the user is registering as an Participant or an Admin.
 */
"use client";

import { useState, Suspense, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, ChevronsUpDown, Check, Eye, EyeOff } from "lucide-react";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import * as firestore from '@/lib/firebase/firestore';
import * as mock from '@/lib/mock-data';
import { isTestMode as checkIsTestMode } from '@/lib/test-mode';
import type { ParticipantData } from "@/lib/firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import app from "@/lib/firebase/config";
import { PlacesAutocomplete, type Place } from "@/components/places-autocomplete";
import { cn } from "@/lib/utils";


const dataProvider = checkIsTestMode() ? mock : firestore;
const auth = getAuth(app);


/**
 * The main component for the registration wizard.
 * It manages the state for the current step and handles navigation between steps.
 * @returns {JSX.Element} The rendered registration wizard.
 */
function RegistrationWizard() {
  const [formData, setFormData] = useState<Partial<ParticipantData & { password?: string, confirmPassword?: string, organizationName?: string, phone?: string }>>({});
  const [isAgreed, setIsAgreed] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const [isDesignationOpen, setIsDesignationOpen] = useState(false);
  const [isEmailOpen, setIsEmailOpen] = useState(false);
  const [otherDesignation, setOtherDesignation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const isTestMode = checkIsTestMode();


  /**
   * Handles input changes and updates the form data state.
   * @param {React.ChangeEvent<HTMLInputElement>} e - The input change event.
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };
  
  const handleDutyStationSelect = useCallback((place: Place | null) => {
    if (place) {
      setFormData(prev => ({ ...prev, dutyStation: place.name }));
    }
  }, []);


  /**
   * Handles select changes and updates the form data state.
   * @param {string} id - The id of the select component.
   * @param {string} value - The selected value.
   */
  const handleSelectChange = (id: string, value: string) => {
    setFormData(prev => ({ ...prev, [id]: value }));
     if (id === 'role' && value !== 'Other') {
      setOtherDesignation("");
    }
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

    const finalRole = formData.role === 'Other' ? otherDesignation : formData.role;

    if (!finalRole) {
        toast({ title: "Missing required fields", description: `Please fill out the 'Designation' field.`, variant: "destructive" });
        return;
    }


    const requiredFields: (keyof typeof formData)[] = [
        "name", "phone", "idNumber", "email", "password", "jobGroup", "dutyStation"
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
          role: finalRole,
          dutyStation: formData.dutyStation,
          jobGroup: formData.jobGroup,
      };


      await dataProvider.addParticipant(participantData, user.uid);
      
      toast({
          title: "Registration Successful",
          description: `Your participant account has been created.`,
      });

      if (isTestMode) {
          localStorage.setItem('perdiem-pro-test-user-id', user.uid);
      }

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
                  <Label htmlFor="dutyStation">Duty Station <span className="text-destructive">*</span></Label>
                  <PlacesAutocomplete
                    onPlaceSelect={handleDutyStationSelect}
                    initialValue={formData.dutyStation}
                    types={['hospital', 'doctor', 'pharmacy', 'health']}
                    country="ke"
                   />
                </div>
            </div>
            
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="role">Designation <span className="text-destructive">*</span></Label>
                   <Popover open={isDesignationOpen} onOpenChange={setIsDesignationOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={isDesignationOpen}
                        className="w-full justify-between font-normal"
                      >
                        {formData.role
                          ? designations.find((d) => d === formData.role) || formData.role
                          : "Select a designation"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command>
                        <CommandInput placeholder="Search designation..." />
                        <CommandList>
                          <CommandEmpty>No designation found.</CommandEmpty>
                          <CommandGroup>
                            {designations.map((designation) => (
                              <CommandItem
                                key={designation}
                                value={designation}
                                onSelect={(currentValue) => {
                                  handleSelectChange("role", currentValue === formData.role ? "" : designation);
                                  setIsDesignationOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    formData.role === designation ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {designation}
                              </CommandItem>
                            ))}
                             <CommandItem
                                value="Other"
                                onSelect={() => {
                                  handleSelectChange("role", "Other");
                                  setIsDesignationOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    formData.role === "Other" ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                Other
                              </CommandItem>
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {formData.role === 'Other' && (
                    <Input
                      id="otherDesignation"
                      placeholder="Please specify"
                      className="mt-2"
                      value={otherDesignation}
                      onChange={(e) => setOtherDesignation(e.target.value)}
                      required
                    />
                  )}
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
              </div>
            
            <div className="space-y-2">
                <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
                 <Popover open={isEmailOpen} onOpenChange={setIsEmailOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={isEmailOpen}
                        className="w-full justify-between font-normal"
                        id="email"
                      >
                        {formData.email || "Select or type an email"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command>
                         <CommandInput 
                            placeholder="Search or type email..." 
                            value={formData.email}
                            onValueChange={(value) => handleSelectChange('email', value)}
                         />
                        <CommandList>
                          <CommandEmpty>No email found.</CommandEmpty>
                          <CommandGroup>
                            {emailOptions.map((email) => (
                              <CommandItem
                                key={email}
                                value={email}
                                onSelect={(currentValue) => {
                                  handleSelectChange("email", currentValue);
                                  setIsEmailOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    formData.email === email ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {email}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 relative">
                    <Label htmlFor="password">Password <span className="text-destructive">*</span></Label>
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      onChange={handleInputChange}
                    />
                     <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-6 h-7 w-7"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        <span className="sr-only">{showPassword ? 'Hide password' : 'Show password'}</span>
                      </Button>
                </div>
                <div className="space-y-2 relative">
                    <Label htmlFor="confirmPassword">Confirm Password <span className="text-destructive">*</span></Label>
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      onChange={handleInputChange}
                    />
                     <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-6 h-7 w-7"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        <span className="sr-only">{showConfirmPassword ? 'Hide password' : 'Show password'}</span>
                      </Button>
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
    

    

