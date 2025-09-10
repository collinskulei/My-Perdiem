"use client";

import { useState, useMemo, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  CheckCircle,
  Lightbulb,
  Loader2,
  MapPin,
} from "lucide-react";
import { format } from "date-fns";

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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useGeolocation } from "@/lib/hooks/use-geolocation";
import { checkDataCompleteness } from "@/ai/flows/data-completeness-checker";
import { cn } from "@/lib/utils";

const MILEAGE_RATE_KSH = 45;
const DAILY_ALLOWANCE = 5000;
const EVENT_LOCATION = { lat: -1.286389, lon: 36.817223 }; // Mock Nairobi CBD location

const requestSchema = z.object({
  eventName: z.string().min(3, "Event name is required"),
  location: z.string().min(3, "Location is required"),
  hotels: z.string().optional(),
  facilitator: z.string().min(3, "Facilitator name is required"),
  date: z.date({ required_error: "Event date is required" }),
  mileage: z.coerce.number().min(0).default(0),
  groundTransfers: z.string().optional(),
  airTicketCosts: z.coerce.number().min(0).default(0),
});

type RequestFormValues = z.infer<typeof requestSchema>;

function getDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

export default function PerdiemRequestWizard() {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [completenessResult, setCompletenessResult] = useState<
    "complete" | "incomplete" | null
  >(null);
  const { toast } = useToast();
  const { latitude, longitude, error: geoError, getPosition } = useGeolocation();

  const form = useForm<RequestFormValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      eventName: "Annual Tech Conference",
      location: "Nairobi, Kenya",
      facilitator: "Jane Doe",
      mileage: 0,
      airTicketCosts: 0,
    },
  });
  const {
    control,
    handleSubmit,
    watch,
    getValues,
    formState: { errors },
  } = form;
  const watchedValues = watch();

  const totalPerdiem = useMemo(() => {
    const mileageCost = (watchedValues.mileage || 0) * MILEAGE_RATE_KSH;
    const airCost = watchedValues.airTicketCosts || 0;
    return mileageCost + airCost + DAILY_ALLOWANCE;
  }, [watchedValues]);

  const handleNext = async () => {
    const isValid = await form.trigger(["eventName", "location", "facilitator", "date"]);
    if (isValid) setStep(2);
  };
  const handleBack = () => setStep(1);

  const handleCompletenessCheck = async () => {
    setIsChecking(true);
    setCompletenessResult(null);
    try {
      const values = getValues();
      const result = await checkDataCompleteness({
        ...values,
        date: values.date ? format(values.date, "yyyy-MM-dd") : "",
      });
      setCompletenessResult(result.completenessStatus);
      toast({
        title: `AI Check: ${
          result.completenessStatus === "complete" ? "Complete" : "Incomplete"
        }`,
        description:
          result.completenessStatus === "complete"
            ? "The provided data seems complete."
            : "The AI suggests some relevant information might be missing.",
        variant:
          result.completenessStatus === "complete" ? "default" : "destructive",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to run AI completeness check.",
        variant: "destructive",
      });
    } finally {
      setIsChecking(false);
    }
  };
  
  const onSubmit = () => {
    setIsSubmitting(true);
    getPosition();
  };

  useEffect(() => {
    if (isSubmitting && (latitude || geoError)) {
        if(geoError) {
             toast({
                title: "Location Error",
                description: geoError.message,
                variant: "destructive",
            });
            setIsSubmitting(false);
            return;
        }

        if(latitude && longitude) {
            const distance = getDistance(latitude, longitude, EVENT_LOCATION.lat, EVENT_LOCATION.lon);
            
            if (distance <= 1) {
                toast({
                    title: "Check-in Successful!",
                    description: `You are ${distance.toFixed(2)} km from the event. Submitting request...`,
                });
                // Simulate submission
                setTimeout(() => {
                    toast({
                        title: "Request Submitted!",
                        description: "Your perdiem request has been submitted for approval.",
                    });
                    setIsSubmitting(false);
                }, 2000);
            } else {
                 toast({
                    title: "Check-in Failed",
                    description: `You are ${distance.toFixed(2)} km away. You must be within 1 km of the event to submit.`,
                    variant: "destructive",
                });
                setIsSubmitting(false);
            }
        }
    }
  }, [isSubmitting, latitude, longitude, geoError, getPosition, toast]);


  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl">New Perdiem Request</CardTitle>
        <CardDescription>
          Step {step} of 2: {step === 1 ? "Activity Information" : "Transport & Costs"}
        </CardDescription>
        <Progress value={(step / 2) * 100} className="mt-2" />
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-6">
          {step === 1 && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="eventName">Event Name</Label>
                <Controller
                  name="eventName"
                  control={control}
                  render={({ field }) => <Input id="eventName" {...field} />}
                />
                {errors.eventName && <p className="text-sm text-destructive">{errors.eventName.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Controller
                  name="location"
                  control={control}
                  render={({ field }) => <Input id="location" {...field} />}
                />
                 {errors.location && <p className="text-sm text-destructive">{errors.location.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Controller
                  name="date"
                  control={control}
                  render={({ field }) => (
                     <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                  )}
                />
                 {errors.date && <p className="text-sm text-destructive">{errors.date.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="facilitator">Facilitator</Label>
                <Controller
                  name="facilitator"
                  control={control}
                  render={({ field }) => <Input id="facilitator" {...field} />}
                />
                {errors.facilitator && <p className="text-sm text-destructive">{errors.facilitator.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="hotels">Available Hotels (Optional)</Label>
                <Controller
                  name="hotels"
                  control={control}
                  render={({ field }) => <Textarea id="hotels" {...field} />}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="mileage">Mileage (km)</Label>
                <Controller
                  name="mileage"
                  control={control}
                  render={({ field }) => <Input id="mileage" type="number" {...field} />}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="airTicketCosts">Air Ticket Costs (Ksh)</Label>
                 <Controller
                  name="airTicketCosts"
                  control={control}
                  render={({ field }) => <Input id="airTicketCosts" type="number" {...field} />}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="groundTransfers">Ground Transfers (Optional)</Label>
                <Controller
                  name="groundTransfers"
                  control={control}
                  render={({ field }) => <Textarea id="groundTransfers" placeholder="e.g., Taxi from airport to hotel" {...field} />}
                />
              </div>
              <div className="md:col-span-2">
                <Card className="bg-muted/50">
                    <CardHeader>
                        <CardTitle className="text-lg">Estimated Per Diem</CardTitle>
                    </CardHeader>
                    <CardContent className="text-4xl font-bold text-primary">
                        Ksh {totalPerdiem.toLocaleString()}
                    </CardContent>
                    <CardFooter className="text-sm text-muted-foreground">
                        Includes daily allowance of Ksh {DAILY_ALLOWANCE.toLocaleString()}.
                    </CardFooter>
                </Card>
              </div>
               <div className="flex items-center space-x-4 rounded-md border p-4 md:col-span-2">
                    <Lightbulb />
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none">
                        AI Data Completeness Check
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Check if you've filled all relevant fields before submitting.
                      </p>
                    </div>
                    <Button type="button" onClick={handleCompletenessCheck} disabled={isChecking}>
                        {isChecking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                        Check
                    </Button>
                </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          {step === 1 ? (
            <div />
          ) : (
            <Button type="button" variant="outline" onClick={handleBack}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          )}
          {step === 1 ? (
            <Button type="button" onClick={handleNext}>
              Next
            </Button>
          ) : (
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <MapPin className="mr-2 h-4 w-4" />
              )}
              Check-in & Submit
            </Button>
          )}
        </CardFooter>
      </form>
    </Card>
  );
}
