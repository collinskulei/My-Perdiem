/**
 * @file This file defines the Admin Dashboard page.
 * It provides a user interface for administrators to manage per diem requests, employees, and venues.
 * Features include tabbed navigation, tables for data display, and dialogs for adding new data and generating reports.
 */
"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Download, MoreHorizontal, PlusCircle, Calendar as CalendarIcon, Check, ChevronsUpDown } from "lucide-react";
import Image from "next/image";
import { DateRange } from "react-day-picker";
import { format, differenceInCalendarDays, parseISO, isWithinInterval, isSameDay, isPast, endOfDay } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PerdiemRequest, Venue, Employee, AppEvent } from "@/lib/data";
import { dutyStationCoordinates } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import * as firestore from '@/lib/firebase/firestore';
import * as mock from '@/lib/mock-data';
import { isTestMode } from '@/lib/test-mode';
import { cn } from "@/lib/utils";

const dataProvider = isTestMode() ? mock : firestore;

const kenyanCounties = [
    "Mombasa", "Kwale", "Kilifi", "Tana River", "Lamu", "Taita-Taveta", "Garissa", "Wajir",
    "Mandera", "Marsabit", "Isiolo", "Meru", "Tharaka-Nithi", "Embu", "Kitui", "Machakos",
    "Makueni", "Nyandarua", "Nyeri", "Kirinyaga", "Murang'a", "Kiambu", "Turkana",
    "West Pokot", "Samburu", "Trans Nzoia", "Uasin Gishu", "Elgeyo-Marakwet", "Nandi",
    "Baringo", "Laikipia", "Nakuru", "Narok", "Kajiado", "Kericho", "Bomet", "Kakamega",
    "Vihiga", "Bungoma", "Busia", "Siaya", "Kisumu", "Homa Bay", "Migori", "Kisii",
    "Nyamira", "Nairobi"
];

const dutyStations = Object.keys(dutyStationCoordinates);

const defaultNewVenue = { name: "", city: "", county: "Nairobi", latitude: "0", longitude: "0" };
const defaultNewEvent = { name: "", facilitator: "", venueId: "", allocatedEmployees: [] as string[] };
const defaultFilters = { date: undefined, county: "all", dutyStation: "all", employee: "all" };

