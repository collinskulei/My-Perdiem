
/**
 * @file This file defines the multi-step wizard for requesting a per diem.
 * It guides the user through Event Information, Transport, Accommodation, Allowances, and a final Preview.
 */
"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { useForm, FormProvider, useFormContext, Controller } from "react-hook-form";
import { fileTypeFromBuffer } from "file-type";

import type { Participant, AppEvent, PerdiemRequest, Venue } from "@/lib/data";
import { dutyStationCoordinates, OUT_OF_OFFICE_RATES } from "@/lib/data";
import * as supabaseDb from '@/lib/supabase/database';
import * as mock from '@/lib/mock-data';
import { isTestMode } from '@/lib/test-mode';
import { supabase } from "@/lib/supabase/client";
import { extractTicketCost } from "@/ai/flows/extract-ticket-cost-flow";
import { useToast } from "@/hooks/use-toast";
import { getHaversineDistance, formatCurrency, cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, ArrowLeft, ArrowRight, Info, Upload, File as FileIcon, X } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";


const dataProvider = isTestMode() ? mock : supabaseDb;
const TEST_USER_ID_KEY = 'perdiem-pro-test-user-id';

// Constants for calculations
const MILEAGE_RATE_KSH = 45;

type MockUser = { id: string };
type PerDiemFormValues = Partial<PerdiemRequest> & {
    airTicketFile: FileList | null;
    boardingPassFile: FileList | null;
    groundTransferFile: FileList | null;
    transportMode: 'vehicle' | 'flight';
};


const steps = [
    { id: '01', name: 'Event & Transport', fields: [] },
    { id: '02', name: 'Accommodation & Allowances', fields: [] },
    { id: '03', name: 'Preview & Submit', fields: [] }
];

