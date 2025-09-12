
"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  MapPin,
  Loader2,
  LocateFixed,
  Check,
  ChevronsUpDown,
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useGeolocation } from "@/lib/hooks/use-geolocation";
import { cn } from "@/lib/utils";
import { venues as initialVenues } from "@/lib/data";
import type { Venue } from "@/lib/data";

const MILEAGE_RATE_KSH = 45;
const DAILY_ALLOWANCE = 5000;

const requestSchema = z.object({
  eventName: z.string().min(3, "Activity name is required"),
  activityCode: z.string().min(1, "Activity code is required"),
  venueId: z.string({ required_error: "Please select a venue." }),
  facilitator: z.string().min(3, "Facilitator name is required"),
  date: z.date({ required_error: "Activity date is required" }),
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
  if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) return Infinity;
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
  const [distance, setDistance] = useState<number | null>(null);
  const { toast } = useToast();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [isTestMode, setIsTestMode] = useState(false);
  
  const form = useForm<RequestFormValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      eventName: "Annual Tech Conference",
      activityCode: "ATC2024",
      facilitator: "Jane Doe",
      mileage: 0,
      airTicketCosts: 0,
      groundTransfers: "",
      date: new Date(),
    },
  });

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = form;

  const fetchVenues = useCallback(() => {
    // For testing, we use the local data.
    setVenues(initialVenues);
    if (initialVenues.length > 0 && !getValues("venueId")) {
      setValue("venueId", initialVenues[0].id);
    }
  }, [setValue, getValues]);


  const geoOptions = useMemo(() => ({
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0,
  }), []);

  const { latitude, longitude, error: geoError, getPosition, loading: geoLoading } = useGeolocation(geoOptions);

  useEffect(() => {
    fetchVenues();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchVenues();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchVenues]);

  const watchedValues = watch();

  const selectedVenue = useMemo(() => {
    return venues.find(h => h.id === watchedValues.venueId);
  }, [watchedValues.venueId, venues]);

  const totalPerdiem = useMemo(() => {
    const mileageCost = (watchedValues.mileage || 0) * MILEAGE_RATE_KSH;
    const airCost = watchedValues.airTicketCosts || 0;
    return mileageCost + airCost + DAILY_ALLOWANCE;
  }, [watchedValues]);

  const canCheckIn = useMemo(() => isTestMode || (distance !== null && distance <= 1), [isTestMode, distance]);
  
  const updateDistance = useCallback(() => {
      if (latitude && longitude && selectedVenue) {
        const dist = getDistance(
          latitude,
          longitude,
          selectedVenue.latitude,
          selectedVenue.longitude
        );
        setDistance(dist);
      }
  }, [latitude, longitude, selectedVenue]);
  
  useEffect(() => {
    getPosition();
  }, [getPosition]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (!isTestMode) {
        getPosition();
      }
    }, 5000); 
    return () => clearInterval(intervalId);
  }, [getPosition, isTestMode]);


  useEffect(() => {
    if (!isTestMode) {
      updateDistance();
    }
  }, [latitude, longitude, selectedVenue, updateDistance, isTestMode]);


  const handleNext = async () => {
    const isValid = await form.trigger(["eventName", "activityCode", "venueId", "facilitator", "date"]);
    if (isValid) setStep(2);
  };
  const handleBack = () => setStep(1);
  
  const onSubmit = () => {
    setIsSubmitting(true);
    if (!selectedVenue) {
        toast({
            title: "Error",
            description: "No venue selected.",
            variant: "destructive"
        });
        setIsSubmitting(false);
        return;
    }
    const submittedData = {
        ...getValues(),
        location: selectedVenue.city,
        checkInTimestamp: Date.now(),
    };
    
    console.log("Submitting with timestamp:", submittedData);

    const description = isTestMode 
      ? "Test Mode: Check-in successful. Submitting request..."
      : `You are ${distance?.toFixed(2)} km from the event. Submitting request...`

    toast({
        title: "Check-in Successful!",
        description: description,
    });
    setTimeout(() => {
        toast({
            title: "Request Submitted!",
            description: "Your perdiem request has been submitted for approval.",
        });
        setIsSubmitting(false);
    }, 2000);
  };

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
              <div className="space-y-2">
                <Label htmlFor="eventName">Activity Name</Label>
                <Controller
                  name="eventName"
                  control={control}
                  render={({ field }) => <Input id="eventName" {...field} />}
                />
                {errors.eventName && <p className="text-sm text-destructive">{errors.eventName.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="activityCode">Activity Code</Label>
                <Controller
                  name="activityCode"
                  control={control}
                  render={({ field }) => <Input id="activityCode" {...field} />}
                />
                {errors.activityCode && <p className="text-sm text-destructive">{errors.activityCode.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="venue">Activity Venue</Label>
                <Controller
                  name="venueId"
                  control={control}
                  render={({ field }) => (
                    <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={isPopoverOpen}
                          className={cn(
                            "w-full justify-between",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value
                            ? venues.find(
                                (venue) => venue.id === field.value
                              )?.name
                            : "Select venue"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <Command>
                          <CommandInput placeholder="Search venue..." />
                          <CommandList>
                            <CommandEmpty>No venue found.</CommandEmpty>
                            <CommandGroup>
                              {venues.map((venue) => (
                                <CommandItem
                                  value={venue.name}
                                  key={venue.id}
                                  onSelect={() => {
                                    setValue("venueId", venue.id);
                                    setIsPopoverOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      venue.id === field.value
                                        ? "opacity-100"
                                        : "opacity-0"
                                    )}
                                  />
                                  {venue.name}, {venue.city}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  )}
                />
                {errors.venueId && <p className="text-sm text-destructive">{errors.venueId.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Activity Date</Label>
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
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="facilitator">Activity Facilitator</Label>
                <Controller
                  name="facilitator"
                  control={control}
                  render={({ field }) => <Input id="facilitator" {...field} />}
                />
                {errors.facilitator && <p className="text-sm text-destructive">{errors.facilitator.message}</p>}
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
                  render={({ field }) => <Input id="groundTransfers" placeholder="e.g., Taxi from airport to hotel" {...field} />}
                />
              </div>

               <div className="md:col-span-2 space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch id="test-mode" checked={isTestMode} onCheckedChange={setIsTestMode} />
                  <Label htmlFor="test-mode">Enable Test Mode (Dev only)</Label>
                </div>
                 <Card className={cn("transition-colors", canCheckIn ? "border-green-500" : "border-amber-500")}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-lg">Location Check</CardTitle>
                        {geoLoading && !isTestMode ? (
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        ) : (
                            <LocateFixed className={cn("h-5 w-5", canCheckIn ? "text-green-500" : "text-amber-500")} />
                        )}
                    </CardHeader>
                    <CardContent>
                        {isTestMode ? (
                           <p className="text-lg font-semibold text-green-500">Test Mode is ON. Location check is bypassed.</p>
                        ) : geoError ? (
                            <p className="text-sm text-destructive">{geoError.message}</p>
                        ) : distance !== null ? (
                             <p className="text-lg font-semibold">
                                You are <span className={cn(canCheckIn ? "text-green-500" : "text-amber-500")}>{distance.toFixed(2)} km</span> away from {selectedVenue?.name}.
                            </p>
                        ) : (
                            <p className="text-muted-foreground">Acquiring your location...</p>
                        )}
                    </CardContent>
                    <CardFooter className="text-sm text-muted-foreground">
                      {isTestMode ? "You can now check-in from anywhere." : "You must be within 1 km to check-in and submit your request."}
                    </CardFooter>
                </Card>
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
            <Button type="submit" disabled={isSubmitting || !canCheckIn} className={cn(!canCheckIn && "opacity-50")}>
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

    
