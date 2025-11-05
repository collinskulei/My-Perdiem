

"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { isToday, parse, format, isFuture, startOfDay } from "date-fns";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import type { PerdiemRequest, Participant, AppEvent, Venue } from "@/lib/data";
import { dutyStationCoordinates, MILEAGE_RATE_KSH, OUT_OF_OFFICE_RATES } from "@/lib/data";
import * as firestore from '@/lib/firebase/firestore';
import * as mock from '@/lib/mock-data';
import { isTestMode as getIsTestMode } from '@/lib/test-mode';
import app from "@/lib/firebase/config";
import { useToast } from "@/hooks/use-toast";
import { SuccessDialog } from "@/components/success-dialog";
import { MapPin, Loader2, Check, LocateFixed, Wallet, Clock, AlertTriangle, Info } from "lucide-react";
import { cn, formatCurrency, getHaversineDistance } from "@/lib/utils";
import { useGeolocation } from "@/lib/hooks/use-geolocation";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ClientOnly } from "@/components/client-only";
import { Input } from "@/components/ui/input";


const dataProvider = getIsTestMode() ? mock : firestore;
const auth = getAuth(app);
const TEST_USER_ID_KEY = 'perdiem-pro-test-user-id';

// Mock User shape that is compatible with Firebase User
type MockUser = {
    uid: string;
}

const ANALYTICS_COLORS = {
  Pending: '#f97316', // orange-500
  Approved: '#10b981', // emerald-500
  Amended: '#64748b', // slate-500
  Paid: '#3b82f6', // blue-500
  Rejected: '#ef4444', // red-500
  Confirmed: '#22c55e', // green-500
};

