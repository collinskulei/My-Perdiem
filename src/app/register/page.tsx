/**
 * @file This file defines the new user registration page.
 * It features a dynamic form that adapts based on whether the user is registering as an Employee or an Admin.
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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
import { addEmployee, EmployeeData } from "@/lib/firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import app from "@/lib/firebase/config";

const auth = getAuth(app);


/**
 * The main component for the registration wizard.
 * It manages the state for the current step and handles navigation between steps.
 * @returns {JSX.Element} The rendered registration wizard.
 */
export default function RegistrationWizard() {
  const [role, setRole] = useState("employee");
  const [formData, setFormData] = useState<Partial<EmployeeData & { password?: string, confirmPassword?: string, organizationName?: string }>>({});
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

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Passwords do not match",
        description: "Please ensure your passwords match.",
        variant: "destructive",
      });
      return;
    }
    
    if ((formData.password?.length ?? 0) < 6) {
      toast({
        title: "Weak Password",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.email || !formData.password) {
        toast({
            title: "Missing required fields",
            description: "Please fill out all fields.",
            variant: "destructive",
        });
        return;
    }
    
    try {
      // 1. Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;

      // 2. Save additional employee details to Firestore
      const commonData = {
          name: `${formData.firstName} ${formData.sirName}`,
          phoneNumber: `+254${formData.phone}`,
          idNumber: formData.idNumber,
          email: user.email!, // Use email from the created user
          gender: formData.gender,
      };

      let registrationData: any;

      if (role === 'employee') {
        registrationData = {
          ...commonData,
          role: formData.designation,
          employeeNumber: formData.employeeNumber,
          dutyStation: formData.dutyStation,
          jobGroup: formData.jobGroup,
        };
      } else { // Admin role
        registrationData = {
          ...commonData,
          role: 'Admin',
          organizationName: formData.organizationName,
        };
      }

      await addEmployee(registrationData, user.uid);
      
      toast({
          title: "Registration Successful",
          description: `Your ${role} account has been created.`,
      });

      if (role === 'employee') {
        router.push("/dashboard");
      } else {
        router.push("/admin");
      }


    } catch (error: any) {
        console.error("Registration failed:", error);
        toast({
            title: "Registration Failed",
            description: error.message || `Could not create your ${role} account. Please try again.`,
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
    "admin@example.com",
  ];
  
  const jobGroups = ["A", "B1", "B2", "B3", "B4", "B5", "C1", "C2", "C3", "C4", "C5", "D1", "D2", "D3", "D4", "D5", "E1", "E2", "E4", "H", "J", "K", "L", "M", "N", "P", "Q", "R", "S"];

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="mb-4 flex justify-center">
            <Logo />
          </div>
          <CardTitle className="text-2xl">Create an Account</CardTitle>
          <CardDescription>
            Fill out the form below to register.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            <div className="space-y-2">
                <Label>Register as:</Label>
                <RadioGroup defaultValue="employee" onValueChange={setRole} className="flex gap-4">
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="employee" id="role-employee" />
                        <Label htmlFor="role-employee">Employee</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="admin" id="role-admin" />
                        <Label htmlFor="role-admin">Admin</Label>
                    </div>
                </RadioGroup>
            </div>
            
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="gender">Gender</Label>
                    <Select required onValueChange={(value) => handleSelectChange('gender', value)}>
                        <SelectTrigger id="gender">
                        <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                        </SelectContent>
                    </Select>
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="idNumber">ID Number</Label>
              <Input 
                id="idNumber" 
                placeholder="e.g., 12345678" 
                required 
                onChange={handleInputChange}
                maxLength={8}
              />
            </div>
            
            {role === 'employee' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="employeeNumber">Employee Number</Label>
                  <Input id="employeeNumber" placeholder="e.g., EMP123" required onChange={handleInputChange} />
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
                  <Label htmlFor="jobGroup">Job Group</Label>
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
                <div className="space-y-2">
                  <Label htmlFor="dutyStation">Duty Station</Label>
                  <Input id="dutyStation" placeholder="e.g., Nairobi" required onChange={handleInputChange} />
                </div>
              </div>
            )}
            
            {role === 'admin' && (
                <div className="space-y-2">
                    <Label htmlFor="organizationName">Organization Name</Label>
                    <Input id="organizationName" placeholder="e.g., Health Org Inc." required onChange={handleInputChange} />
                </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" required onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input id="confirmPassword" type="password" required onChange={handleInputChange} />
                </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="ghost" asChild>
                <Link href="/">Cancel</Link>
            </Button>
            <Button type="submit">
              Submit Registration
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