const toCSV = (data: any[], columns: string[], columnHeaders: string[]): string => {
  const header = columnHeaders.join(',') + '\n';
  const rows = data.map(row =>
    columns.map(colName => {
      let cellData = row[colName];
      if (cellData === null || cellData === undefined) return '""';
      cellData = String(cellData).replace(/"/g, '""');
      if (String(cellData).includes(',')) cellData = `"${cellData}"`;
      return cellData;
    }).join(',')
  ).join('\n');
  return header + rows;
};

const downloadCSV = (csvData: string, filename: string) => {
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}


function AdminDashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = searchParams.get('tab') || 'requests';

  const [activeTab, setActiveTab] = useState(initialTab);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [perdiemRequests, setPerdiemRequests] = useState<PerdiemRequest[]>([]);
  const [events, setEvents] = useState<AppEvent[]>([]);
  
  const [isAddVenueOpen, setIsAddVenueOpen] = useState(false);
  const [newVenue, setNewVenue] = useState(defaultNewVenue);
  
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<AppEvent | null>(null);
  const [eventFormData, setEventFormData] = useState<{name: string; facilitator: string; venueId: string; allocatedEmployees: string[] }>(defaultNewEvent);
  const [eventDates, setEventDates] = useState<Date[] | undefined>();
  const [isEmployeeSelectOpen, setEmployeeSelectOpen] = useState(false);

  // Filters for reports
  const [filters, setFilters] = useState<{
    date: DateRange | undefined;
    county: string;
    dutyStation: string;
    employee: string;
  }>(defaultFilters);
  const [filteredReportData, setFilteredReportData] = useState<PerdiemRequest[]>([]);
  
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    router.push(`/admin?tab=${value}`, { scroll: false });
  };

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [venuesData, employeesData, requestsData, eventsData] = await Promise.all([
        dataProvider.getVenues(),
        dataProvider.getEmployees(),
        dataProvider.getPerDiemRequests(),
        dataProvider.getEvents()
      ]);
      setVenues(venuesData);
      setEmployees(employeesData);
      setPerdiemRequests(requestsData);
      setEvents(eventsData.sort((a, b) => {
        const dateA = a.eventDates && a.eventDates.length > 0 ? new Date(a.eventDates[0]).getTime() : 0;
        const dateB = b.eventDates && b.eventDates.length > 0 ? new Date(b.eventDates[0]).getTime() : 0;
        return dateB - dateA;
      }));
    } catch (error) {
      console.error("Failed to fetch data:", error);
      toast({
        title: "Error",
        description: "Failed to load data from the database.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);


  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const applyFilters = useCallback(() => {
        let data = perdiemRequests;
        const allEmployees = employees;

        if (filters.date?.from && filters.date.to) {
            data = data.filter(item => {
                const itemDate = new Date(item.date);
                return isWithinInterval(itemDate, { start: filters.date!.from!, end: filters.date!.to! });
            });
        }
        
        if (filters.county !== 'all') {
            const venueInCounty = venues.filter(v => v.county === filters.county).map(v => v.id);
            const eventsInCounty = events.filter(e => venueInCounty.includes(e.venueId)).map(e => e.id);
            data = data.filter(req => eventsInCounty.includes(req.eventId));
        }

        if (filters.dutyStation !== 'all') {
            const employeeIds = allEmployees.filter(e => e.dutyStation === filters.dutyStation).map(e => e.id);
            data = data.filter(req => employeeIds.includes(req.employeeId));
        }

        if (filters.employee !== 'all') {
            data = data.filter(req => req.employeeId === filters.employee);
        }

        setFilteredReportData(data);
    }, [perdiemRequests, events, venues, employees, filters]);

    useEffect(() => {
        applyFilters();
    }, [filters, perdiemRequests, applyFilters]);

  const handleAddVenue = async () => {
    if (!newVenue.name || !newVenue.city || !newVenue.county) {
      toast({ title: "Missing fields", description: "Please fill out all venue details.", variant: "destructive" });
      return;
    }
    const venueToAdd = {
      name: newVenue.name,
      city: newVenue.city,
      county: newVenue.county,
      latitude: parseFloat(newVenue.latitude) || 0,
      longitude: parseFloat(newVenue.longitude) || 0,
    };
    try {
      const newVenueId = await dataProvider.addVenue(venueToAdd);
      setVenues(prev => [...prev, { id: newVenueId, ...venueToAdd }]);
      setNewVenue(defaultNewVenue);
      setIsAddVenueOpen(false);
      toast({ title: "Success", description: "Venue added successfully." });
    } catch (error) {
      console.error("Error adding venue: ", error);
      toast({ title: "Error", description: "Failed to add venue.", variant: "destructive" });
    }
  };

  const handleOpenEventDialog = (eventToEdit: AppEvent | null = null) => {
    if (eventToEdit) {
      setEditingEvent(eventToEdit);
      setEventFormData({
        name: eventToEdit.name,
        facilitator: eventToEdit.facilitator,
        venueId: eventToEdit.venueId,
        allocatedEmployees: eventToEdit.allocatedEmployees,
      });
      setEventDates((eventToEdit.eventDates || []).map(dateStr => parseISO(dateStr)));
    } else {
      setEditingEvent(null);
      setEventFormData(defaultNewEvent);
      setEventDates(undefined);
    }
    setIsEventDialogOpen(true);
  };
  

  const handleSaveEvent = async () => {
    const selectedVenue = venues.find(v => v.id === eventFormData.venueId);
    if (!eventFormData.name || !eventDates || eventDates.length === 0 || !eventFormData.venueId || !selectedVenue || !eventFormData.facilitator ) {
        toast({ title: "Missing fields", description: "Please fill all event details, including at least one date.", variant: "destructive" });
        return;
    }

    const formattedDates = eventDates.map(date => format(date, 'yyyy-MM-dd')).sort();

    const eventData = {
        name: eventFormData.name,
        eventDates: formattedDates,
        venueId: eventFormData.venueId,
        venueName: selectedVenue.name,
        venueCity: selectedVenue.city,
        facilitator: eventFormData.facilitator,
        allocatedEmployees: eventFormData.allocatedEmployees,
    };
    
    try {
      if (editingEvent) {
        // Update existing event
        await dataProvider.updateEvent(editingEvent.id, eventData);
        toast({ title: "Success", description: "Event updated successfully." });
      } else {
        // Add new event
        await dataProvider.addEvent(eventData);
        toast({ title: "Success", description: "Event created successfully." });
      }
      setIsEventDialogOpen(false);
      await fetchAllData(); // Refresh all data
    } catch (error) {
      console.error("Error saving event: ", error);
      toast({ title: "Error", description: `Failed to save event.`, variant: "destructive" });
    }
  };


  const updateRequestStatus = useCallback(async (requestId: string, status: 'Approved' | 'Rejected' | 'Paid') => {
    try {
      await dataProvider.updatePerDiemRequest(requestId, { status });
      setPerdiemRequests(prev => prev.map(req => req.id === requestId ? { ...req, status } : req));
      toast({ title: "Success", description: `Request status updated to ${status}.` });
    } catch (error) {
      console.error(`Error updating status for request ${requestId}:`, error);
      toast({ title: "Error", description: "Failed to update request status.", variant: "destructive" });
    }
  }, [toast]);


  const handleDownloadPerDiemReport = (dataToDownload: PerdiemRequest[], reportName: string) => {
    const detailedData = dataToDownload.map(req => {
        const event = events.find(e => e.id === req.eventId);
        const employee = employees.find(emp => emp.id === req.employeeId);
        const eventDuration = event && event.eventDates ? event.eventDates.length : 0;
        const daysAttended = employee && event?.checkedInEmployees?.[employee.id] ? Object.keys(event.checkedInEmployees[employee.id]).length : 0;
        const attendance = eventDuration > 0 ? `${daysAttended}/${eventDuration}` : 'N/A';

        return {
            ...req,
            eventStartDate: event?.eventDates?.[0] || 'N/A',
            eventEndDate: event?.eventDates?.[(event.eventDates || []).length - 1] || 'N/A',
            eventFacilitator: event?.facilitator || 'N/A',
            eventAttendance: attendance,
        };
    });

    const columns = [
        "date", "employeeName", "eventName", "eventStartDate", "eventEndDate", "eventFacilitator",
        "eventAttendance", "location", "mileageTotal", "accommodationTotal", "outOfOfficeAllowance", 
        "totalPerdiem", "status"
    ];
    const columnHeaders = [
        "Request Date", "Employee Name", "Event", "Event Start", "Event End", "Facilitator",
        "Attendance (Days)", "Location", "Mileage (Ksh)", "Accommodation (Ksh)", "Allowance (Ksh)",
        "Total Amount (Ksh)", "Status"
    ];
    const csvData = toCSV(detailedData, columns, columnHeaders);
    downloadCSV(csvData, `${reportName}_report.csv`);
  };

  const handleDownloadCheckinReport = (event: AppEvent) => {
    const eventDays = getEventDays(event);
    const dateColumns = eventDays.map(day => format(day, 'yyyy-MM-dd'));
    const dateHeaders = eventDays.map(day => format(day, 'MMM d'));

    const allocatedEmployees = employees.filter(emp => event.allocatedEmployees.includes(emp.id));

    const reportData = allocatedEmployees.map(employee => {
        const row: {[key: string]: any} = {
            employeeId: employee.id,
            employeeName: employee.name,
        };

        let checkedInCount = 0;
        dateColumns.forEach(dateString => {
            const isCheckedIn = !!event.checkedInEmployees?.[employee.id]?.[dateString];
            row[dateString] = isCheckedIn ? 'Checked-In' : 'Absent';
            if (isCheckedIn) checkedInCount++;
        });
        
        row.attendancePercentage = eventDays.length > 0 ? `${Math.round((checkedInCount / eventDays.length) * 100)}%` : '0%';

        return row;
    });

    const columns = ['employeeName', 'employeeId', ...dateColumns, 'attendancePercentage'];
    const headers = ['Employee Name', 'Employee ID', ...dateHeaders, 'Attendance %'];

    const csvData = toCSV(reportData, columns, headers);
    downloadCSV(csvData, `check-in-report_${event.name.replace(/\s+/g, '-')}.csv`);
  };

  const nonAdminEmployees = employees.filter(e => e.role !== 'Admin');

  const handleSelectEmployee = useCallback((employeeId: string) => {
    setEventFormData(prev => {
        const newSelection = prev.allocatedEmployees.includes(employeeId)
            ? prev.allocatedEmployees.filter(id => id !== employeeId)
            : [...prev.allocatedEmployees, employeeId];
        return { ...prev, allocatedEmployees: newSelection };
    });
  }, []);

  const handleSelectAllEmployees = (check: boolean | string) => {
     if (check) {
        setEventFormData(prev => ({ ...prev, allocatedEmployees: nonAdminEmployees.map(e => e.id) }));
     } else {
        setEventFormData(prev => ({ ...prev, allocatedEmployees: [] }));
     }
  };
  
  const getTotalCheckinsForEvent = (event: AppEvent) => {
    if (!event.checkedInEmployees) return 0;
    return Object.values(event.checkedInEmployees).reduce((total, dailyCheckins) => total + Object.keys(dailyCheckins).length, 0);
  };
  
  const getEventDays = (event: AppEvent) => {
    return (event.eventDates || []).map(dateStr => parseISO(dateStr));
  }

  const activeEvents = events.filter(event => {
    const today = new Date();
    return (event.eventDates || []).some(dateStr => isSameDay(today, parseISO(dateStr)) || isWithinInterval(today, {
        start: parseISO(dateStr),
        end: new Date(parseISO(dateStr).getFullYear(), parseISO(dateStr).getMonth(), parseISO(dateStr).getDate(), 23, 59, 59)
    }));
  });

  return (
    <>
    <div className="grid flex-1 items-start gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard (Admin)</h1>
      </div>
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="requests">Perdiem Requests</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="checkins">Event Check-ins</TabsTrigger>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="venues">Venues</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>
        <TabsContent value="requests">
          <Card>
            <CardHeader><CardTitle>Perdiem Requests</CardTitle><CardDescription>Overview of all submitted per diem requests.</CardDescription></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Event</TableHead><TableHead>Status</TableHead><TableHead className="hidden md:table-cell">Date</TableHead><TableHead className="text-right">Amount</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
                <TableBody>
                  {loading ? <TableRow><TableCell colSpan={6} className="h-24 text-center">Loading requests...</TableCell></TableRow> : perdiemRequests.map(request => (
                    <TableRow key={request.id}>
                      <TableCell><div className="font-medium">{request.employeeName}</div><div className="hidden text-sm text-muted-foreground md:inline">ID: {request.employeeId}</div></TableCell>
                      <TableCell>{request.eventName}</TableCell>
                      <TableCell><Badge variant={request.status === "Approved" ? "secondary" : request.status === "Pending" ? "outline" : request.status === "Paid" ? "default" : "destructive"}>{request.status}</Badge></TableCell>
                      <TableCell className="hidden md:table-cell">{request.date}</TableCell>
                      <TableCell className="text-right">Ksh {request.totalPerdiem.toLocaleString()}</TableCell>
                       <TableCell>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button aria-haspopup="true" size="icon" variant="ghost">
                                        <MoreHorizontal className="h-4 w-4" />
                                        <span className="sr-only">Toggle menu</span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                    <DropdownMenuItem onSelect={() => updateRequestStatus(request.id, 'Approved')} disabled={request.status === 'Approved' || request.status === 'Paid'}>
                                        Approve
                                    </DropdownMenuItem>
                                     <DropdownMenuItem onSelect={() => updateRequestStatus(request.id, 'Paid')} disabled={request.status !== 'Approved'}>
                                        Mark as Paid
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => updateRequestStatus(request.id, 'Rejected')} disabled={request.status === 'Rejected'}>
                                        Reject
                                    </DropdownMenuItem>
                                    <DropdownMenuItem>View Details</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events">
           <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div><CardTitle>Events</CardTitle><CardDescription>Manage upcoming and past events.</CardDescription></div>
                <Dialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm" onClick={() => handleOpenEventDialog()}>
                            <PlusCircle className="mr-2 h-4 w-4" />Add Event
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-2xl flex flex-col max-h-[90vh]">
                        <DialogHeader>
                            <DialogTitle>{editingEvent ? 'Edit Event' : 'Add New Event'}</DialogTitle>
                            <DialogDescription>
                                {editingEvent ? 'Update the details for this event.' : 'Enter the details for the new event.'}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="flex-1 overflow-y-auto pr-6 -mr-6">
                            <div className="grid gap-6 py-4">
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="event-name" className="text-right">Name</Label>
                                    <Input id="event-name" value={eventFormData.name} onChange={(e) => setEventFormData({ ...eventFormData, name: e.target.value })} className="col-span-3" />
                                </div>
                                <div className="grid grid-cols-4 items-start gap-4">
                                    <Label htmlFor="event-date" className="text-right pt-2">Event Dates</Label>
                                    <div className="col-span-3">
                                        <Calendar
                                            mode="multiple"
                                            selected={eventDates}
                                            onSelect={setEventDates}
                                            className="rounded-md border"
                                        />
                                        <p className="text-sm text-muted-foreground mt-2">
                                        {eventDates?.length ? `${eventDates.length} date(s) selected.` : 'Select one or more dates for the event.'}
                                        </p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="event-venue" className="text-right">Venue</Label>
                                    <Select value={eventFormData.venueId} onValueChange={(value) => setEventFormData({ ...eventFormData, venueId: value })}>
                                        <SelectTrigger className="col-span-3"><SelectValue placeholder="Select a venue" /></SelectTrigger>
                                        <SelectContent>{venues.map((v) => (<SelectItem key={v.id} value={v.id}>{v.name} ({v.city})</SelectItem>))}</SelectContent>
                                    </Select>
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="event-facilitator" className="text-right">Facilitator</Label>
                                    <Input id="event-facilitator" value={eventFormData.facilitator} onChange={(e) => setEventFormData({ ...eventFormData, facilitator: e.target.value })} className="col-span-3" />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label className="text-right">Assign Employees</Label>
                                    <Popover open={isEmployeeSelectOpen} onOpenChange={setEmployeeSelectOpen}>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className="col-span-3 justify-start text-left font-normal">
                                                <ChevronsUpDown className="mr-2 h-4 w-4" />
                                                {eventFormData.allocatedEmployees.length > 0 ? `${eventFormData.allocatedEmployees.length} selected` : "Select employees"}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                            <Command>
                                                <CommandInput placeholder="Search employees..." />
                                                <CommandList>
                                                    <CommandEmpty>No employees found.</CommandEmpty>
                                                    <CommandGroup>
                                                        <CommandItem onSelect={() => handleSelectAllEmployees(eventFormData.allocatedEmployees.length < nonAdminEmployees.length)}>
                                                            <Checkbox
                                                                className="mr-2"
                                                                checked={eventFormData.allocatedEmployees.length > 0 && eventFormData.allocatedEmployees.length === nonAdminEmployees.length}
                                                                readOnly
                                                            />
                                                            <span>Select All</span>
                                                        </CommandItem>
                                                    </CommandGroup>
                                                    <CommandSeparator />
                                                    <CommandGroup>
                                                        {nonAdminEmployees.map((employee) => (
                                                            <CommandItem
                                                                key={employee.id}
                                                                onSelect={() => handleSelectEmployee(employee.id)}
                                                            >
                                                                <Checkbox
                                                                    className="mr-2"
                                                                    checked={eventFormData.allocatedEmployees.includes(employee.id)}
                                                                    readOnly
                                                                />
                                                                <span>{employee.name}</span>
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsEventDialogOpen(false)}>Cancel</Button>
                            <Button type="button" onClick={handleSaveEvent}>Save Event</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader><TableRow><TableHead>Event Name</TableHead><TableHead>Venue</TableHead><TableHead>Dates</TableHead><TableHead>Assigned</TableHead><TableHead>Attendance</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={6} className="h-24 text-center">Loading events...</TableCell></TableRow> 
                        : events.map((event) => {
                            const lastEventDate = event.eventDates?.length ? parseISO(event.eventDates[event.eventDates.length - 1]) : new Date(0);
                            const isEventPast = isPast(endOfDay(lastEventDate));
                            return (
                                <TableRow key={event.id}>
                                    <TableCell className="font-medium">{event.name}</TableCell>
                                    <TableCell>{event.venueName}</TableCell>
                                    <TableCell>{(event.eventDates || []).join(', ')}</TableCell>
                                    <TableCell>{event.allocatedEmployees.length}</TableCell>
                                    <TableCell>{getTotalCheckinsForEvent(event)}</TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button aria-haspopup="true" size="icon" variant="ghost">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                    <span className="sr-only">Toggle menu</span>
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                <DropdownMenuItem onSelect={() => handleOpenEventDialog(event)} disabled={isEventPast}>
                                                    Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </CardContent>
           </Card>
        </TabsContent>

        <TabsContent value="checkins">
            <Card>
                <CardHeader>
                    <CardTitle>Active Event Check-ins</CardTitle>
                    <CardDescription>View live attendance for ongoing events.</CardDescription>
                </CardHeader>
                <CardContent>
                    {activeEvents.length > 0 ? (
                        <Tabs defaultValue={activeEvents[0].id}>
                            <TabsList>
                                {activeEvents.map(event => (
                                    <TabsTrigger key={event.id} value={event.id}>{event.name}</TabsTrigger>
                                ))}
                            </TabsList>
                            {activeEvents.map(event => {
                                const eventDays = getEventDays(event);
                                const allocatedEmployees = employees.filter(emp => event.allocatedEmployees.includes(emp.id));

                                return (
                                    <TabsContent key={event.id} value={event.id}>
                                        <Card>
                                            <CardHeader className="flex flex-row items-center justify-between">
                                                <div>
                                                    <CardTitle>{event.name} Attendance</CardTitle>
                                                    <CardDescription>Venue: {event.venueName}, {event.venueCity}</CardDescription>
                                                </div>
                                                <Button onClick={() => handleDownloadCheckinReport(event)} size="sm">
                                                    <Download className="mr-2 h-4 w-4" />
                                                    Download CSV
                                                </Button>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="overflow-x-auto">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead>Employee</TableHead>
                                                                {eventDays.map(day => (
                                                                    <TableHead key={format(day, 'yyyy-MM-dd')} className="text-center">{format(day, 'MMM d')}</TableHead>
                                                                ))}
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {allocatedEmployees.map(employee => (
                                                                <TableRow key={employee.id}>
                                                                    <TableCell>{employee.name}</TableCell>
                                                                    {eventDays.map(day => {
                                                                        const dateString = format(day, 'yyyy-MM-dd');
                                                                        const isCheckedIn = !!event.checkedInEmployees?.[employee.id]?.[dateString];
                                                                        return (
                                                                            <TableCell key={dateString} className="text-center">
                                                                                {isCheckedIn ? <Check className="h-5 w-5 text-green-500 mx-auto" /> : <span className="text-muted-foreground">-</span>}
                                                                            </TableCell>
                                                                        )
                                                                    })}
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </TabsContent>
                                );
                            })}
                        </Tabs>
                    ) : (
                        <div className="text-center text-muted-foreground py-10">No active events right now.</div>
                    )}
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="employees">
          <Card>
            <CardHeader><CardTitle>Employees</CardTitle><CardDescription>A list of all registered employees.</CardDescription></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead className="hidden w-[100px] sm:table-cell"><span className="sr-only">Image</span></TableHead><TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead className="hidden md:table-cell">Duty Station</TableHead><TableHead className="hidden md:table-cell">Job Group</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
                <TableBody>
                   {loading ? <TableRow><TableCell colSpan={6} className="h-24 text-center">Loading employees...</TableCell></TableRow> : employees.map(employee => (
                    <TableRow key={employee.id}>
                      <TableCell className="hidden sm:table-cell"><Image alt="Employee avatar" className="aspect-square rounded-full object-cover" height="40" src={employee.avatarUrl} width="40" data-ai-hint="person portrait"/></TableCell>
                      <TableCell className="font-medium">{employee.name}<div className="text-sm text-muted-foreground">{employee.employeeNumber}</div></TableCell>
                      <TableCell>{employee.role}</TableCell>
                      <TableCell className="hidden md:table-cell">{employee.dutyStation}</TableCell>
                      <TableCell className="hidden md:table-cell">{employee.jobGroup}</TableCell>
                      <TableCell><DropdownMenu><DropdownMenuTrigger asChild><Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /><span className="sr-only">Toggle menu</span></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuLabel>Actions</DropdownMenuLabel><DropdownMenuItem>View</DropdownMenuItem><DropdownMenuItem>Edit</DropdownMenuItem><DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem></DropdownMenuContent></DropdownMenu></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="venues">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div><CardTitle>Venues</CardTitle><CardDescription>A list of all registered venues.</CardDescription></div>
               <Dialog open={isAddVenueOpen} onOpenChange={setIsAddVenueOpen}><DialogTrigger asChild><Button size="sm"><PlusCircle className="mr-2 h-4 w-4" />Add Venue</Button></DialogTrigger>
                <DialogContent><DialogHeader><DialogTitle>Add New Venue</DialogTitle><DialogDescription>Enter the details for the new venue.</DialogDescription></DialogHeader>
                  <div className="grid gap-4 py-4"><div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="venue-name" className="text-right">Name</Label><Input id="venue-name" value={newVenue.name} onChange={(e) => setNewVenue({ ...newVenue, name: e.target.value })} className="col-span-3"/></div>
                    <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="venue-county" className="text-right">County</Label><Select value={newVenue.county} onValueChange={(value) => setNewVenue({ ...newVenue, county: value })}><SelectTrigger className="col-span-3"><SelectValue placeholder="Select a county" /></SelectTrigger><SelectContent>{kenyanCounties.map(county => (<SelectItem key={county} value={county}>{county}</SelectItem>))}</SelectContent></Select></div>
                    <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="venue-city" className="text-right">City</Label><Input id="venue-city" value={newVenue.city} onChange={(e) => setNewVenue({ ...newVenue, city: e.target.value })} className="col-span-3"/></div>
                    <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="venue-lat" className="text-right">Latitude</Label><Input id="venue-lat" type="number" value={newVenue.latitude} onChange={(e) => setNewVenue({ ...newVenue, latitude: e.target.value })} className="col-span-3"/></div>
                    <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="venue-lon" className="text-right">Longitude</Label><Input id="venue-lon" type="number" value={newVenue.longitude} onChange={(e) => setNewVenue({ ...newVenue, longitude: e.target.value })} className="col-span-3"/></div>
                  </div>
                  <DialogFooter><Button type="button" onClick={handleAddVenue}>Save Venue</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Venue Name</TableHead><TableHead>City</TableHead><TableHead>County</TableHead><TableHead>Coordinates</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
                <TableBody>
                  {loading ? <TableRow><TableCell colSpan={5} className="h-24 text-center">Loading venues...</TableCell></TableRow> : venues.map(venue => (
                    <TableRow key={venue.id}>
                      <TableCell className="font-medium">{venue.name}</TableCell>
                      <TableCell>{venue.city}</TableCell>
                      <TableCell>{venue.county}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{venue.latitude.toFixed(4)}, {venue.longitude.toFixed(4)}</TableCell>
                       <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              aria-haspopup="true"
                              size="icon"
                              variant="ghost"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Toggle menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem>Edit</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="reports">
            <Card>
                 <CardHeader>
                    <CardTitle>Reports</CardTitle>
                    <CardDescription>Filter and download per diem reports.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Filter Section */}
                    <div className="p-4 border rounded-lg space-y-4">
                        <h3 className="font-medium">Filter Options</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <Label htmlFor="date-range">Date Range</Label>
                                <Popover>
                                <PopoverTrigger asChild>
                                    <Button id="date" variant={"outline"} className={cn("w-full justify-start text-left font-normal", !filters.date && "text-muted-foreground")}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {filters.date?.from ? (filters.date.to ? (<>{format(filters.date.from, "LLL dd, y")} - {format(filters.date.to, "LLL dd, y")}</>) : (format(filters.date.from, "LLL dd, y"))) : (<span>Pick a date range</span>)}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar initialFocus mode="range" selected={filters.date} onSelect={(d) => setFilters(f => ({ ...f, date: d }))} numberOfMonths={2} />
                                </PopoverContent>
                                </Popover>
                            </div>
                             <div>
                                <Label htmlFor="county-filter">County</Label>
                                <Select value={filters.county} onValueChange={(v) => setFilters(f => ({ ...f, county: v }))}>
                                    <SelectTrigger><SelectValue placeholder="Select County" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Counties</SelectItem>
                                        {kenyanCounties.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="duty-station-filter">Duty Station</Label>
                                <Select value={filters.dutyStation} onValueChange={(v) => setFilters(f => ({ ...f, dutyStation: v }))}>
                                    <SelectTrigger><SelectValue placeholder="Select Station" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Stations</SelectItem>
                                        {dutyStations.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="employee-filter">Employee</Label>
                                <Select value={filters.employee} onValueChange={(v) => setFilters(f => ({ ...f, employee: v }))}>
                                    <SelectTrigger><SelectValue placeholder="Select Employee" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Employees</SelectItem>
                                        {nonAdminEmployees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    {/* Reports Sub-tabs */}
                    <Tabs defaultValue="approved">
                        <TabsList>
                            <TabsTrigger value="approved">Approved</TabsTrigger>
                            <TabsTrigger value="paid">Paid</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="approved">
                           <ReportTabContent 
                             title="Approved Perdiems" 
                             data={filteredReportData.filter(r => r.status === 'Approved')}
                             loading={loading}
                             onDownload={() => handleDownloadPerDiemReport(filteredReportData.filter(r => r.status === 'Approved'), 'approved_perdiems')}
                           />
                        </TabsContent>

                         <TabsContent value="paid">
                           <ReportTabContent 
                             title="Paid Perdiems" 
                             data={filteredReportData.filter(r => r.status === 'Paid')}
                             loading={loading}
                             onDownload={() => handleDownloadPerDiemReport(filteredReportData.filter(r => r.status === 'Paid'), 'paid_perdiems')}
                           />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
    </>
  );
}

// Helper component for the report tabs to reduce repetition
function ReportTabContent({ title, data, loading, onDownload }: { title: string, data: PerdiemRequest[], loading: boolean, onDownload: () => void }) {
    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                <CardTitle>{title}</CardTitle>
                <Button onClick={onDownload} size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Download CSV
                </Button>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Event</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                    <TableBody>
                    {loading ? (
                        <TableRow><TableCell colSpan={5} className="h-24 text-center">Loading report data...</TableCell></TableRow>
                    ) : data.length === 0 ? (
                         <TableRow><TableCell colSpan={5} className="h-24 text-center">No requests match the current filters.</TableCell></TableRow>
                    ) : data.map(request => (
                        <TableRow key={request.id}>
                        <TableCell>{request.employeeName}</TableCell>
                        <TableCell>{request.eventName}</TableCell>
                        <TableCell><Badge variant={request.status === "Approved" ? "secondary" : "default"}>{request.status}</Badge></TableCell>
                        <TableCell>{request.date}</TableCell>
                        <TableCell className="text-right">Ksh {request.totalPerdiem.toLocaleString()}</TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}


export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AdminDashboard />
    </Suspense>
  )
}