export function EmployeeDashboard({ currentTab }: { currentTab: string }) {
  const [userRequests, setUserRequests] = useState<PerdiemRequest[]>([]);
  const [myEvents, setMyEvents] = useState<AppEvent[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<Participant | null>(null);
  const [authUser, setAuthUser] = useState<User | MockUser | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<string | null>(null); // Tracks eventId-date string
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState({ title: "", description: "" });
  const { toast, dismiss } = useToast();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(currentTab);
  const [isTestMode, setIsTestMode] = useState(false);
  const [bypassLocationCheck, setBypassLocationCheck] = useState(true);
  const [bypassTimeCheck, setBypassTimeCheck] = useState(true);
  
  // State for Confirm Payment dialog
  const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
  const [confirmingRequest, setConfirmingRequest] = useState<PerdiemRequest | null>(null);
  const [confirmTransactionCode, setConfirmTransactionCode] = useState("");

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
            ? dataProvider.getEventsByParticipant(authUser.uid)
            : dataProvider.getEventsByParticipant(authUser.uid);

        const [userData, requests, eventsData, venuesData] = await Promise.all([
          dataProvider.getParticipantById(authUser.uid),
          dataProvider.getPerDiemRequestsByParticipant(authUser.uid),
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
  
  const isCheckinOpenForEvent = (event: AppEvent): { isOpen: boolean, window: string } => {
    if (isTestMode && bypassTimeCheck) {
        return { isOpen: true, window: 'Bypassed' };
    }

    const now = new Date();
    const startTimeStr = event.checkinStartTime || '10:00';
    const endTimeStr = event.checkinEndTime || '17:00';
    
    const startDate = parse(startTimeStr, 'HH:mm', now);
    const endDate = parse(endTimeStr, 'HH:mm', now);

    const isOpen = now >= startDate && now <= endDate;
    const window = `${format(startDate, 'h:mm a')} - ${format(endDate, 'h:mm a')}`;

    return { isOpen, window };
  };


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
        // Optimistically update UI
        setMyEvents(prevEvents => prevEvents.map(evt => {
            if (evt.id === eventId) {
                const newCheckedIn = { ...(evt.checkedInParticipants || {}) };
                if (!newCheckedIn[userId]) {
                    newCheckedIn[userId] = {};
                }
                newCheckedIn[userId][dateString] = Date.now();
                return { ...evt, checkedInParticipants: newCheckedIn };
            }
            return evt;
        }));
    } catch (error) {
        console.error("Error checking in:", error);
        toast({ title: "Check-in Failed", description: "Could not record your check-in.", variant: "destructive" });
    } finally {
        setIsSubmitting(null);
    }
  }, [toast]);

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
    return (event.eventDates || []).map(dateStr => parse(dateStr, 'yyyy-MM-dd', new Date()));
  }

  const getAttendanceProgress = (event: AppEvent) => {
      const totalDays = getEventDays(event).length;
      if (totalDays === 0) return { percent: 0, color: 'bg-red-500', checkedInDays: 0, totalDays: 0 };

      const checkedInDays = event.checkedInParticipants?.[authUser?.uid ?? ''] 
          ? Object.keys(event.checkedInParticipants[authUser?.uid ?? '']).length
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

  const handleOpenConfirmDialog = (request: PerdiemRequest) => {
    setConfirmingRequest(request);
    setConfirmTransactionCode("");
    setIsConfirmingPayment(true);
  };

  const handleConfirmPayment = async () => {
    if (!confirmingRequest || !confirmTransactionCode) {
      toast({ title: "Missing Code", description: "Please enter the transaction code.", variant: "destructive" });
      return;
    }
    if (confirmingRequest.transactionCode !== confirmTransactionCode) {
        toast({ title: "Incorrect Code", description: "The transaction code does not match.", variant: "destructive" });
        return;
    }

    try {
      await dataProvider.updatePerDiemRequest(confirmingRequest.id, { status: 'Confirmed' });
      setUserRequests(prev => prev.map(req => req.id === confirmingRequest.id ? { ...req, status: 'Confirmed' } : req));
      toast({ title: "Payment Confirmed", description: "Thank you for confirming receipt of payment." });
      setIsConfirmingPayment(false);
    } catch (error) {
      toast({ title: "Error", description: "Could not confirm payment.", variant: "destructive" });
    }
  };

  const getBadgeVariant = (status: PerdiemRequest['status']) => {
    switch (status) {
        case 'Pending': return 'outline';
        case 'Approved': return 'secondary';
        case 'Paid': return 'default';
        case 'Amended': return 'outline';
        case 'Confirmed': return 'success';
        case 'Rejected': return 'destructive';
        default: return 'outline';
    }
   };


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
                <div className="flex items-center space-x-4 rounded-lg border p-3 bg-card self-start sm:self-center">
                    <div className="flex items-center space-x-2">
                        <Clock className="h-5 w-5 text-muted-foreground" />
                        <Label htmlFor="time-bypass" className="text-sm font-medium">Bypass Time</Label>
                        <Switch
                            id="time-bypass"
                            checked={bypassTimeCheck}
                            onCheckedChange={setBypassTimeCheck}
                        />
                    </div>
                     <div className="flex items-center space-x-2">
                        <LocateFixed className="h-5 w-5 text-muted-foreground" />
                        <Label htmlFor="location-bypass" className="text-sm font-medium">Bypass Location</Label>
                        <Switch
                            id="location-bypass"
                            checked={bypassLocationCheck}
                            onCheckedChange={setBypassLocationCheck}
                        />
                    </div>
                </div>
            )}
        </div>
        
        {geoError && !isTestMode && (
            <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Location Services Required</AlertTitle>
                <AlertDescription>
                    {geoError.message}. Please enable location services in your browser settings to check in to events.
                </AlertDescription>
            </Alert>
        )}
        
        {currentUser && (
            <PerDiemBalanceCard 
                participant={currentUser}
                events={myEvents}
                requests={userRequests}
                venues={venues}
            />
        )}

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
                       <div className="overflow-x-auto">
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
                                    
                                    const isInRange = (isTestMode && bypassLocationCheck) || (distance !== -1 && distance <= 1000);
                                    const canRequestPerDiem = hasCheckedInForAllDays(event) && !hasRequestedPerDiem(event.id);
                                    
                                    const checkInToday = eventDays.find(day => isToday(day));
                                    const isCheckedInForToday = checkInToday ? !!event.checkedInParticipants?.[authUser?.uid ?? '']?.[format(checkInToday, 'yyyy-MM-dd')] : false;
                                    const canCheckInToday = checkInToday && !isCheckedInForToday;

                                    const { isOpen: isCheckinOpen, window: checkinWindow } = isCheckinOpenForEvent(event);

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
                                                   {canRequestPerDiem ? (
                                                     <Button size="sm" onClick={() => handleRequestPerDiem(event)} className="whitespace-nowrap">Request Per Diem</Button>
                                                   ) : hasCheckedInForAllDays(event) && hasRequestedPerDiem(event.id) ? (
                                                     <Badge variant="secondary">Requested</Badge>
                                                   ) : canCheckInToday ? (
                                                        isCheckinOpen ? (
                                                            <Button size="sm" onClick={() => handleCheckIn(event, checkInToday)} disabled={!isInRange || !!isSubmitting || (geoError && !isTestMode)} className="whitespace-nowrap">
                                                                {isSubmitting === `${event.id}-${format(checkInToday, 'yyyy-MM-dd')}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <MapPin className="mr-2 h-4 w-4" />}
                                                                Check-in Today
                                                            </Button>
                                                        ) : (
                                                            <Button size="sm" disabled className="whitespace-nowrap bg-gray-400">
                                                                <Clock className="mr-2 h-4 w-4" />
                                                                <span className="hidden sm:inline">Closed </span>({checkinWindow})
                                                            </Button>
                                                        )
                                                   ) : null }
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                       </div>
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
                        <div className="overflow-x-auto">
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
                                        Object.entries(event.checkedInParticipants?.[authUser?.uid ?? ''] || {})
                                        .map(([date, timestamp]) => (
                                            <TableRow key={`${event.id}-${date}`}>
                                                <TableCell>{event.name}</TableCell>
                                                <TableCell className="whitespace-nowrap">{format(parse(date, 'yyyy-MM-dd', new Date()), 'PPP')}</TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant="secondary"><Check className="mr-1 h-3 w-3" />Checked-In</Badge>
                                                </TableCell>
                                            </TableRow>
                                    ))).length === 0 ? (
                                        <TableRow><TableCell colSpan={3} className="h-24 text-center">You have no check-ins yet.</TableCell></TableRow>
                                    ) : (
                                        myEvents.flatMap(event => 
                                            Object.entries(event.checkedInParticipants?.[authUser?.uid ?? ''] || {})
                                                .sort(([dateA], [dateB]) => parse(dateB, 'yyyy-MM-dd', new Date()).getTime() - parse(dateA, 'yyyy-MM-dd', new Date()).getTime())
                                                .map(([date, timestamp]) => (
                                                    <TableRow key={`${event.id}-${date}`}>
                                                        <TableCell>{event.name}</TableCell>
                                                        <TableCell className="whitespace-nowrap">{format(parse(date, 'yyyy-MM-dd', new Date()), 'PPP')}</TableCell>
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
                     <div className="overflow-x-auto">
                        <Table>
                        <TableHeader>
                            <TableRow>
                            <TableHead>Event</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Date Submitted</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                            <TableRow><TableCell colSpan={5} className="h-24 text-center">Loading your requests...</TableCell></TableRow>
                            ) : userRequests.length === 0 ? (
                            <TableRow><TableCell colSpan={5} className="h-24 text-center">You have not submitted any requests.</TableCell></TableRow>
                            ) : userRequests.map((request) => (
                            <TableRow key={request.id}>
                                <TableCell>
                                <div className="font-medium">{request.eventName}</div>
                                 {request.rejectionReason && (
                                     <p className="text-xs text-destructive mt-1">Reason: {request.rejectionReason}</p>
                                 )}
                                 {request.amendmentReason && (
                                     <p className="text-xs text-muted-foreground mt-1">Amendment: {request.amendmentReason}</p>
                                 )}
                                </TableCell>
                                <TableCell>
                                    <Badge variant={getBadgeVariant(request.status)}>{request.status}</Badge>
                                </TableCell>
                                <TableCell className="whitespace-nowrap">{format(parse(request.date, 'yyyy-MM-dd', new Date()), 'PPP')}</TableCell>
                                <TableCell className="text-right whitespace-nowrap">{formatCurrency(request.totalPerdiem)}</TableCell>
                                <TableCell className="text-right">
                                    {request.status === 'Paid' && (
                                        <Button size="sm" onClick={() => handleOpenConfirmDialog(request)}>Confirm Payment</Button>
                                    )}
                                     {request.status === 'Amended' && (
                                        <Button size="sm" onClick={() => dataProvider.updatePerDiemRequest(request.id, { status: 'Pending' }).then(fetchData)}>Acknowledge</Button>
                                    )}
                                </TableCell>
                            </TableRow>
                            ))}
                        </TableBody>
                        </Table>
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

       <Dialog open={isConfirmingPayment} onOpenChange={setIsConfirmingPayment}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Confirm Payment Received</DialogTitle>
                <DialogDescription>
                    Please enter the transaction code to confirm you have received this payment.
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="confirm-transaction-code" className="text-right">
                    Transaction Code
                    </Label>
                    <Input
                    id="confirm-transaction-code"
                    value={confirmTransactionCode}
                    onChange={(e) => setConfirmTransactionCode(e.target.value.toUpperCase())}
                    className="col-span-3"
                    placeholder="e.g., SDE8A4D2F1"
                    />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsConfirmingPayment(false)}>Cancel</Button>
                <Button onClick={handleConfirmPayment}>Confirm</Button>
            </DialogFooter>
        </DialogContent>
        </Dialog>
    </>
  );
}


// Helper component for balance card
export function PerDiemBalanceCard({ participant, events, requests, venues }: { participant: Participant, events: AppEvent[], requests: PerdiemRequest[], venues: Venue[] }) {
    const balance = useMemo(() => {
        const hasRequestedPerDiem = (eventId: string) => requests.some(req => req.eventId === eventId);
        
        const getAttendanceProgress = (event: AppEvent) => {
            const totalDays = (event.eventDates || []).length;
            const checkedInDays = event.checkedInParticipants?.[participant.id ?? ''] ? Object.keys(event.checkedInParticipants[participant.id ?? '']).length : 0;
            return { checkedInDays, totalDays };
        };

        const hasCheckedInForAllDays = (event: AppEvent): boolean => {
            const { checkedInDays, totalDays } = getAttendanceProgress(event);
            return totalDays > 0 && checkedInDays === totalDays;
        };

        const calculatePotentialPerDiem = (event: AppEvent): number => {
            if (!participant.dutyStation || !dutyStationCoordinates[participant.dutyStation] || !venues.find(v => v.id === event.venueId) || !participant.jobGroup || !event.jobGroupAllowances) {
                return 0;
            }
            const venue = venues.find(v => v.id === event.venueId)!;
            const { latitude: lat1, longitude: lon1 } = dutyStationCoordinates[participant.dutyStation];
            const { latitude: lat2, longitude: lon2 } = venue;
            const distance = getHaversineDistance(lat1, lon1, lat2, lon2) * 2; // Return trip
            const mileageTotal = Math.round(distance * MILEAGE_RATE_KSH);

            const nights = (event.eventDates || []).length;
            const dailyRate = event.jobGroupAllowances[participant.jobGroup] || 0;
            const accommodationTotal = nights * dailyRate;

            const outOfOfficeAllowance = (OUT_OF_OFFICE_RATES[participant.jobGroup])
                ? OUT_OF_OFFICE_RATES[participant.jobGroup] * nights
                : 0;

            return mileageTotal + accommodationTotal + outOfOfficeAllowance;
        };
        
        const unrequested = events
            .filter(event => hasCheckedInForAllDays(event) && !hasRequestedPerDiem(event.id))
            .reduce((sum, event) => sum + calculatePotentialPerDiem(event), 0);

        const requested = requests
            .filter(req => req.status === 'Pending' || req.status === 'Approved' || req.status === 'Amended')
            .reduce((sum, req) => sum + req.totalPerdiem, 0);

        return { unrequested, requested, total: unrequested + requested };
    }, [participant, events, requests, venues]);

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Per Diem Balance</CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(balance.total)}</div>
                <p className="text-xs text-muted-foreground">Total outstanding balance</p>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="flex flex-col">
                        <span className="font-medium">Unrequested</span>
                        <span className="text-muted-foreground">{formatCurrency(balance.unrequested)}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="font-medium">Requested (Pending Payment)</span>
                        <span className="text-muted-foreground">{formatCurrency(balance.requested)}</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

    


