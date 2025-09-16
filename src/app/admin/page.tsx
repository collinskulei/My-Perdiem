/**
 * @file This file defines the Admin Dashboard page.
 * It provides a user interface for administrators to manage per diem requests, employees, and venues.
 * Features include tabbed navigation, tables for data display, and dialogs for adding new data and generating reports.
 */
"use client";

import { useState, useEffect } from "react";
import { Download, MoreHorizontal, PlusCircle, Calendar as CalendarIcon, Check, ChevronsUpDown } from "lucide-react";
import Image from "next/image";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";

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
import { useToast } from "@/hooks/use-toast";
import { ReportDialog } from "@/components/report-dialog";
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

const defaultNewVenue = { name: "", city: "", county: "Nairobi", latitude: "0", longitude: "0" };
const defaultNewEvent = { name: "", facilitator: "", venueId: "", allocatedEmployees: [] as string[] };

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

export default function AdminDashboard() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [perdiemRequests, setPerdiemRequests] = useState<PerdiemRequest[]>([]);
  const [events, setEvents] = useState<AppEvent[]>([]);
  
  const [isAddVenueOpen, setIsAddVenueOpen] = useState(false);
  const [newVenue, setNewVenue] = useState(defaultNewVenue);
  
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [newEvent, setNewEvent] = useState(defaultNewEvent);
  const [eventDate, setEventDate] = useState<DateRange | undefined>();
  const [isEmployeeSelectOpen, setEmployeeSelectOpen] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchData() {
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
        setEvents(eventsData);
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
    }
    fetchData();
  }, [toast]);

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

  const handleAddEvent = async () => {
    const selectedVenue = venues.find(v => v.id === newEvent.venueId);
    if (!newEvent.name || !eventDate?.from || !eventDate?.to || !newEvent.venueId || !selectedVenue || !newEvent.facilitator ) {
        toast({ title: "Missing fields", description: "Please fill all event details.", variant: "destructive" });
        return;
    }

    const eventToAdd = {
        name: newEvent.name,
        startDate: eventDate.from.toISOString().split('T')[0],
        endDate: eventDate.to.toISOString().split('T')[0],
        venueId: newEvent.venueId,
        venueName: selectedVenue.name,
        venueCity: selectedVenue.city,
        facilitator: newEvent.facilitator,
        allocatedEmployees: newEvent.allocatedEmployees,
    };

    try {
        const newEventId = await dataProvider.addEvent(eventToAdd);
        setEvents(prev => [...prev, { id: newEventId, ...eventToAdd }]);
        setNewEvent(defaultNewEvent);
        setEventDate(undefined);
        setIsAddEventOpen(false);
        toast({ title: "Success", description: "Event created successfully." });
    } catch (error) {
        console.error("Error adding event: ", error);
        toast({ title: "Error", description: "Failed to create event.", variant: "destructive" });
    }
  };


  const handleDownloadReport = (filteredData: PerdiemRequest[], format: 'pdf' | 'csv') => {
    if (format === 'pdf') {
      const doc = new jsPDF();
      doc.text("Perdiem Requests Report", 14, 16);
      const tableColumn = ["Date", "Employee", "Event", "Location", "Amount", "Status"];
      const tableRows: (string | number)[][] = filteredData.map(req => [
        req.date, req.employeeName, req.eventName, req.location, `Ksh ${req.totalPerdiem.toLocaleString()}`, req.status
      ]);
      (doc as any).autoTable({ head: [tableColumn], body: tableRows, startY: 20 });
      doc.save("perdiem_requests_report.pdf");
    } else if (format === 'csv') {
      const columns = ["date", "employeeName", "eventName", "location", "totalPerdiem", "status"];
      const columnHeaders = ["Date", "Employee Name", "Event", "Location", "Amount (Ksh)", "Status"];
      const csvData = toCSV(filteredData, columns, columnHeaders);
      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'perdiem_requests_report.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const nonAdminEmployees = employees.filter(e => e.role !== 'Admin');

  const handleEmployeeSelection = (employeeId: string) => {
    setNewEvent(prev => {
        const isSelected = prev.allocatedEmployees.includes(employeeId);
        if (isSelected) {
            return { ...prev, allocatedEmployees: prev.allocatedEmployees.filter(id => id !== employeeId) };
        } else {
            return { ...prev, allocatedEmployees: [...prev.allocatedEmployees, employeeId] };
        }
    });
  };

  const handleSelectAllEmployees = (checked: boolean) => {
    if (checked) {
      setNewEvent(prev => ({
        ...prev,
        allocatedEmployees: nonAdminEmployees.map(e => e.id)
      }));
    } else {
      setNewEvent(prev => ({
        ...prev,
        allocatedEmployees: []
      }));
    }
  };

  return (
    <div className="grid flex-1 items-start gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
        <ReportDialog reportData={perdiemRequests} venues={venues} onDownload={handleDownloadReport} />
      </div>
      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">Perdiem Requests</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="venues">Venues</TabsTrigger>
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
                      <TableCell><Badge variant={request.status === "Approved" ? "secondary" : request.status === "Pending" ? "outline" : "destructive"}>{request.status}</Badge></TableCell>
                      <TableCell className="hidden md:table-cell">{request.date}</TableCell>
                      <TableCell className="text-right">Ksh {request.totalPerdiem.toLocaleString()}</TableCell>
                      <TableCell><DropdownMenu><DropdownMenuTrigger asChild><Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /><span className="sr-only">Toggle menu</span></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuLabel>Actions</DropdownMenuLabel><DropdownMenuItem>Approve</DropdownMenuItem><DropdownMenuItem>Reject</DropdownMenuItem><DropdownMenuItem>View Details</DropdownMenuItem></DropdownMenuContent></DropdownMenu></TableCell>
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
                <Dialog open={isAddEventOpen} onOpenChange={setIsAddEventOpen}><DialogTrigger asChild><Button size="sm"><PlusCircle className="mr-2 h-4 w-4" />Add Event</Button></DialogTrigger>
                <DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>Add New Event</DialogTitle><DialogDescription>Enter the details for the new event.</DialogDescription></DialogHeader>
                <div className="grid gap-4 py-4"><div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="event-name" className="text-right">Name</Label><Input id="event-name" value={newEvent.name} onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })} className="col-span-3" /></div>
                <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="event-date" className="text-right">Date Range</Label><Popover><PopoverTrigger asChild><Button id="date" variant={"outline"} className={cn("w-full justify-start text-left font-normal col-span-3",!eventDate && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{eventDate?.from ? (eventDate.to ? (<>{format(eventDate.from, "LLL dd, y")} - {format(eventDate.to, "LLL dd, y")}</>) : (format(eventDate.from, "LLL dd, y"))) : (<span>Pick a date range</span>)}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar initialFocus mode="range" defaultMonth={eventDate?.from} selected={eventDate} onSelect={setEventDate} numberOfMonths={2}/></PopoverContent></Popover></div>
                <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="event-venue" className="text-right">Venue</Label><Select value={newEvent.venueId} onValueChange={(value) => setNewEvent({ ...newEvent, venueId: value })}><SelectTrigger className="col-span-3"><SelectValue placeholder="Select a venue" /></SelectTrigger><SelectContent>{venues.map((v) => (<SelectItem key={v.id} value={v.id}>{v.name} ({v.city})</SelectItem>))}</SelectContent></Select></div>
                <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="event-facilitator" className="text-right">Facilitator</Label><Input id="event-facilitator" value={newEvent.facilitator} onChange={(e) => setNewEvent({ ...newEvent, facilitator: e.target.value })} className="col-span-3" /></div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Assign Employees</Label>
                    <Popover open={isEmployeeSelectOpen} onOpenChange={setEmployeeSelectOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="col-span-3 justify-start">
                                <ChevronsUpDown className="mr-2 h-4 w-4" />
                                {newEvent.allocatedEmployees.length > 0
                                ? `${newEvent.allocatedEmployees.length} employee(s) selected`
                                : "Select employees"}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                             <Command>
                                <CommandInput placeholder="Search employees..." />
                                <CommandList>
                                    <CommandEmpty>No employees found.</CommandEmpty>
                                    <CommandGroup>
                                        <CommandItem
                                          onSelect={() => handleSelectAllEmployees(newEvent.allocatedEmployees.length < nonAdminEmployees.length)}
                                        >
                                            <Checkbox
                                                id="select-all"
                                                className="mr-2"
                                                checked={newEvent.allocatedEmployees.length === nonAdminEmployees.length}
                                                onCheckedChange={(checked) => handleSelectAllEmployees(!!checked)}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                            <span>Select All</span>
                                        </CommandItem>
                                    </CommandGroup>
                                    <CommandSeparator />
                                    <CommandGroup>
                                        {nonAdminEmployees.map((employee) => (
                                            <CommandItem
                                                key={employee.id}
                                                onSelect={() => handleEmployeeSelection(employee.id)}
                                            >
                                                <Checkbox
                                                    id={`employee-${employee.id}`}
                                                    className="mr-2"
                                                    checked={newEvent.allocatedEmployees.includes(employee.id)}
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
                </div><DialogFooter><Button type="button" onClick={handleAddEvent}>Save Event</Button></DialogFooter></DialogContent></Dialog>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader><TableRow><TableHead>Event Name</TableHead><TableHead>Venue</TableHead><TableHead>Date Range</TableHead><TableHead>Employees</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
                    <TableBody>{loading ? <TableRow><TableCell colSpan={5} className="h-24 text-center">Loading events...</TableCell></TableRow> : events.map((event) => (<TableRow key={event.id}><TableCell className="font-medium">{event.name}</TableCell><TableCell>{event.venueName}</TableCell><TableCell>{event.startDate} to {event.endDate}</TableCell><TableCell>{event.allocatedEmployees.length}</TableCell><TableCell><DropdownMenu><DropdownMenuTrigger asChild><Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /><span className="sr-only">Toggle menu</span></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuLabel>Actions</DropdownMenuLabel><DropdownMenuItem>Edit</DropdownMenuItem><DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem></DropdownMenuContent></DropdownMenu></TableCell></TableRow>))}</TableBody>
                </Table>
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
      </Tabs>
    </div>
  );
}
