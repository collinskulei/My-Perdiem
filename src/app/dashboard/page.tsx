/**
 * @file This file defines the main dashboard page for an authenticated employee.
 * It displays a welcome message, a list of upcoming events, and a table of the user's recent per diem requests.
 */
"use client";

import { useState, useEffect } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { isToday, parseISO, isWithinInterval, format, isFuture, startOfDay } from "date-fns";
import { useRouter } from "next/navigation";


import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { PerdiemRequest, Employee, AppEvent, Venue } from "@/lib/data";
import * as firestore from '@/lib/firebase/firestore';
import * as mock from '@/lib/mock-data';
import { isTestMode } from '@/lib/test-mode';
import app from "@/lib/firebase/config";
import { useToast } from "@/hooks/use-toast";
import { SuccessDialog } from "@/components/success-dialog";
import { MapPin, Loader2 } from "lucide-react";
import { cn, getHaversineDistance } from "@/lib/utils";
import { useGeolocation } from "@/lib/hooks/use-geolocation";


const dataProvider = isTestMode() ? mock : firestore;
const auth = getAuth(app);
const TEST_USER_ID_KEY = 'perdiem-pro-test-user-id';

// Mock User shape that is compatible with Firebase User
type MockUser = {
    uid: string;
}

export default function EmployeeDashboard() {
  const [userRequests, setUserRequests] = useState<PerdiemRequest[]>([]);
  const [myEvents, setMyEvents] = useState<AppEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);
  const [authUser, setAuthUser] = useState<User | MockUser | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<string | null>(null); // Tracks eventId-date string
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState({ title: "", description: "" });
  const { toast } = useToast();
  const router = useRouter();
  const { latitude, longitude, error: geoError, getPosition } = useGeolocation();

  useEffect(() => {
    if (isTestMode()) {
        const testUserId = localStorage.getItem(TEST_USER_ID_KEY);
        if (testUserId) {
            setAuthUser({ uid: testUserId });
        } else {
            // Handle case where user is not "logged in" in test mode
            setLoading(false);
        }
    } else {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setAuthUser(user);
        });
        return () => unsubscribe();
    }
  }, []);

  const fetchData = async () => {
      if (!authUser) return;

      setLoading(true);
      try {
        const eventsPromise = isTestMode()
            ? dataProvider.getEvents()
            : dataProvider.getEventsByEmployee(authUser.uid);

        const [userData, requests, eventsData] = await Promise.all([
          dataProvider.getEmployeeById(authUser.uid),
          dataProvider.getPerDiemRequestsByEmployee(authUser.uid),
          eventsPromise
        ]);
        
        setCurrentUser(userData);
        setUserRequests(requests);
        setMyEvents(eventsData);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
         toast({ title: "Error", description: "Could not load dashboard data.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    }

  useEffect(() => {
    fetchData();
  }, [authUser, toast]);
  

 const handleCheckIn = (event: AppEvent, date: Date) => {
    if (!authUser) return;
    const dateString = format(date, 'yyyy-MM-dd');
    setIsSubmitting(`${event.id}-${dateString}`);
    
    // In Test Mode, bypass location check and give positive feedback.
    if (isTestMode()) {
      proceedWithCheckIn(event.id, authUser.uid, dateString);
      return;
    }

    // Live mode: perform location check.
    toast({ title: "Verifying Location", description: "Please wait while we check your location..." });
    getPosition(); 
  };
  
  useEffect(() => {
    // This effect runs after getPosition() updates the location state.
    const activeSubmission = isSubmitting;
    if (!activeSubmission || latitude === null || longitude === null) return;
    
    const [eventId, dateString] = activeSubmission.split('-');
    const event = myEvents.find(e => e.id === eventId);
    if (!event) return;

    if (geoError) {
        toast({ title: "Location Error", description: geoError.message, variant: "destructive" });
        setIsSubmitting(null);
        return;
    }
    
    const checkLocationAndProceed = async () => {
        const venue = await dataProvider.getVenueById(event.venueId);
        if (!venue) {
            toast({ title: "Check-in Failed", description: "Could not find event venue details.", variant: "destructive" });
            setIsSubmitting(null);
            return;
        }

        const distance = getHaversineDistance(latitude, longitude, venue.latitude, venue.longitude);
        
        if (distance <= 1000) { // 1000 meters = 1 km
            proceedWithCheckIn(event.id, authUser!.uid, dateString);
        } else {
            toast({
                title: "Check-in Failed",
                description: `You must be within 1km of the venue to check in. You are currently about ${Math.round(distance / 1000)}km away.`,
                variant: "destructive",
            });
            setIsSubmitting(null);
        }
    };
    
    checkLocationAndProceed();

  }, [latitude, longitude, geoError, isSubmitting, myEvents, authUser]);

  const proceedWithCheckIn = async (eventId: string, userId: string, dateString: string) => {
     try {
        await dataProvider.checkInToEvent(eventId, userId, dateString);
        setSuccessMessage({ title: "Check-in Successful!", description: `Your check-in for ${dateString} has been recorded.` });
        setIsSuccess(true);
        // Refresh data
        await fetchData();
    } catch (error) {
        console.error("Error checking in:", error);
        toast({ title: "Check-in Failed", description: "Could not record your check-in.", variant: "destructive" });
    } finally {
        setIsSubmitting(null);
    }
  }


  const handleRequestPerDiem = (event: AppEvent) => {
    router.push(`/request-per-diem/${event.id}`);
  };

  const getFirstName = (name: string | undefined) => {
    if (!name) return "";
    return name.split(" ")[0];
  };
  
  const hasRequestedPerDiem = (eventId: string) => {
    return userRequests.some(req => req.eventId === eventId);
  }

  const handleDone = () => {
    setIsSuccess(false);
  };

  const getEventDays = (event: AppEvent) => {
    return (event.eventDates || []).map(dateStr => parseISO(dateStr));
  }

  const getAttendanceProgress = (event: AppEvent) => {
      const totalDays = getEventDays(event).length;
      if (totalDays === 0) return { percent: 0, color: 'bg-red-500', checkedInDays: 0, totalDays: 0 };

      const checkedInDays = event.checkedInEmployees?.[authUser?.uid ?? ''] 
          ? Object.keys(event.checkedInEmployees[authUser?.uid ?? '']).length
          : 0;
      
      const percent = (checkedInDays / totalDays) * 100;

      let color = 'bg-red-500';
      if (percent > 0 && percent <= 50) {
          color = 'bg-orange-500';
      } else if (percent > 50) {
          color = 'bg-green-500';
      }
      if (percent === 100) {
          color = 'bg-green-600';
      }
      if(checkedInDays === 0) color = 'bg-red-500';

      return { percent, color, checkedInDays, totalDays };
  }

  const hasCheckedInForAllDays = (event: AppEvent): boolean => {
    const { checkedInDays, totalDays } = getAttendanceProgress(event);
    return totalDays > 0 && checkedInDays === totalDays;
  }

  return (
    <>
      <SuccessDialog
        isOpen={isSuccess}
        onClose={handleDone}
        title={successMessage.title}
        description={successMessage.description}
      />
      <div className="grid flex-1 items-start gap-6">
        <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Welcome Back, {getFirstName(currentUser?.name)}! (Employee)</h1>
            <p className="text-muted-foreground">Here's an overview of your events and requests.</p>
        </div>
        
        <Card>
            <CardHeader>
                <CardTitle>My Events</CardTitle>
                <CardDescription>Events you are allocated to. Check-in daily to record your attendance.</CardDescription>
            </CardHeader>
            <CardContent>
             <TooltipProvider>
                <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40%]">Event</TableHead>
                        <TableHead>Venue</TableHead>
                        <TableHead>Dates</TableHead>
                        <TableHead>Attendance</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? ( <TableRow><TableCell colSpan={5} className="h-24 text-center">Loading your events...</TableCell></TableRow>
                        ) : myEvents.length === 0 ? (
                            <TableRow><TableCell colSpan={5} className="h-24 text-center">You have no upcoming events.</TableCell></TableRow>
                        ) : myEvents.map((event) => {
                            const canRequestPerDiem = hasCheckedInForAllDays(event) && !hasRequestedPerDiem(event.id);
                            const eventDays = getEventDays(event);
                            const { percent, color, checkedInDays, totalDays } = getAttendanceProgress(event);

                            return (
                                <TableRow key={event.id}>
                                    <TableCell className="font-medium">{event.name}</TableCell>
                                    <TableCell>{event.venueName}</TableCell>
                                    <TableCell>{(event.eventDates || []).join(', ')}</TableCell>
                                    <TableCell>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div>
                                                    <Progress value={percent} indicatorClassName={color} className="h-3" />
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>Attended {checkedInDays} of {totalDays} days.</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TableCell>
                                    <TableCell className="text-right">
                                       <div className="flex gap-2 justify-end">
                                            {canRequestPerDiem && (
                                                <Button size="sm" onClick={() => handleRequestPerDiem(event)}>
                                                    Request Per Diem
                                                </Button>
                                            )}
                                            {!canRequestPerDiem && hasCheckedInForAllDays(event) && hasRequestedPerDiem(event.id) && (
                                                <Badge variant="secondary">Per Diem Requested</Badge>
                                            )}
                                            {!hasCheckedInForAllDays(event) && eventDays.map(day => {
                                                const dateString = format(day, 'yyyy-MM-dd');
                                                const isCheckedInForDay = !!event.checkedInEmployees?.[authUser?.uid ?? '']?.[dateString];
                                                
                                                // Don't show button if already checked in or if the day is in the past and wasn't checked in
                                                if (isCheckedInForDay || startOfDay(day) < startOfDay(new Date())) {
                                                    return null;
                                                }

                                                const canCheckInForDay = isToday(day);
                                                const isButtonDisabled = !canCheckInForDay || !!isSubmitting;
                                                const buttonText = isFuture(day) 
                                                    ? `Check-in: ${format(day, 'MMM d')}` 
                                                    : `Check-in Today`;

                                                return (
                                                    <Button 
                                                        key={dateString} 
                                                        size="sm" 
                                                        onClick={() => handleCheckIn(event, day)} 
                                                        disabled={isButtonDisabled}
                                                        variant={!canCheckInForDay ? 'outline' : 'default'}
                                                    >
                                                        {isSubmitting === `${event.id}-${dateString}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <MapPin className="mr-2 h-4 w-4" />}
                                                        {buttonText}
                                                    </Button>
                                                );
                                            })}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
              </TooltipProvider>
            </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Per Diem Requests</CardTitle>
            <CardDescription>
              Your submitted per diem requests.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={4} className="h-24 text-center">Loading your requests...</TableCell></TableRow>
                ) : userRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div className="font-medium">{request.eventName}</div>
                      <div className="hidden text-sm text-muted-foreground md:inline">{request.location}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={request.status === "Approved" ? "secondary" : request.status === "Pending" ? "outline" : "destructive"}>{request.status}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{request.date}</TableCell>
                    <TableCell className="text-right">Ksh {request.totalPerdiem.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
