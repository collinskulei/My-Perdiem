

"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { isToday, parseISO, format, isFuture, startOfDay } from "date-fns";
import { useRouter } from "next/navigation";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';


import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { isTestMode as getIsTestMode } from '@/lib/test-mode';
import app from "@/lib/firebase/config";
import { useToast } from "@/hooks/use-toast";
import { SuccessDialog } from "@/components/success-dialog";
import { MapPin, Loader2, Check, LocateFixed } from "lucide-react";
import { cn, getHaversineDistance, formatCurrency } from "@/lib/utils";
import { useGeolocation } from "@/lib/hooks/use-geolocation";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ClientOnly } from "@/components/client-only";


const dataProvider = mock;
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

export function EmployeeDashboard({ currentTab }: { currentTab: string }) {
  const [userRequests, setUserRequests] = useState<PerdiemRequest[]>([]);
  const [myEvents, setMyEvents] = useState<AppEvent[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);
  const [authUser, setAuthUser] = useState<User | MockUser | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<string | null>(null); // Tracks eventId-date string
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState({ title: "", description: "" });
  const { toast } = useToast();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(currentTab);
  const [isTestMode, setIsTestMode] = useState(false);
  const [bypassLocationCheck, setBypassLocationCheck] = useState(true);

  const { latitude, longitude, error: geoError, getPosition, loading: geoLoading } = useGeolocation();

  useEffect(() => {
    const testMode = getIsTestMode();
    setIsTestMode(testMode);
    if (testMode) {
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

  const fetchData = useCallback(async () => {
      if (!authUser) return;

      setLoading(true);
      try {
        const eventsPromise = isTestMode
            ? dataProvider.getEventsByEmployee(authUser.uid)
            : dataProvider.getEventsByEmployee(authUser.uid);

        const [userData, requests, eventsData, venuesData] = await Promise.all([
          dataProvider.getEmployeeById(authUser.uid),
          dataProvider.getPerDiemRequestsByEmployee(authUser.uid),
          eventsPromise,
          dataProvider.getVenues()
        ]);
        
        setCurrentUser(userData);
        setUserRequests(requests);
        setMyEvents(eventsData);
        setVenues(venuesData);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
         toast({ title: "Error", description: "Could not load dashboard data.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    }, [authUser, toast, isTestMode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  useEffect(() => {
    // Fetch location on mount and then every 30 seconds
    getPosition();
    const interval = setInterval(() => {
      getPosition();
    }, 30000);
    return () => clearInterval(interval);
  }, [getPosition]);


  useEffect(() => {
    setActiveTab(currentTab);
  }, [currentTab]);
  

 const handleCheckIn = (event: AppEvent, date: Date) => {
    if (!authUser) return;
    const dateString = format(date, 'yyyy-MM-dd');
    setIsSubmitting(`${event.id}-${dateString}`);
    
    // In test mode with bypass on, or if location is already verified, proceed directly.
    if (isTestMode && bypassLocationCheck) {
      proceedWithCheckIn(event.id, authUser.uid, dateString);
      return;
    }

    toast({ title: "Verifying Location", description: "Please wait while we check your location..." });
    // Trigger a fresh position check
    getPosition(); 
  };
  
  const proceedWithCheckIn = useCallback(async (eventId: string, userId: string, dateString: string) => {
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
  }, [fetchData, toast]);

  useEffect(() => {
    const activeSubmission = isSubmitting;
    if (!activeSubmission || (isTestMode && bypassLocationCheck) || latitude === null || longitude === null) return;
    
    const [eventId, dateString] = activeSubmission.split('-');
    
    if (!authUser?.uid || !eventId || !dateString) {
      setIsSubmitting(null);
      return;
    }

    const event = myEvents.find(e => e.id === eventId);
    if (!event) return;

    if (geoError) {
        toast({ title: "Location Error", description: geoError.message, variant: "destructive" });
        setIsSubmitting(null);
        return;
    }
    
    const checkLocationAndProceed = async () => {
        const venue = venues.find(v => v.id === event.venueId);
        if (!venue) {
            toast({ title: "Check-in Failed", description: "Could not find event venue details.", variant: "destructive" });
            setIsSubmitting(null);
            return;
        }

        const distance = getHaversineDistance(latitude, longitude, venue.latitude, venue.longitude);
        
        if (distance <= 1000) { // 1000 meters = 1 km
            toast({ title: "Location Verified", description: "You are in the correct check-in spot. Proceeding..." });
            proceedWithCheckIn(event.id, authUser.uid, dateString);
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

  }, [latitude, longitude, geoError, isSubmitting, myEvents, authUser, toast, proceedWithCheckIn, isTestMode, venues, bypassLocationCheck]);


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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-1">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Welcome Back, {getFirstName(currentUser?.name)}!</h1>
                <p className="text-muted-foreground">Here's an overview of your events and requests.</p>
            </div>
             {isTestMode && (
                <div className="flex items-center space-x-2 rounded-lg border p-3 bg-card self-start sm:self-center">
                    <LocateFixed className="h-5 w-5 text-muted-foreground" />
                    <Label htmlFor="location-bypass" className="text-sm font-medium">Bypass Location Check</Label>
                    <Switch
                        id="location-bypass"
                        checked={bypassLocationCheck}
                        onCheckedChange={setBypassLocationCheck}
                    />
                </div>
            )}
        </div>
        <ClientOnly>
        <Tabs value={activeTab} onValueChange={handleTabChange}>
            <div className="overflow-x-auto pb-2">
                <TabsList>
                    <TabsTrigger value="events">My Events</TabsTrigger>
                    <TabsTrigger value="checkins">My Check-ins</TabsTrigger>
                    <TabsTrigger value="requests">My Per Diem Requests</TabsTrigger>
                    <TabsTrigger value="analytics">My Analytics</TabsTrigger>
                </TabsList>
            </div>
            <TabsContent value="events">
                 <Card>
                    <CardHeader>
                        <CardTitle>My Events</CardTitle>
                        <CardDescription>Events you are allocated to. Check-in daily to record your attendance.</CardDescription>
                    </CardHeader>
                    <CardContent>
                     <TooltipProvider>
                       <div className="hidden md:block">
                        <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[25%]">Event</TableHead>
                                <TableHead>Venue</TableHead>
                                <TableHead>Dates</TableHead>
                                <TableHead>Radius Check</TableHead>
                                <TableHead>Attendance</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? ( <TableRow><TableCell colSpan={6} className="h-24 text-center">Loading your events...</TableCell></TableRow>
                                ) : myEvents.length === 0 ? (
                                    <TableRow><TableCell colSpan={6} className="h-24 text-center">You have no upcoming events.</TableCell></TableRow>
                                ) : myEvents.map((event) => {
                                    const eventDays = getEventDays(event);
                                    const { percent, color } = getAttendanceProgress(event);

                                    const eventVenue = venues.find(v => v.id === event.venueId);
                                    let distance = -1;
                                    if (eventVenue && latitude && longitude) {
                                      distance = getHaversineDistance(latitude, longitude, eventVenue.latitude, eventVenue.longitude);
                                    }
                                    
                                    const isInRange = isTestMode && bypassLocationCheck ? true : distance !== -1 && distance <= 1000;
                                    const canRequestPerDiem = hasCheckedInForAllDays(event) && !hasRequestedPerDiem(event.id);
                                    
                                    return (
                                        <TableRow key={event.id}>
                                            <TableCell className="font-medium">{event.name}</TableCell>
                                            <TableCell>{event.venueName}</TableCell>
                                            <TableCell className="whitespace-nowrap">{(event.eventDates || []).join(', ')}</TableCell>
                                            <TableCell>
                                              {geoLoading ? ( <Badge variant="outline">Checking...</Badge>
                                              ) : isTestMode && bypassLocationCheck ? ( <Badge className="bg-blue-500 hover:bg-blue-600">Bypassed</Badge>
                                              ) : distance === -1 ? ( <Badge variant="outline">Unknown</Badge>
                                              ) : isInRange ? ( <Badge className="bg-green-500 hover:bg-green-600">In Range</Badge>
                                              ) : ( <Badge variant="destructive">{(distance / 1000).toFixed(1)} km away</Badge> )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="w-24"><Progress value={percent} indicatorClassName={color} className="h-3" /></div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                               <div className="flex gap-2 justify-end">
                                                   {canRequestPerDiem && <Button size="sm" onClick={() => handleRequestPerDiem(event)} className="whitespace-nowrap">Request Per Diem</Button> }
                                                   {hasCheckedInForAllDays(event) && hasRequestedPerDiem(event.id) && <Badge variant="secondary">Requested</Badge>}
                                                   
                                                   {!hasCheckedInForAllDays(event) && eventDays.map(day => {
                                                        const dateString = format(day, 'yyyy-MM-dd');
                                                        const isCheckedInForDay = !!event.checkedInEmployees?.[authUser?.uid ?? '']?.[dateString];
                                                        if (isCheckedInForDay || isFuture(startOfDay(day)) || startOfDay(day) < startOfDay(new Date())) return null;
                                                        
                                                        const canCheckIn = isToday(day) && isInRange;
                                                        return (
                                                             <Button key={dateString} size="sm" onClick={() => handleCheckIn(event, day)} disabled={!canCheckIn || !!isSubmitting} variant={!isToday(day) ? 'outline' : 'default'} className="whitespace-nowrap">
                                                                {isSubmitting === `${event.id}-${dateString}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <MapPin className="mr-2 h-4 w-4" />}
                                                                Check-in Today
                                                            </Button>
                                                        )
                                                   })}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                       </div>

                        {/* Mobile Card View */}
                        <div className="md:hidden space-y-4">
                            {loading ? <div className="text-center p-8 text-muted-foreground">Loading your events...</div>
                            : myEvents.length === 0 ? <div className="text-center p-8 text-muted-foreground">You have no upcoming events.</div>
                            : myEvents.map((event) => {
                                const eventDays = getEventDays(event);
                                const { percent, color, checkedInDays, totalDays } = getAttendanceProgress(event);
                                const eventVenue = venues.find(v => v.id === event.venueId);
                                let distance = -1;
                                if (eventVenue && latitude && longitude) {
                                    distance = getHaversineDistance(latitude, longitude, eventVenue.latitude, eventVenue.longitude);
                                }
                                const isInRange = isTestMode && bypassLocationCheck ? true : distance !== -1 && distance <= 1000;
                                const canRequestPerDiem = hasCheckedInForAllDays(event) && !hasRequestedPerDiem(event.id);
                                return (
                                <Card key={event.id}>
                                    <CardHeader>
                                        <CardTitle className="text-base">{event.name}</CardTitle>
                                        <CardDescription>{event.venueName}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4 text-sm">
                                         <div>
                                            <p className="font-medium mb-1">Attendance ({checkedInDays}/{totalDays})</p>
                                            <Progress value={percent} indicatorClassName={color} className="h-2" />
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-muted-foreground">Location:</span>
                                            {geoLoading ? ( <Badge variant="outline" className="text-xs">Checking...</Badge>
                                            ) : isTestMode && bypassLocationCheck ? ( <Badge className="bg-blue-500 hover:bg-blue-600 text-xs">Bypassed</Badge>
                                            ) : distance === -1 ? ( <Badge variant="outline" className="text-xs">Unknown</Badge>
                                            ) : isInRange ? ( <Badge className="bg-green-500 hover:bg-green-600 text-xs">In Range</Badge>
                                            ) : ( <Badge variant="destructive" className="text-xs">{(distance / 1000).toFixed(1)} km away</Badge> )}
                                        </div>
                                        <p><strong className="text-muted-foreground">Dates:</strong> {(event.eventDates || []).join(', ')}</p>
                                    </CardContent>
                                    <CardFooter className="flex flex-col items-stretch gap-2">
                                        {canRequestPerDiem && <Button size="sm" onClick={() => handleRequestPerDiem(event)} className="w-full">Request Per Diem</Button>}
                                        {hasCheckedInForAllDays(event) && hasRequestedPerDiem(event.id) && <Badge variant="secondary" className="justify-center py-2 text-sm">Requested</Badge>}
                                        
                                        {!hasCheckedInForAllDays(event) && eventDays.map(day => {
                                            const dateString = format(day, 'yyyy-MM-dd');
                                            const isCheckedInForDay = !!event.checkedInEmployees?.[authUser?.uid ?? '']?.[dateString];
                                            if (isCheckedInForDay || isFuture(startOfDay(day)) || startOfDay(day) < startOfDay(new Date())) return null;
                                            
                                            const canCheckIn = isToday(day) && isInRange;
                                            return (
                                                <Button key={dateString} size="sm" onClick={() => handleCheckIn(event, day)} disabled={!canCheckIn || !!isSubmitting} variant={!isToday(day) ? 'outline' : 'default'} className="w-full">
                                                    {isSubmitting === `${event.id}-${dateString}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <MapPin className="mr-2 h-4 w-4" />}
                                                    Check-in Today
                                                </Button>
                                            )
                                        })}
                                    </CardFooter>
                                </Card>
                                )
                            })}
                        </div>
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
                        <div className="hidden md:block">
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
                                                <TableCell className="whitespace-nowrap">{format(parseISO(date), 'PPP')}</TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant="secondary"><Check className="mr-1 h-3 w-3" />Checked-In</Badge>
                                                </TableCell>
                                            </TableRow>
                                    ))).length === 0 ? (
                                        <TableRow><TableCell colSpan={3} className="h-24 text-center">You have no check-ins yet.</TableCell></TableRow>
                                    ) : (
                                        myEvents.flatMap(event => 
                                            Object.entries(event.checkedInEmployees?.[authUser?.uid ?? ''] || {})
                                                .sort(([dateA], [dateB]) => parseISO(dateB).getTime() - parseISO(dateA).getTime())
                                                .map(([date, timestamp]) => (
                                                    <TableRow key={`${event.id}-${date}`}>
                                                        <TableCell>{event.name}</TableCell>
                                                        <TableCell className="whitespace-nowrap">{format(parseISO(date), 'PPP')}</TableCell>
                                                        <TableCell className="text-center">
                                                            <Badge variant="secondary"><Check className="mr-1 h-3 w-3" />Checked-In</Badge>
                                                        </TableCell>
                                                    </TableRow>
                                            ))
                                        )
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                        <div className="md:hidden space-y-3">
                             {loading ? <div className="text-center p-8 text-muted-foreground">Loading check-ins...</div>
                             : myEvents.flatMap(event => Object.entries(event.checkedInEmployees?.[authUser?.uid ?? ''] || {})).length === 0 
                             ? <div className="text-center p-8 text-muted-foreground">You have no check-ins yet.</div>
                             : myEvents.flatMap(event => 
                                    Object.entries(event.checkedInEmployees?.[authUser?.uid ?? ''] || {})
                                    .sort(([dateA], [dateB]) => parseISO(dateB).getTime() - parseISO(dateA).getTime())
                                    .map(([date]) => (
                                        <div key={`${event.id}-${date}`} className="p-3 border rounded-lg flex justify-between items-center text-sm">
                                            <div>
                                                <p className="font-medium">{event.name}</p>
                                                <p className="text-muted-foreground">{format(parseISO(date), 'PPP')}</p>
                                            </div>
                                            <Badge variant="secondary"><Check className="mr-1 h-3 w-3" />Checked-In</Badge>
                                        </div>
                                    ))
                                )}
                        </div>
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
                     <div className="hidden md:block">
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
                                <TableCell className="whitespace-nowrap">{format(parseISO(request.date), 'PPP')}</TableCell>
                                <TableCell className="text-right whitespace-nowrap">{formatCurrency(request.totalPerdiem)}</TableCell>
                            </TableRow>
                            ))}
                        </TableBody>
                        </Table>
                    </div>
                     <div className="md:hidden space-y-4">
                        {loading ? <div className="text-center p-8 text-muted-foreground">Loading your requests...</div>
                        : userRequests.length === 0 ? <div className="text-center p-8 text-muted-foreground">You have no requests.</div>
                        : userRequests.map((request) => (
                             <Card key={request.id}>
                                <CardHeader>
                                    <CardTitle className="text-base">{request.eventName}</CardTitle>
                                    <CardDescription>{request.location}</CardDescription>
                                </CardHeader>
                                <CardContent className="text-sm space-y-2">
                                     <div className="flex justify-between">
                                        <span className="text-muted-foreground">Status:</span>
                                        <Badge variant={request.status === "Approved" ? "secondary" : request.status === "Pending" ? "outline" : request.status === "Paid" ? "default" : "destructive"}>{request.status}</Badge>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Date:</span>
                                        <span>{format(parseISO(request.date), 'PPP')}</span>
                                    </div>
                                    <div className="flex justify-between items-baseline pt-2">
                                        <span className="text-muted-foreground">Amount:</span>
                                        <span className="font-semibold text-lg">{formatCurrency(request.totalPerdiem)}</span>
                                    </div>
                                </CardContent>
                             </Card>
                        ))}
                     </div>
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
                                <p className="text-3xl md:text-4xl font-bold">{formatCurrency(totalPaid)}</p>
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
        </ClientOnly>
      </div>
    </>
  );
}


    