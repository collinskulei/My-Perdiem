/**
 * @file This file defines the main dashboard page for an authenticated employee.
 * It displays a welcome message, a list of upcoming events, and a table of the user's recent per diem requests.
 */
"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { isToday, parseISO, format, isFuture, startOfDay } from "date-fns";
import { useRouter, useSearchParams } from "next/navigation";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';


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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip as UITooltip,
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
import { MapPin, Loader2, Check } from "lucide-react";
import { cn, getHaversineDistance, formatCurrency } from "@/lib/utils";
import { useGeolocation } from "@/lib/hooks/use-geolocation";


const dataProvider = isTestMode() ? mock : firestore;
const auth = getAuth(app);
const TEST_USER_ID_KEY = 'perdiem-pro-test-user-id';

// Mock User shape that is compatible with Firebase User
type MockUser = {
    uid: string;
}

const ANALYTICS_COLORS = {
  Pending: '#f97316', // orange-500
  Approved: '#10b981', // emerald-500
  Paid: '#3b82f6', // blue-500
  Rejected: '#ef4444', // red-500
};


function EmployeeDashboard() {
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
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'events';
  const [activeTab, setActiveTab] = useState(initialTab);

  const { latitude, longitude, error: geoError, getPosition } = useGeolocation();

  useEffect(() => {
    if (isTestMode()) {
        const testUserId = localStorage.getItem(TEST_USER_ID_KEY);
        if (testUserId) {
            setAuthUser({ uid: testUserId });
        } else {
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

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) {
      setActiveTab(tab);
    } else {
      setActiveTab('events');
    }
  }, [searchParams]);
  

 const handleCheckIn = (event: AppEvent, date: Date) => {
    if (!authUser) return;
    const dateString = format(date, 'yyyy-MM-dd');
    setIsSubmitting(`${event.id}-${dateString}`);
    
    if (isTestMode()) {
      proceedWithCheckIn(event.id, authUser.uid, dateString);
      return;
    }

    toast({ title: "Verifying Location", description: "Please wait while we check your location..." });
    getPosition(); 
  };
  
  useEffect(() => {
    const activeSubmission = isSubmitting;
    if (!activeSubmission || latitude === null || longitude === null || isTestMode()) return;
    
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
                description: `You are about ${Math.round(distance / 1000)}km away. You must be within 1km of the venue.`,
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

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    router.push(`/dashboard?tab=${value}`, { scroll: false });
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
  
  const requestsByStatus = useMemo(() => userRequests.reduce((acc, req) => {
    acc[req.status] = (acc[req.status] || 0) + 1;
    return acc;
  }, {} as { [key: string]: number }), [userRequests]);

  const pieChartData = useMemo(() => Object.entries(requestsByStatus).map(([name, value]) => ({ name, value })), [requestsByStatus]);

  const totalPaid = useMemo(() => userRequests
    .filter(req => req.status === 'Paid')
    .reduce((sum, req) => sum + req.totalPerdiem, 0), [userRequests]);


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
            <h1 className="text-3xl font-bold tracking-tight">Welcome Back, {getFirstName(currentUser?.name)}!</h1>
            <p className="text-muted-foreground">Here's an overview of your events and requests.</p>
        </div>
        
        <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList>
                <TabsTrigger value="events">My Events</TabsTrigger>
                <TabsTrigger value="checkins">My Check-ins</TabsTrigger>
                <TabsTrigger value="requests">My Per Diem Requests</TabsTrigger>
                <TabsTrigger value="analytics">My Analytics</TabsTrigger>
            </TabsList>
            <TabsContent value="events">
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
                                <TableHead className="w-[30%]">Event</TableHead>
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
                                                <UITooltip>
                                                    <TooltipTrigger asChild>
                                                        <div>
                                                            <Progress value={percent} indicatorClassName={color} className="h-3" />
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>Attended {checkedInDays} of {totalDays} days.</p>
                                                    </TooltipContent>
                                                </UITooltip>
                                            </TableCell>
                                            <TableCell className="text-right">
                                               <div className="flex gap-2 justify-end">
                                                    {canRequestPerDiem && (
                                                        <Button size="sm" onClick={() => handleRequestPerDiem(event)}>
                                                            Request Per Diem
                                                        </Button>
                                                    )}
                                                    {!canRequestPerDiem && hasCheckedInForAllDays(event) && hasRequestedPerDiem(event.id) && (
                                                        <Badge variant="secondary">Requested</Badge>
                                                    )}
                                                    {!hasCheckedInForAllDays(event) && eventDays.map(day => {
                                                        const dateString = format(day, 'yyyy-MM-dd');
                                                        const isCheckedInForDay = !!event.checkedInEmployees?.[authUser?.uid ?? '']?.[dateString];
                                                        
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
            </TabsContent>
            <TabsContent value="checkins">
                <Card>
                    <CardHeader>
                        <CardTitle>My Check-in History</CardTitle>
                        <CardDescription>A record of all your event check-ins.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Event</TableHead>
                                    <TableHead>Date Checked In</TableHead>
                                    <TableHead className="text-center">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={3} className="h-24 text-center">Loading check-in data...</TableCell></TableRow>
                                ) : myEvents.flatMap(event => 
                                    Object.entries(event.checkedInEmployees?.[authUser?.uid ?? ''] || {})
                                      .map(([date, timestamp]) => (
                                        <TableRow key={`${event.id}-${date}`}>
                                            <TableCell>{event.name}</TableCell>
                                            <TableCell>{format(parseISO(date), 'PPP')}</TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="secondary"><Check className="mr-1 h-3 w-3" />Checked-In</Badge>
                                            </TableCell>
                                        </TableRow>
                                ))).length === 0 ? (
                                     <TableRow><TableCell colSpan={3} className="h-24 text-center">You have no check-ins yet.</TableCell></TableRow>
                                ) : (
                                     myEvents.flatMap(event => 
                                        Object.entries(event.checkedInEmployees?.[authUser?.uid ?? ''] || {})
                                            .map(([date, timestamp]) => (
                                                <TableRow key={`${event.id}-${date}`}>
                                                    <TableCell>{event.name}</TableCell>
                                                    <TableCell>{format(parseISO(date), 'PPP')}</TableCell>
                                                    <TableCell className="text-center">
                                                        <Badge variant="secondary"><Check className="mr-1 h-3 w-3" />Checked-In</Badge>
                                                    </TableCell>
                                                </TableRow>
                                        ))
                                     )
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="requests">
                <Card>
                  <CardHeader>
                    <CardTitle>My Per Diem Requests</CardTitle>
                    <CardDescription>
                      A history of all your submitted per diem requests.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Event</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Date Submitted</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loading ? (
                          <TableRow><TableCell colSpan={4} className="h-24 text-center">Loading your requests...</TableCell></TableRow>
                        ) : userRequests.length === 0 ? (
                           <TableRow><TableCell colSpan={4} className="h-24 text-center">You have not submitted any requests.</TableCell></TableRow>
                        ) : userRequests.map((request) => (
                          <TableRow key={request.id}>
                            <TableCell>
                              <div className="font-medium">{request.eventName}</div>
                              <div className="text-sm text-muted-foreground">{request.location}</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={request.status === "Approved" ? "secondary" : request.status === "Pending" ? "outline" : request.status === "Paid" ? "default" : "destructive"}>{request.status}</Badge>
                            </TableCell>
                            <TableCell>{format(parseISO(request.date), 'PPP')}</TableCell>
                            <TableCell className="text-right">{formatCurrency(request.totalPerdiem)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="analytics">
                <div className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>My Total Requests</CardTitle>
                                <CardDescription>All per diem requests you have submitted.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-4xl font-bold">{userRequests.length}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle>Total Paid to You</CardTitle>
                                <CardDescription>The total amount for all your paid per diems.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-4xl font-bold">{formatCurrency(totalPaid)}</p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-6">
                        <Card>
                        <CardHeader>
                            <CardTitle>My Requests by Status</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="h-[300px] flex items-center justify-center text-muted-foreground">Loading analytics...</div>
                            ) : pieChartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie data={pieChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                                    {pieChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={ANALYTICS_COLORS[entry.name as keyof typeof ANALYTICS_COLORS]} />
                                    ))}
                                    </Pie>
                                    <Tooltip formatter={(value, name) => [`${value} requests`, name]} />
                                    <Legend />
                                </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                                    You have not submitted any requests yet.
                                </div>
                            )}
                        </CardContent>
                        </Card>
                    </div>
                </div>
            </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

export default function EmployeeDashboardPage() {
  return (
    <Suspense fallback={<div>Loading dashboard...</div>}>
      <EmployeeDashboard />
    </Suspense>
  )
}