function PerDiemWizard() {
    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [authUser, setAuthUser] = useState<User | MockUser | null>(null);
    const [participant, setParticipant] = useState<Participant | null>(null);
    const [event, setEvent] = useState<AppEvent | null>(null);
    const [venue, setVenue] = useState<Venue | null>(null);
    
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const eventId = params.eventId as string;

    const methods = useForm<PerDiemFormValues>({
        defaultValues: {
            transportMode: 'vehicle',
            mileageKm: 0,
            mileageTotal: 0,
            airTicketCost: 0,
            groundTransferCost: 0,
        }
    });
    const { handleSubmit, trigger } = methods;

    // --- DATA FETCHING ---
    useEffect(() => {
        if (isTestMode()) {
            const testUserId = localStorage.getItem(TEST_USER_ID_KEY);
            if (testUserId) setAuthUser({ id: testUserId });
            else router.push('/');
        } else {
            const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
                if (session?.user) setAuthUser(session.user);
                else router.push('/');
            });
            return () => subscription.unsubscribe();
        }
    }, [router]);

    useEffect(() => {
        if (!authUser || !eventId) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const [participantData, eventData] = await Promise.all([
                    dataProvider.getParticipantById(authUser.id),
                    dataProvider.getEventById(eventId),
                ]);

                if (!participantData || !eventData) {
                    toast({ title: "Error", description: "Could not load required data.", variant: "destructive" });
                    router.push('/dashboard');
                    return;
                }
                
                const venueData = await dataProvider.getVenueById(eventData.venueId);

                setParticipant(participantData);
                setEvent(eventData);
                setVenue(venueData);

            } catch (error) {
                console.error("Error fetching data for wizard:", error);
                toast({ title: "Error", description: "Failed to load data.", variant: "destructive" });
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [authUser, eventId, router, toast]);

    // --- WIZARD NAVIGATION ---
    const nextStep = async () => {
        const fields = steps[currentStep].fields;
        const output = await trigger(fields as any, { shouldFocus: true });
        if (!output) return;

        if (currentStep < steps.length - 1) {
            setCurrentStep(step => step + 1);
        }
    };

    const prevStep = () => {
        if (currentStep > 0) {
            setCurrentStep(step => step - 1);
        }
    };

    // --- FORM SUBMISSION ---
    const processSubmit = async (data: PerDiemFormValues) => {
        if (!authUser || !participant || !event) return;
        
        setIsSubmitting(true);
        try {
            const requestData = {
                participantId: authUser.id,
                participantName: participant.name,
                eventId: event.id,
                eventName: event.name,
                location: event.venueCity,
                date: new Date().toISOString().split('T')[0],
                status: 'Pending' as const,
                mileageKm: data.transportMode === 'vehicle' ? data.mileageKm : 0,
                mileageTotal: data.transportMode === 'vehicle' ? data.mileageTotal : 0,
                airTicketCost: data.transportMode === 'flight' ? data.airTicketCost : 0,
                groundTransferCost: data.groundTransferCost || 0,
                accommodationNights: data.accommodationNights || 0,
                accommodationTotal: data.accommodationTotal || 0,
                outOfOfficeAllowance: data.outOfOfficeAllowance || 0,
                totalPerdiem: data.totalPerdiem || 0,
                boardingPassFilename: data.boardingPassFile?.[0]?.name || null,
                airTicketFilename: data.airTicketFile?.[0]?.name || null,
                groundTransferFilename: data.groundTransferFile?.[0]?.name || null,
            };

            await dataProvider.addPerDiemRequest(requestData);
            
            toast({ title: "Success", description: "Your per diem request has been submitted." });
            router.push('/dashboard');

        } catch (error) {
            console.error("Failed to submit per diem request:", error);
            toast({ title: "Submission Failed", description: "Could not submit your request.", variant: "destructive" });
            setIsSubmitting(false);
        }
    };

    if (loading || !event || !participant || !venue) {
        return (
          <div className="flex items-center justify-center h-screen">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="ml-4">Loading request details...</p>
          </div>
        );
    }
    
    return (
        <div className="flex flex-col items-center justify-start p-4 sm:p-6 min-h-screen bg-gray-50 dark:bg-background">
             <Card className="w-full max-w-4xl">
                 <CardHeader>
                     <CardTitle>Request Per Diem</CardTitle>
                     <CardDescription>Complete the steps below to submit your claim for the {event.name} event.</CardDescription>
                     <Progress value={(currentStep + 1) / steps.length * 100} className="w-full mt-4" />
                 </CardHeader>
                <FormProvider {...methods}>
                    <form>
                        <CardContent>
                            {currentStep === 0 && <Step1 event={event} participant={participant} venue={venue} />}
                            {currentStep === 1 && <Step2 event={event} participant={participant} />}
                            {currentStep === 2 && <Step3 />}
                        </CardContent>
                        <CardFooter className="flex justify-between border-t pt-6">
                            <Button type="button" variant="ghost" onClick={prevStep} disabled={currentStep === 0 || isSubmitting}>
                                <ArrowLeft className="mr-2" /> Previous
                            </Button>
                             {currentStep < steps.length - 1 ? (
                                <Button type="button" onClick={nextStep}>
                                    Next <ArrowRight className="ml-2" />
                                </Button>
                            ) : (
                                <Button type="button" disabled={isSubmitting} onClick={handleSubmit(processSubmit)}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Submit Request
                                </Button>
                            )}
                        </CardFooter>
                    </form>
                </FormProvider>
            </Card>
             <footer className="py-4 text-center text-xs text-muted-foreground">
                Myperdiem provided by <Link href="https://www.tuque.africa" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">Tuque Consulting</Link>
            </footer>
        </div>
    );
}

export default function RequestPerDiemPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <PerDiemWizard />
        </Suspense>
    );
}


// --- WIZARD STEPS ---

