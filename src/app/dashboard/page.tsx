/**
 * @file This file defines the main dashboard page for an authenticated employee.
 * It displays a welcome message, a list of upcoming events, and a table of the user's recent per diem requests.
 */
"use client";

import { useState, useEffect } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { isToday, parseISO } from "date-fns";

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
import type { PerdiemRequest, Employee, AppEvent } from "@/lib/data";
import { dataProvider } from "@/lib/data-provider";
import app from "@/lib/firebase/config";
import { useToast } from "@/hooks/use-toast";
import { SuccessDialog } from "@/components/success-dialog";
import { MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const auth = getAuth(app);
const MILEAGE_RATE_KSH = 45;
const DAILY_ALLOWANCE = 5000;

export default function EmployeeDashboard() {
  const [userRequests, setUserRequests] = useState<PerdiemRequest[]>([]);
  const [myEvents, setMyEvents] = useState<AppEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState({ title: "", description: "" });
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
    });
    return () => unsubscribe();
  }, []);

  const fetchData = async () => {
      if (!authUser) return;

      setLoading(true);
      try {
        const [userData, requests, eventsData] = await Promise.all([
          dataProvider.getEmployeeById(authUser.uid),
          dataProvider.getPerDiemRequestsByEmployee(authUser.uid),
          dataProvider.getEventsByEmployee(authUser.uid)
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
  

  const handleCheckIn = async (event: AppEvent) => {
    if (!authUser) return;
    setIsSubmitting(event.id);
    try {
        await dataProvider.checkInToEvent(event.id, authUser.uid);
        setSuccessMessage({ title: "Check-in Successful!", description: "Your check-in has been recorded." });
        setIsSuccess(true);
        // Refresh data
        await fetchData();
    } catch (error) {
        console.error("Error checking in:", error);
        toast({ title: "Check-in Failed", description: "Could not record your check-in.", variant: "destructive" });
    } finally {
        setIsSubmitting(null);
    }
  };

  const handleRequestPerDiem = async (event: AppEvent) => {
    if (!authUser || !currentUser) return;
    setIsSubmitting(event.id);

    const numberOfNights = 1; // Simplified for now
    const totalPerdiem = DAILY_ALLOWANCE * numberOfNights; // Simplified calculation

    const requestData = {
        employeeId: authUser.uid,
        employeeName: currentUser.name,
        eventId: event.id,
        eventName: event.name,
        location: event.venueCity,
        date: new Date().toISOString().split('T')[0],
        totalPerdiem: totalPerdiem,
        status: 'Pending' as const,
        checkInTimestamp: event.checkedInEmployees?.[authUser.uid],
    };

    try {
        await dataProvider.addPerDiemRequest(requestData);
        setSuccessMessage({ title: "Request Submitted!", description: "Your per diem request has been sent for approval." });
        setIsSuccess(true);
        // Refresh data
        await fetchData();
    } catch (error) {
        console.error("Error submitting per diem request:", error);
        toast({ title: "Submission Failed", description: "Could not submit your per diem request.", variant: "destructive" });
    } finally {
        setIsSubmitting(null);
    }
  };

  const getFirstName = (name: string | undefined) => {
    if (!name) return "";
    return name.split(" ")[0];
  };

  const isCheckInActive = (event: AppEvent) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = parseISO(event.startDate);
    startDate.setHours(0, 0, 0, 0);
    return today.getTime() === startDate.getTime();
  };
  
  const hasRequestedPerDiem = (eventId: string) => {
    return userRequests.some(req => req.eventId === eventId);
  }

  const handleDone = () => {
    setIsSuccess(false);
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
        <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Welcome Back, {getFirstName(currentUser?.name)}!</h1>
            <p className="text-muted-foreground">Here's an overview of your events and requests.</p>
        </div>
        
        <Card>
            <CardHeader>
                <CardTitle>My Upcoming Events</CardTitle>
                <CardDescription>Events you have been allocated to. You can check-in on the event date.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader><TableRow><TableHead>Event</TableHead><TableHead>Venue</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {loading ? ( <TableRow><TableCell colSpan={4} className="h-24 text-center">Loading your events...</TableCell></TableRow>
                        ) : myEvents.length === 0 ? (
                            <TableRow><TableCell colSpan={4} className="h-24 text-center">You have no upcoming events.</TableCell></TableRow>
                        ) : myEvents.map((event) => {
                            const isCheckedIn = !!event.checkedInEmployees?.[authUser?.uid ?? ''];
                            const canCheckIn = isCheckInActive(event) && !isCheckedIn;
                            const canRequestPerDiem = isCheckedIn && !hasRequestedPerDiem(event.id);

                            return (
                                <TableRow key={event.id}>
                                    <TableCell className="font-medium">{event.name}</TableCell>
                                    <TableCell>{event.venueName}</TableCell>
                                    <TableCell>{event.startDate}</TableCell>
                                    <TableCell className="text-right">
                                        {isCheckedIn && !canRequestPerDiem && <Badge variant="secondary">Checked-in</Badge>}
                                        <div className="flex gap-2 justify-end">
                                        <Button size="sm" onClick={() => handleCheckIn(event)} disabled={!canCheckIn || !!isSubmitting} className={cn(!canCheckIn && "opacity-50")}>
                                          {isSubmitting === event.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <MapPin className="mr-2 h-4 w-4" />}
                                           Check-in
                                        </Button>
                                        {canRequestPerDiem && (
                                            <Button size="sm" onClick={() => handleRequestPerDiem(event)} disabled={!!isSubmitting}>
                                                {isSubmitting === event.id && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                                Request Per Diem
                                            </Button>
                                        )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
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
