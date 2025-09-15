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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addEmployee, EmployeeData } from "@/lib/firebase/firestore";
import { useToast } from "@/hooks/use-toast";


/**
 * The main component for the registration wizard.
 * It manages the state for the current step and handles navigation between steps.
 * @returns {JSX.Element} The rendered registration wizard.
 */
export default function RegistrationWizard() {
  const [step, setStep] = useState(1);
  const [idNumber, setIdNumber] = useState("");
  const [formData, setFormData] = useState<Partial<EmployeeData>>({});
  const router = useRouter();
  const { toast } = useToast();

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
   * Prevents the default form action and redirects the user to the employee dashboard.
   * @param {React.FormEvent} e - The form submission event.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const registrationData = {
        name: `${formData.firstName} ${formData.sirName}`,
        phoneNumber: `+254${formData.phone}`,
        idNumber: formData.idNumber,
        employeeNumber: formData.employeeNumber,
        role: formData.designation,
        dutyStation: formData.dutyStation,
        email: formData.email,
    } as EmployeeData;

    try {
        await addEmployee(registrationData);
        toast({
            title: "Registration Successful",
            description: "Your employee profile has been created.",
        });
        router.push("/dashboard");
    } catch (error) {
        console.error("Registration failed:", error);
        toast({
            title: "Registration Failed",
            description: "Could not create your employee profile. Please try again.",
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

  const emails = [
    "medicaldirector@health.org",
    "chiefnursingofficer@health.org",
    "residentdoctor@health.org",
    "registerednurse@health.org",
    "clinicalofficer@health.org",
    "pharmacist@health.org",
    "laboratorytechnologist@health.org",
    "radiographer@health.org",
    "physiotherapist@health.org",
    "hospitaladministrator@health.org",
  ];

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
                    <Label htmlFor="firstName">First Name</Label>
                    <Input id="firstName" placeholder="e.g., John" required onChange={handleInputChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="middleName">Middle Name</Label>
                    <Input id="middleName" placeholder="e.g., Owuor" onChange={handleInputChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sirName">Surname</Label>
                    <Input id="sirName" placeholder="e.g., Doe" required onChange={handleInputChange} />
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
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="idNumber">ID Number</Label>
                  <Input 
                    id="idNumber" 
                    placeholder="e.g., 12345678" 
                    required 
                    value={idNumber}
                    onChange={(e) => {
                      setIdNumber(e.target.value);
                      handleInputChange(e);
                    }}
                    maxLength={8}
                  />
                </div>
              </div>
            )}
            {/* Step 2: Employment Details */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="employeeNumber">Employee Number</Label>
                  <Input id="employeeNumber" placeholder="e.g., EMP123" required onChange={handleInputChange} />
                </div>
                 <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                   <Select required onValueChange={(value) => handleSelectChange('email', value)}>
                    <SelectTrigger id="email">
                      <SelectValue placeholder="Select an email" />
                    </SelectTrigger>
                    <SelectContent>
                      {emails.map((email) => (
                        <SelectItem key={email} value={email}>
                          {email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="designation">Designation</Label>
                   <Select required onValueChange={(value) => handleSelectChange('designation', value)}>
                    <SelectTrigger id="designation">
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
                  <Label htmlFor="dutyStation">Duty Station</Label>
                  <Input id="dutyStation" placeholder="e.g., Nairobi" required onChange={handleInputChange} />
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