const Step1 = ({ event, participant, venue }: { event: AppEvent, participant: Participant, venue: Venue }) => {
    const { register, setValue, watch, control } = useFormContext<PerDiemFormValues>();
    const [isExtractingCost, setIsExtractingCost] = useState(false);
    const { toast } = useToast();
    
    const transportMode = watch('transportMode');

    const mileage = useMemo(() => {
        if (!participant.dutyStation || !dutyStationCoordinates[participant.dutyStation] || !venue) {
            return { distance: 0, total: 0 };
        }
        const { latitude: lat1, longitude: lon1 } = dutyStationCoordinates[participant.dutyStation];
        const { latitude: lat2, longitude: lon2 } = venue;
        const distance = getHaversineDistance(lat1, lon1, lat2, lon2) * 2; // Return trip
        return { distance: Math.round(distance), total: Math.round(distance * MILEAGE_RATE_KSH) };
    }, [participant.dutyStation, venue]);
    
    // Set initial values for this step
    useEffect(() => {
        if (transportMode === 'vehicle') {
            setValue('mileageKm', mileage.distance);
            setValue('mileageTotal', mileage.total);
            setValue('airTicketCost', 0);
        } else {
            setValue('mileageKm', 0);
            setValue('mileageTotal', 0);
        }
    }, [mileage, setValue, transportMode]);

    const handleTicketUpload = async (file: File) => {
        if (!file) return;

        if (isTestMode()) {
            toast({
                title: "Test Mode",
                description: "AI cost extraction is disabled in Test Mode. Please enter the cost manually.",
            });
            return;
        }

        setIsExtractingCost(true);
        const reader = new FileReader();
        reader.readAsDataURL(file);

        reader.onload = async () => {
            try {
                const ticketImage = reader.result as string;
                
                // Client-side file type check before calling the function
                const buffer = Buffer.from(ticketImage.split(',')[1], 'base64');
                const type = await fileTypeFromBuffer(buffer);

                if (type?.mime === 'application/pdf') {
                    toast({
                        title: "PDF Not Supported",
                        description: "PDF files are not supported for automatic cost extraction. Please upload an image (PNG, JPG).",
                        variant: "destructive",
                    });
                    setValue('airTicketFile', null);
                    setIsExtractingCost(false);
                    return;
                }

                toast({ title: "Analyzing Ticket...", description: "Please wait while we extract the cost from your ticket. This may take a moment." });

                // Call the AI extraction flow directly (Next.js Server Action)
                const data = await extractTicketCost({ ticketImage });

                if (data && data.cost > 0) {
                    setValue('airTicketCost', data.cost, { shouldValidate: true });
                    toast({ title: "Success", description: `We extracted a cost of ${formatCurrency(data.cost)}.` });
                } else {
                     throw new Error("Could not determine the cost from the ticket.");
                }

            } catch (error: any) {
                console.error("Error calling extractTicketCost function:", error);
                const errorMessage = error.message || "Could not automatically read the cost. Please enter it manually.";
                toast({
                    title: "Extraction Failed",
                    description: errorMessage,
                    variant: "destructive",
                });
            } finally {
                setIsExtractingCost(false);
            }
        };

        reader.onerror = () => {
             toast({
                title: "File Read Error",
                description: "Could not read the uploaded file. Please try again.",
                variant: "destructive",
            });
            setIsExtractingCost(false);
        };
    };


    return (
        <div className="space-y-8">
            <div>
                <h3 className="text-lg font-medium">Event Information</h3>
                <Separator className="my-2" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <p><strong>Event:</strong> {event.name}</p>
                    <p><strong>Venue:</strong> {event.venueName}, {event.venueCity}</p>
                    <p><strong>Dates:</strong> {(event.eventDates || []).join(', ')}</p>
                    <p><strong>Facilitator:</strong> {event.facilitator}</p>
                </div>
            </div>
            <div>
                <h3 className="text-lg font-medium">Transport Information</h3>
                <Separator className="my-2" />
                <div className="space-y-6">
                    <Controller
                        control={control}
                        name="transportMode"
                        render={({ field: { onChange, value } }) => (
                            <RadioGroup
                                value={value}
                                onValueChange={onChange}
                                className="grid grid-cols-1 md:grid-cols-2 gap-4"
                            >
                                <Label htmlFor="transport-vehicle" className="flex flex-col items-start gap-3 rounded-lg border p-4 cursor-pointer hover:bg-accent hover:text-accent-foreground has-[:checked]:bg-primary has-[:checked]:text-primary-foreground has-[:checked]:border-primary">
                                    <div className="flex items-center gap-3">
                                        <RadioGroupItem value="vehicle" id="transport-vehicle" />
                                        <span className="font-semibold">Personal Vehicle</span>
                                    </div>
                                    <p className="text-sm opacity-80 pl-8">Claim mileage for using your own car.</p>
                                </Label>
                                <Label htmlFor="transport-flight" className="flex flex-col items-start gap-3 rounded-lg border p-4 cursor-pointer hover:bg-accent hover:text-accent-foreground has-[:checked]:bg-primary has-[:checked]:text-primary-foreground has-[:checked]:border-primary">
                                    <div className="flex items-center gap-3">
                                        <RadioGroupItem value="flight" id="transport-flight" />
                                        <span className="font-semibold">Air Travel / Other</span>
                                    </div>
                                     <p className="text-sm opacity-80 pl-8">Claim costs for flights, public transport, etc.</p>
                                </Label>
                            </RadioGroup>
                        )}
                    />
                    
                    {transportMode === 'vehicle' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end p-4 border rounded-lg">
                            <div className="space-y-2">
                                <Label htmlFor="mileageKm">Mileage (Return Trip)</Label>
                                <Input id="mileageKm" type="number" readOnly {...register('mileageKm')} />
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between items-baseline">
                                    <Label>Mileage Total</Label>
                                    <span className="text-xs text-muted-foreground">
                                        Rate: Ksh {MILEAGE_RATE_KSH}/km
                                    </span>
                                </div>
                                <Input readOnly value={formatCurrency(mileage.total)} />
                            </div>
                        </div>
                    )}
                    
                    {transportMode === 'flight' && (
                         <div className="space-y-4 p-4 border rounded-lg">
                            <FileUpload name="airTicketFile" label="Air Ticket (PNG, JPG only)" onFileSelect={handleTicketUpload} />
                            <div className="relative space-y-2">
                                <Label htmlFor="airTicketCost">Air Ticket Cost (Ksh)</Label>
                                <Input 
                                    id="airTicketCost" 
                                    type="number" 
                                    placeholder="0" 
                                    {...register('airTicketCost', { valueAsNumber: true })}
                                    disabled={isExtractingCost}
                                />
                                {isExtractingCost && <Loader2 className="absolute right-2 top-8 h-5 w-5 animate-spin text-muted-foreground" />}
                            </div>
                            <FileUpload name="boardingPassFile" label="Boarding Pass (PDF, PNG, JPG)" />
                         </div>
                    )}

                    <div className="space-y-4">
                        <h4 className="font-medium text-base">Other Transport Costs</h4>
                        <Separator />
                        <FileUpload name="groundTransferFile" label="Ground Transfer Receipts (Taxi, etc.)" />
                        <div className="space-y-2">
                            <Label htmlFor="groundTransferCost">Ground Transfer Cost (Ksh)</Label>
                            <Input 
                                id="groundTransferCost" 
                                type="number" 
                                placeholder="0" 
                                {...register('groundTransferCost', { valueAsNumber: true })}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const Step2 = ({ event, participant }: { event: AppEvent, participant: Participant }) => {
    const { register, setValue } = useFormContext<PerDiemFormValues>();

    const accommodation = useMemo(() => {
        const nights = (event.eventDates || []).length > 0 ? (event.eventDates || []).length : 0;
        
        let dailyRate = 0;
        if (participant.jobGroup) {
            // Prefer event-specific rate, fall back to global rate
            if (event.jobGroupAllowances && typeof event.jobGroupAllowances[participant.jobGroup] === 'number') {
                dailyRate = event.jobGroupAllowances[participant.jobGroup]!;
            } else if (OUT_OF_OFFICE_RATES[participant.jobGroup]) {
                dailyRate = OUT_OF_OFFICE_RATES[participant.jobGroup];
            }
        }
        
        return { nights, total: nights * dailyRate, dailyRate };
    }, [event, participant]);


    const outOfOfficeAllowance = useMemo(() => {
        if (!participant.jobGroup || !OUT_OF_OFFICE_RATES[participant.jobGroup]) {
            return 0;
        }
        return OUT_OF_OFFICE_RATES[participant.jobGroup] * accommodation.nights;
    }, [participant.jobGroup, accommodation.nights]);

    useEffect(() => {
        setValue('accommodationNights', accommodation.nights);
        setValue('accommodationTotal', accommodation.total);
        setValue('outOfOfficeAllowance', outOfOfficeAllowance);
    }, [accommodation, outOfOfficeAllowance, setValue]);


    return (
         <div className="space-y-8">
            <div>
                <h3 className="text-lg font-medium">Accommodation Information</h3>
                <Separator className="my-2" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                     <div className="space-y-2">
                        <Label htmlFor="accommodationNights">Nights Spent</Label>
                        <Input id="accommodationNights" type="number" readOnly {...register('accommodationNights')} />
                    </div>
                    <div className="space-y-2">
                         <div className="flex justify-between items-baseline">
                            <Label>Accommodation Total</Label>
                             <span className="text-xs text-muted-foreground">
                                Rate: {formatCurrency(accommodation.dailyRate)}/night
                            </span>
                         </div>
                         <Input readOnly value={formatCurrency(accommodation.total)} />
                    </div>
                </div>
            </div>
             <div>
                <h3 className="text-lg font-medium">Allowances</h3>
                <Separator className="my-2" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                    <div className="space-y-2">
                        <Label>Job Group</Label>
                        <Input readOnly value={participant.jobGroup || 'N/A'} />
                    </div>
                    <div className="space-y-2">
                        <Label>Out of Office Allowance Total</Label>
                        <Input readOnly value={formatCurrency(outOfOfficeAllowance)} />
                    </div>
                </div>
            </div>
        </div>
    );
};

const Step3 = () => {
    const { getValues, watch } = useFormContext<PerDiemFormValues>();
    const values = getValues();
    
    // Watch relevant values to trigger re-calculation
    const watchedValues = watch([
        'transportMode',
        'mileageTotal',
        'airTicketCost',
        'groundTransferCost',
        'accommodationTotal',
        'outOfOfficeAllowance'
    ]);
    
    const airTicketFile = values.airTicketFile?.[0];
    const boardingPassFile = values.boardingPassFile?.[0];
    const groundTransferFile = values.groundTransferFile?.[0];

    const totalPerdiem = useMemo(() => {
        const transportTotal = values.transportMode === 'vehicle' 
            ? (values.mileageTotal || 0)
            : (values.airTicketCost || 0);

        return transportTotal + 
               (values.groundTransferCost || 0) +
               (values.accommodationTotal || 0) + 
               (values.outOfOfficeAllowance || 0);
    }, [values, watchedValues]);

    // Set final total
     const { setValue } = useFormContext<PerDiemFormValues>();
    useEffect(() => {
        setValue('totalPerdiem', totalPerdiem);
    }, [totalPerdiem, setValue]);

    return (
        <div className="space-y-8">
            <div>
                <h3 className="text-lg font-medium">Preview Your Request</h3>
                <p className="text-sm text-muted-foreground">Please review all information before submitting.</p>
                <Separator className="my-4" />
            </div>

            <div className="space-y-6">
                <SummarySection title="Transport Costs">
                    <SummaryItem label="Mode of Transport" value={values.transportMode === 'vehicle' ? "Personal Vehicle" : "Air Travel / Other"} />
                    {values.transportMode === 'vehicle' ? (
                       <SummaryItem label="Mileage Claim" value={formatCurrency(values.mileageTotal || 0)} />
                    ) : (
                       <SummaryItem label="Air Ticket Cost" value={formatCurrency(values.airTicketCost || 0)} />
                    )}
                    <SummaryItem label="Ground Transfer Cost" value={formatCurrency(values.groundTransferCost || 0)} />
                    <Separator className="my-2" />
                    <h4 className="font-medium text-sm pt-2">Attached Files</h4>
                    <SummaryItem label="Air Ticket File" value={airTicketFile ? airTicketFile.name : "Not provided"} />
                    <SummaryItem label="Boarding Pass File" value={boardingPassFile ? boardingPassFile.name : "Not provided"} />
                    <SummaryItem label="Ground Transfer File" value={groundTransferFile ? groundTransferFile.name : "Not provided"} />
                </SummarySection>

                <SummarySection title="Accommodation & Allowances">
                    <SummaryItem label={`Accommodation (${values.accommodationNights} nights)`} value={formatCurrency(values.accommodationTotal || 0)} />
                    <SummaryItem label="Out of Office Allowance" value={formatCurrency(values.outOfOfficeAllowance || 0)} />
                </SummarySection>

                 <Separator />

                <div className="flex justify-between items-center text-lg sm:text-xl font-bold">
                    <span>Total Per Diem Request</span>
                    <span>{formatCurrency(totalPerdiem)}</span>
                </div>
            </div>
        </div>
    );
};

// --- HELPER COMPONENTS ---

const FileUpload = ({ name, label, onFileSelect }: { name: "airTicketFile" | "groundTransferFile" | "boardingPassFile", label: string, onFileSelect?: (file: File) => void }) => {
    const { register, watch, setValue } = useFormContext<PerDiemFormValues>();
    const files = watch(name);
    const file = files?.[0];

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        // Manually set value for react-hook-form to register the change
        setValue(name, e.target.files);
        
        if (selectedFile && onFileSelect) {
            onFileSelect(selectedFile);
        }
    };


    return (
        <div className="space-y-2">
            <Label htmlFor={name}>{label}</Label>
            {!file ? (
                 <Label htmlFor={name} className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 dark:bg-muted/20 dark:hover:bg-muted/40">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-8 h-8 mb-2 text-gray-500" />
                        <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                    </div>
                    <Input id={name} type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.png,.jpg,.jpeg" />
                </Label>
            ) : (
                <div className="flex items-center justify-between p-3 border rounded-lg bg-gray-50 dark:bg-muted/20">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <FileIcon className="h-6 w-6 text-gray-600 flex-shrink-0"/>
                        <span className="text-sm font-medium truncate">{file.name}</span>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => setValue(name, null)}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            )}
        </div>
    );
};

const SummarySection = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <div className="space-y-2">
        <h4 className="font-semibold">{title}</h4>
        <div className="p-4 border rounded-lg space-y-2 bg-muted/50">{children}</div>
    </div>
);

const SummaryItem = ({ label, value }: { label: string, value: string | number }) => (
    <div className="flex flex-col sm:flex-row justify-between text-sm">
        <p className="text-muted-foreground">{label}</p>
        <p className="font-medium text-left sm:text-right">{value}</p>
    </div>
);
