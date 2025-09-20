

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Download, MoreHorizontal, PlusCircle, Calendar as CalendarIcon, Check, ChevronsUpDown, Loader2 } from "lucide-react";
import Image from "next/image";
import { DateRange } from "react-day-picker";
import { format, isWithinInterval, parseISO, isPast, endOfDay, subDays } from "date-fns";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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
  DialogDescription,
  DialogTrigger,
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { PerdiemRequest, Venue, Employee, AppEvent } from "@/lib/data";
import { dutyStationCoordinates } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import * as firestore from '@/lib/firebase/firestore';
import * as mock from '@/lib/mock-data';
import { isTestMode } from '@/lib/test-mode';
import { cn, formatCurrency } from "@/lib/utils";
import { ClientOnly } from "@/components/client-only";

const dataProvider = mock;

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

const designations = [
    "Medical Director", "Chief Nursing Officer", "Resident Doctor", "Registered Nurse", "Clinical Officer",
    "Pharmacist", "Laboratory Technologist", "Radiographer", "Physiotherapist", "Hospital Administrator",
];
const jobGroups = ["A", "B1", "B2", "B3", "B4", "B5", "C1", "C2", "C3", "C4", "C5", "D1", "D2", "D3", "D4", "D5", "E1", "E2", "E4", "H", "J", "K", "L", "M", "N", "P", "Q", "R", "S"];

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

export function AdminDashboard({ currentTab }: { currentTab: string }) {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState(currentTab);
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
  
  const [isEmployeeDialogOpen, setIsEmployeeDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeFormData, setEmployeeFormData] = useState<Partial<Employee>>({});
  const [isSaving, setIsSaving] = useState(false);


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

  useEffect(() => {
    setActiveTab(currentTab);
  }, [currentTab]);

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

  const handleOpenEmployeeDialog = (employee: Employee) => {
    setEditingEmployee(employee);
    setEmployeeFormData(employee);
    setIsEmployeeDialogOpen(true);
  };

  const handleSaveEmployee = async () => {
    if (!editingEmployee) return;
    setIsSaving(true);
    try {
      await dataProvider.updateEmployee(editingEmployee.id, employeeFormData);
      toast({ title: "Success", description: "Employee details updated." });
      setIsEmployeeDialogOpen(false);
      await fetchAllData(); // Refresh data
    } catch (error) {
      console.error("Error updating employee: ", error);
      toast({ title: "Error", description: "Failed to update employee.", variant: "destructive" });
    } finally {
      setIsSaving(false);
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
    const eventDays = getEventDays(event);
    if (eventDays.length === 0) return false;
    const startDate = eventDays[0];
    const endDate = eventDays[eventDays.length - 1];
    return isWithinInterval(today, { start: startDate, end: endOfDay(endDate) });
  });

  return (
    <>
    <div className="grid flex-1 items-start gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Signed in as Admin</p>
      </div>
      <ClientOnly>
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <div className="overflow-x-auto pb-2">
            <TabsList>
            <TabsTrigger value="requests">Perdiem Requests</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="checkins">Event Check-ins</TabsTrigger>
            <TabsTrigger value="employees">Employees</TabsTrigger>
            <TabsTrigger value="venues">Venues</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>
        </div>
        <TabsContent value="requests">
          <Card>
            <CardHeader><CardTitle>Perdiem Requests</CardTitle><CardDescription>Overview of all submitted per diem requests.</CardDescription></CardHeader>
            <CardContent>
              {/* Desktop Table */}
              <div className="hidden md:block">
                <Table>
                    <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Event</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Amount</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
                    <TableBody>
                    {loading ? <TableRow><TableCell colSpan={6} className="h-24 text-center">Loading requests...</TableCell></TableRow> : perdiemRequests.map(request => (
                        <TableRow key={request.id}>
                        <TableCell><div className="font-medium">{request.employeeName}</div><div className="text-sm text-muted-foreground">ID: {request.employeeId}</div></TableCell>
                        <TableCell>{request.eventName}</TableCell>
                        <TableCell><Badge variant={request.status === "Approved" ? "secondary" : request.status === "Pending" ? "outline" : request.status === "Paid" ? "default" : "destructive"}>{request.status}</Badge></TableCell>
                        <TableCell>{request.date}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatCurrency(request.totalPerdiem)}</TableCell>
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
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-4">
                {loading ? <div className="text-center p-8 text-muted-foreground">Loading requests...</div> 
                : perdiemRequests.map(request => (
                    <Card key={request.id} className="w-full">
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="text-base">{request.employeeName}</CardTitle>
                                    <CardDescription>{request.eventName}</CardDescription>
                                </div>
                                 <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button aria-haspopup="true" size="icon" variant="ghost" className="-mt-2 -mr-2">
                                            <MoreHorizontal className="h-4 w-4" />
                                            <span className="sr-only">Toggle menu</span>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                        <DropdownMenuItem onSelect={() => updateRequestStatus(request.id, 'Approved')} disabled={request.status === 'Approved' || request.status === 'Paid'}>Approve</DropdownMenuItem>
                                        <DropdownMenuItem onSelect={() => updateRequestStatus(request.id, 'Paid')} disabled={request.status !== 'Approved'}>Mark as Paid</DropdownMenuItem>
                                        <DropdownMenuItem onSelect={() => updateRequestStatus(request.id, 'Rejected')} disabled={request.status === 'Rejected'}>Reject</DropdownMenuItem>
                                        <DropdownMenuItem>View Details</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </CardHeader>
                        <CardContent className="text-sm space-y-2">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Status:</span>
                                <Badge variant={request.status === "Approved" ? "secondary" : request.status === "Pending" ? "outline" : request.status === "Paid" ? "default" : "destructive"}>{request.status}</Badge>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Date:</span>
                                <span>{request.date}</span>
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

        <TabsContent value="events">
           <Card>
            <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div><CardTitle>Events</CardTitle><CardDescription>Manage upcoming and past events.</CardDescription></div>
                <Dialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm" onClick={() => handleOpenEventDialog()} className="w-full md:w-auto">
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
                                <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                                    <Label htmlFor="event-name" className="text-left sm:text-right">Name</Label>
                                    <Input id="event-name" value={eventFormData.name} onChange={(e) => setEventFormData({ ...eventFormData, name: e.target.value })} className="col-span-3" />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-4">
                                    <Label htmlFor="event-date" className="text-left sm:text-right pt-2">Event Dates</Label>
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
                                <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                                    <Label htmlFor="event-venue" className="text-left sm:text-right">Venue</Label>
                                    <Select value={eventFormData.venueId} onValueChange={(value) => setEventFormData({ ...eventFormData, venueId: value })}>
                                        <SelectTrigger className="col-span-3"><SelectValue placeholder="Select a venue" /></SelectTrigger>
                                        <SelectContent>{venues.map((v) => (<SelectItem key={v.id} value={v.id}>{v.name} ({v.city})</SelectItem>))}</SelectContent>
                                    </Select>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
                                    <Label htmlFor="event-facilitator" className="text-left sm:text-right">Facilitator</Label>
                                    <Input id="event-facilitator" value={eventFormData.facilitator} onChange={(e) => setEventFormData({ ...eventFormData, facilitator: e.target.value })} className="col-span-3" />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-4">
                                    <Label className="text-left sm:text-right">Assign Employees</Label>
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
                                                        <CommandItem
                                                            onSelect={() => handleSelectAllEmployees(!(eventFormData.allocatedEmployees.length === nonAdminEmployees.length))}
                                                            className="cursor-pointer"
                                                        >
                                                            <Checkbox
                                                                className="mr-2"
                                                                checked={eventFormData.allocatedEmployees.length > 0 && eventFormData.allocatedEmployees.length === nonAdminEmployees.length}
                                                                onCheckedChange={(checked) => handleSelectAllEmployees(checked)}
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
                                                                className="cursor-pointer"
                                                            >
                                                                <Checkbox
                                                                    className="mr-2"
                                                                    checked={eventFormData.allocatedEmployees.includes(employee.id)}
                                                                    onCheckedChange={() => handleSelectEmployee(employee.id)}
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
                <div className="hidden md:block">
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
                                        <TableCell className="whitespace-nowrap">{(event.eventDates || []).join(', ')}</TableCell>
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
                </div>
                 <div className="md:hidden space-y-4">
                     {loading ? <div className="text-center p-8 text-muted-foreground">Loading events...</div>
                     : events.map((event) => {
                        const lastEventDate = event.eventDates?.length ? parseISO(event.eventDates[event.eventDates.length - 1]) : new Date(0);
                        const isEventPast = isPast(endOfDay(lastEventDate));
                        return (
                            <Card key={event.id}>
                                <CardHeader>
                                     <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle className="text-base">{event.name}</CardTitle>
                                            <CardDescription>{event.venueName}</CardDescription>
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild><Button aria-haspopup="true" size="icon" variant="ghost" className="-mt-2 -mr-2"><MoreHorizontal className="h-4 w-4" /><span className="sr-only">Toggle menu</span></Button></DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                <DropdownMenuItem onSelect={() => handleOpenEventDialog(event)} disabled={isEventPast}>Edit</DropdownMenuItem>
                                                <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </CardHeader>
                                <CardContent className="text-sm space-y-2">
                                     <div className="flex justify-between"><span className="text-muted-foreground">Dates:</span> <span className="text-right">{(event.eventDates || []).join(', ')}</span></div>
                                     <div className="flex justify-between"><span className="text-muted-foreground">Assigned:</span> <span>{event.allocatedEmployees.length} employees</span></div>
                                     <div className="flex justify-between"><span className="text-muted-foreground">Attendance:</span> <span>{getTotalCheckinsForEvent(event)} check-ins</span></div>
                                </CardContent>
                            </Card>
                        )
                     })}
                 </div>
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
                             <div className="overflow-x-auto pb-2">
                                <TabsList>
                                    {activeEvents.map(event => (
                                        <TabsTrigger key={event.id} value={event.id}>{event.name}</TabsTrigger>
                                    ))}
                                </TabsList>
                             </div>
                            {activeEvents.map(event => {
                                const eventDays = getEventDays(event);
                                const allocatedEmployees = employees.filter(emp => event.allocatedEmployees.includes(emp.id));

                                return (
                                    <TabsContent key={event.id} value={event.id}>
                                        <Card>
                                            <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                                <div>
                                                    <CardTitle>{event.name} Attendance</CardTitle>
                                                    <CardDescription>Venue: {event.venueName}, {event.venueCity}</CardDescription>
                                                </div>
                                                <Button onClick={() => handleDownloadCheckinReport(event)} size="sm" className="w-full md:w-auto">
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
                                                                    <TableHead key={format(day, 'yyyy-MM-dd')} className="text-center whitespace-nowrap">{format(day, 'MMM d')}</TableHead>
                                                                ))}
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {allocatedEmployees.map(employee => (
                                                                <TableRow key={employee.id}>
                                                                    <TableCell className="whitespace-nowrap">{employee.name}</TableCell>
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
              <div className="hidden md:block">
                <Table>
                    <TableHeader><TableRow><TableHead className="w-[64px]"><span className="sr-only">Image</span></TableHead><TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead>Duty Station</TableHead><TableHead>Job Group</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
                    <TableBody>
                    {loading ? <TableRow><TableCell colSpan={6} className="h-24 text-center">Loading employees...</TableCell></TableRow> : employees.map(employee => (
                        <TableRow key={employee.id}>
                        <TableCell><Image alt="Employee avatar" className="aspect-square rounded-full object-cover" height="40" src={employee.avatarUrl} width="40" data-ai-hint="person portrait"/></TableCell>
                        <TableCell className="font-medium whitespace-nowrap">{employee.name}<div className="text-sm text-muted-foreground">{employee.employeeNumber}</div></TableCell>
                        <TableCell>{employee.role}</TableCell>
                        <TableCell>{employee.dutyStation}</TableCell>
                        <TableCell>{employee.jobGroup}</TableCell>
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
                                    <DropdownMenuItem onSelect={() => handleOpenEmployeeDialog(employee)}>Edit</DropdownMenuItem>
                                    <DropdownMenuItem>View</DropdownMenuItem>
                                    <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
              </div>
               <div className="md:hidden space-y-4">
                 {loading ? <div className="text-center p-8 text-muted-foreground">Loading employees...</div>
                 : employees.map(employee => (
                    <Card key={employee.id}>
                        <CardHeader>
                            <div className="flex items-start gap-4">
                                <Avatar className="w-12 h-12">
                                    <AvatarImage src={employee.avatarUrl} alt={employee.name} data-ai-hint="person portrait"/>
                                    <AvatarFallback>{employee.name.slice(0,2)}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                    <CardTitle className="text-base">{employee.name}</CardTitle>
                                    <CardDescription>{employee.role}</CardDescription>
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="-mt-2 -mr-2"><MoreHorizontal className="h-4 w-4"/></Button></DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                        <DropdownMenuItem onSelect={() => handleOpenEmployeeDialog(employee)}>Edit</DropdownMenuItem>
                                        <DropdownMenuItem>View</DropdownMenuItem>
                                        <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </CardHeader>
                        <CardContent className="text-sm space-y-2 pt-0">
                             <div className="flex justify-between"><span className="text-muted-foreground">ID:</span> <span>{employee.employeeNumber || 'N/A'}</span></div>
                             <div className="flex justify-between"><span className="text-muted-foreground">Duty Station:</span> <span>{employee.dutyStation || 'N/A'}</span></div>
                             <div className="flex justify-between"><span className="text-muted-foreground">Job Group:</span> <span>{employee.jobGroup || 'N/A'}</span></div>
                        </CardContent>
                    </Card>
                 ))}
                </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="venues">
          <Card>
            <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div><CardTitle>Venues</CardTitle><CardDescription>A list of all registered venues.</CardDescription></div>
               <Dialog open={isAddVenueOpen} onOpenChange={setIsAddVenueOpen}><DialogTrigger asChild><Button size="sm" className="w-full md:w-auto"><PlusCircle className="mr-2 h-4 w-4" />Add Venue</Button></DialogTrigger>
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
                <div className="hidden md:block">
                    <Table>
                        <TableHeader><TableRow><TableHead>Venue Name</TableHead><TableHead>City</TableHead><TableHead>County</TableHead><TableHead>Coordinates</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
                        <TableBody>
                        {loading ? <TableRow><TableCell colSpan={5} className="h-24 text-center">Loading venues...</TableCell></TableRow> : venues.map(venue => (
                            <TableRow key={venue.id}>
                            <TableCell className="font-medium">{venue.name}</TableCell>
                            <TableCell>{venue.city}</TableCell>
                            <TableCell>{venue.county}</TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{venue.latitude.toFixed(4)}, {venue.longitude.toFixed(4)}</TableCell>
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
                </div>
                 <div className="md:hidden space-y-4">
                    {loading ? <div className="text-center p-8 text-muted-foreground">Loading venues...</div>
                    : venues.map(venue => (
                        <Card key={venue.id}>
                             <CardHeader>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="text-base">{venue.name}</CardTitle>
                                        <CardDescription>{venue.city}, {venue.county}</CardDescription>
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="-mt-2 -mr-2"><MoreHorizontal className="h-4 w-4"/></Button></DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                            <DropdownMenuItem>Edit</DropdownMenuItem>
                                            <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </CardHeader>
                            <CardContent className="text-sm pt-0">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Coords:</span>
                                    <span className="font-mono text-xs">{venue.latitude.toFixed(4)}, {venue.longitude.toFixed(4)}</span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                 </div>
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
                        <div className="overflow-x-auto pb-2">
                            <TabsList>
                                <TabsTrigger value="approved">Approved</TabsTrigger>
                                <TabsTrigger value="paid">Paid</TabsTrigger>
                            </TabsList>
                        </div>
                        
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
        <TabsContent value="analytics">
            <AnalyticsTabContent requests={perdiemRequests} loading={loading} />
        </TabsContent>
      </Tabs>
      </ClientOnly>
    </div>
    
    <Dialog open={isEmployeeDialogOpen} onOpenChange={setIsEmployeeDialogOpen}>
        <DialogContent className="sm:max-w-2xl flex flex-col max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
            <DialogDescription>Update the details for {editingEmployee?.name}.</DialogDescription>
          </DialogHeader>
           <div className="flex-1 overflow-y-auto pr-6 -mr-6">
                <div className="space-y-4 py-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Full Name</Label>
                            <Input id="name" value={employeeFormData.name || ''} onChange={(e) => setEmployeeFormData(prev => ({ ...prev, name: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phoneNumber">Phone Number</Label>
                            <Input id="phoneNumber" value={employeeFormData.phoneNumber || ''} onChange={(e) => setEmployeeFormData(prev => ({ ...prev, phoneNumber: e.target.value }))} />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="space-y-2">
                            <Label htmlFor="idNumber">ID Number</Label>
                            <Input id="idNumber" value={employeeFormData.idNumber || ''} onChange={(e) => setEmployeeFormData(prev => ({ ...prev, idNumber: e.target.value }))} />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="gender">Gender</Label>
                            <Select value={employeeFormData.gender} onValueChange={(value) => setEmployeeFormData(prev => ({ ...prev, gender: value }))}>
                                <SelectTrigger id="gender"><SelectValue placeholder="Select gender" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="male">Male</SelectItem>
                                    <SelectItem value="female">Female</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {editingEmployee?.role !== 'Admin' && (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="employeeNumber">Employee Number</Label>
                                    <Input id="employeeNumber" value={employeeFormData.employeeNumber || ''} onChange={(e) => setEmployeeFormData(prev => ({ ...prev, employeeNumber: e.target.value }))} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="dutyStation">Duty Station</Label>
                                    <Select value={employeeFormData.dutyStation} onValueChange={(value) => setEmployeeFormData(prev => ({ ...prev, dutyStation: value }))}>
                                        <SelectTrigger><SelectValue placeholder="Select Station" /></SelectTrigger>
                                        <SelectContent>
                                            {dutyStations.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="jobGroup">Job Group</Label>
                                    <Select value={employeeFormData.jobGroup} onValueChange={(value) => setEmployeeFormData(prev => ({ ...prev, jobGroup: value }))}>
                                        <SelectTrigger id="jobGroup"><SelectValue placeholder="Select a job group" /></SelectTrigger>
                                        <SelectContent>
                                            {jobGroups.map((group) => (<SelectItem key={group} value={group}>{group}</SelectItem>))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="role">Role/Designation</Label>
                                    <Select value={employeeFormData.role} onValueChange={(value) => setEmployeeFormData(prev => ({ ...prev, role: value }))}>
                                        <SelectTrigger id="role"><SelectValue placeholder="Select a designation" /></SelectTrigger>
                                        <SelectContent>
                                            {designations.map((d) => (<SelectItem key={d} value={d}>{d}</SelectItem>))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </>
                    )}
                     {editingEmployee?.role === 'Admin' && (
                        <div className="space-y-2">
                            <Label htmlFor="organizationName">Organization Name</Label>
                            <Input id="organizationName" value={employeeFormData.organizationName || ''} onChange={(e) => setEmployeeFormData(prev => ({ ...prev, organizationName: e.target.value }))} />
                        </div>
                    )}
                </div>
            </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEmployeeDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEmployee} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
    </Dialog>
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
                 <Table className="hidden md:table">
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
                        <TableCell className="whitespace-nowrap">{request.date}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatCurrency(request.totalPerdiem)}</TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
                 <div className="md:hidden space-y-4">
                    {loading ? <div className="text-center p-8 text-muted-foreground">Loading report data...</div> 
                    : data.length === 0 ? <div className="text-center p-8 text-muted-foreground">No requests match filters.</div>
                    : data.map(request => (
                        <Card key={request.id} className="w-full">
                            <CardHeader>
                                <CardTitle className="text-base">{request.employeeName}</CardTitle>
                                <CardDescription>{request.eventName}</CardDescription>
                            </CardHeader>
                            <CardContent className="text-sm space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Status:</span>
                                    <Badge variant={request.status === "Approved" ? "secondary" : "default"}>{request.status}</Badge>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Date:</span>
                                    <span>{request.date}</span>
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
    )
}

function AnalyticsTabContent({ requests, loading }: { requests: PerdiemRequest[], loading: boolean }) {
  const chartData = useMemo(() => {
    if (!requests || requests.length === 0) {
      return null;
    }
    const requestsByStatus = requests.reduce((acc, req) => {
      acc[req.status] = (acc[req.status] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    const pieChartData = Object.entries(requestsByStatus).map(([name, value]) => ({ name, value }));

    const requestsByDate = requests.reduce((acc, req) => {
      const date = format(new Date(req.date), 'yyyy-MM-dd');
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = subDays(new Date(), i);
      const formattedDate = format(date, 'yyyy-MM-dd');
      return {
        date: format(date, 'MMM d'),
        count: requestsByDate[formattedDate] || 0,
      };
    }).reverse();

    const totalPaid = requests
      .filter(req => req.status === 'Paid')
      .reduce((sum, req) => sum + req.totalPerdiem, 0);

    const COLORS = {
      Pending: '#f97316',
      Approved: '#10b981',
      Paid: '#3b82f6',
      Rejected: '#ef4444',
    };

    return { pieChartData, last30Days, totalPaid, requestsCount: requests.length, COLORS };
  }, [requests]);

  if (loading) {
    return <div className="text-center p-10">Loading analytics...</div>;
  }
  
  if (!chartData || !chartData.pieChartData) {
    return <div className="text-center p-10 text-muted-foreground">No data available for analytics yet.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight">Analytics Overview</h2>
        <p className="text-muted-foreground">A high-level view of per diem request trends.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total Requests</CardTitle>
            <CardDescription>All per diem requests submitted.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl md:text-4xl font-bold">{chartData.requestsCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Paid Out</CardTitle>
            <CardDescription>The total amount for all paid per diems.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl md:text-4xl font-bold">{formatCurrency(chartData.totalPaid)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Requests by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={chartData.pieChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {chartData.pieChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={chartData.COLORS[entry.name as keyof typeof chartData.COLORS] || '#ccc'} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [`${value} requests`, name]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Requests in Last 30 Days</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData.last30Days}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="hsl(var(--primary))" name="Requests" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}



    