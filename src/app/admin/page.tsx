/**
 * @file This file defines the Admin Dashboard page.
 * It provides a user interface for administrators to manage per diem requests, employees, and venues.
 * Features include tabbed navigation, tables for data display, and dialogs for adding new data and generating reports.
 */
"use client";

import { useState, useEffect } from "react";
import { Download, MoreHorizontal, PlusCircle } from "lucide-react";
import Image from "next/image";
import jsPDF from "jspdf";
import "jspdf-autotable";

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { employees, perdiemRequests, venues as initialVenues } from "@/lib/data";
import type { PerdiemRequest, Venue } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { ReportDialog } from "@/components/report-dialog";

/**
 * A default template for creating a new venue.
 * Used to reset the new venue form state.
 */
const defaultNewVenue = { name: "Test Venue", city: "Test City", latitude: "0", longitude: "0" };

/**
 * The main component for the administrator's dashboard.
 * It features a tab-based interface to manage perdiem requests, employees, and venues.
 * @returns {JSX.Element} The rendered admin dashboard.
 */
export default function AdminDashboard() {
  const [venues, setVenues] = useState<Venue[]>(initialVenues);
  const [isAddVenueOpen, setIsAddVenueOpen] = useState(false);
  const [newVenue, setNewVenue] = useState(defaultNewVenue);
  const [loadingVenues, setLoadingVenues] = useState(true);
  const { toast } = useToast();
  
  // Effect to simulate fetching venue data on component mount.
  useEffect(() => {
    setLoadingVenues(true);
    setTimeout(() => {
      setVenues(initialVenues);
      setLoadingVenues(false);
    }, 500);
  }, []);

  // Effect to reset the new venue form when the dialog is opened.
  useEffect(() => {
    if (isAddVenueOpen) {
      setNewVenue(defaultNewVenue);
    }
  }, [isAddVenueOpen]);

  /**
   * Handles the addition of a new venue.
   * Validates form fields and adds the new venue to the state for the current session.
   * Displays a success or error toast message.
   */
  const handleAddVenue = async () => {
    if (!newVenue.name || !newVenue.city || !newVenue.latitude || !newVenue.longitude) {
      toast({
        title: "Missing fields",
        description: "Please fill out all venue details.",
        variant: "destructive",
      });
      return;
    }
    const venueToAdd = {
      id: `venue-${Date.now()}`,
      name: newVenue.name,
      city: newVenue.city,
      latitude: parseFloat(newVenue.latitude) || 0,
      longitude: parseFloat(newVenue.longitude) || 0,
    };
    
    // Add to both the state and the initialVenues array to persist during the session
    setVenues(prevVenues => [...prevVenues, venueToAdd]);
    initialVenues.push(venueToAdd);

    setNewVenue(defaultNewVenue);
    setIsAddVenueOpen(false);
    toast({
      title: "Success",
      description: "Venue added successfully for this session.",
    });
  };

  /**
   * Generates and downloads a PDF report of per diem requests.
   * @param {PerdiemRequest[]} filteredData - The data to include in the report, pre-filtered by the ReportDialog.
   */
  const handleDownloadReport = (filteredData: PerdiemRequest[]) => {
    const doc = new jsPDF();
    doc.text("Perdiem Requests Report", 14, 16);
    
    const tableColumn = ["Date", "Employee", "Event", "Location", "Amount", "Status"];
    const tableRows: (string | number)[][] = [];

    filteredData.forEach(request => {
      const requestData = [
        request.date,
        request.employeeName,
        request.eventName,
        request.location,
        `Ksh ${request.totalPerdiem.toLocaleString()}`,
        request.status
      ];
      tableRows.push(requestData);
    });

    (doc as any).autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 20,
    });
    
    doc.save("perdiem_requests_report.pdf");
  };


  return (
    <div className="grid flex-1 items-start gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
        {/* ReportDialog component handles filtering and triggers the download */}
        <ReportDialog 
          reportData={perdiemRequests}
          venues={venues}
          onDownload={handleDownloadReport}
        />
      </div>
      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">Perdiem Requests</TabsTrigger>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="venues">Venues</TabsTrigger>
        </TabsList>
        <TabsContent value="requests">
          <Card>
            <CardHeader>
              <CardTitle>Perdiem Requests</CardTitle>
              <CardDescription>
                An overview of all submitted per diem requests.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {perdiemRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <div className="font-medium">{request.employeeName}</div>
                        <div className="hidden text-sm text-muted-foreground md:inline">
                          ID: {request.employeeId}
                        </div>
                      </TableCell>
                      <TableCell>{request.eventName}</TableCell>
                      <TableCell>
                        <Badge variant={
                          request.status === "Approved" ? "default" :
                          request.status === "Pending" ? "secondary" : "destructive"
                        } className={
                          request.status === "Approved" ? "bg-green-600/80" : ""
                        }>
                          {request.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {request.date}
                      </TableCell>
                      <TableCell className="text-right">
                        Ksh {request.totalPerdiem.toLocaleString()}
                      </TableCell>
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
                            <DropdownMenuItem>Approve</DropdownMenuItem>
                            <DropdownMenuItem>Reject</DropdownMenuItem>
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
        <TabsContent value="employees">
          <Card>
            <CardHeader>
              <CardTitle>Employees</CardTitle>
              <CardDescription>
                A list of all registered employees.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="hidden w-[100px] sm:table-cell">
                      <span className="sr-only">Image</span>
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Duty Station
                    </TableHead>
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell className="hidden sm:table-cell">
                        <Image
                          alt="Employee avatar"
                          className="aspect-square rounded-full object-cover"
                          height="40"
                          src={employee.avatarUrl}
                          width="40"
                          data-ai-hint="person portrait"
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {employee.name}
                        <div className="text-sm text-muted-foreground">
                          {employee.employeeNumber}
                        </div>
                      </TableCell>
                      <TableCell>{employee.role}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        {employee.dutyStation}
                      </TableCell>
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
                            <DropdownMenuItem>View</DropdownMenuItem>
                            <DropdownMenuItem>Edit</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">
                              Delete
                            </DropdownMenuItem>
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
        <TabsContent value="venues">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Venues</CardTitle>
                <CardDescription>
                  A list of all registered venues.
                </CardDescription>
              </div>
               <Dialog open={isAddVenueOpen} onOpenChange={setIsAddVenueOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Venue
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Venue</DialogTitle>
                    <DialogDescription>
                      Enter the details for the new venue.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="venue-name" className="text-right">
                        Name
                      </Label>
                      <Input
                        id="venue-name"
                        value={newVenue.name}
                        onChange={(e) => setNewVenue({ ...newVenue, name: e.target.value })}
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="venue-city" className="text-right">
                        City
                      </Label>
                      <Input
                        id="venue-city"
                        value={newVenue.city}
                        onChange={(e) => setNewVenue({ ...newVenue, city: e.target.value })}
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="venue-lat" className="text-right">
                        Latitude
                      </Label>
                      <Input
                        id="venue-lat"
                        type="number"
                        value={newVenue.latitude}
                        onChange={(e) => setNewVenue({ ...newVenue, latitude: e.target.value })}
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="venue-lon" className="text-right">
                        Longitude
                      </Label>
                      <Input
                        id="venue-lon"
                        type="number"
                        value={newVenue.longitude}
                        onChange={(e) => setNewVenue({ ...newVenue, longitude: e.target.value })}
                        className="col-span-3"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" onClick={handleAddVenue}>Save Venue</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Venue Name</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Coordinates</TableHead>
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingVenues ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center">
                        Loading venues...
                      </TableCell>
                    </TableRow>
                  ) : venues.map((venue) => (
                    <TableRow key={venue.id}>
                      <TableCell className="font-medium">{venue.name}</TableCell>
                      <TableCell>{venue.city}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {venue.latitude.toFixed(4)}, {venue.longitude.toFixed(4)}
                      </TableCell>
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
                            <DropdownMenuItem className="text-destructive">
                              Delete
                            </DropdownMenuItem>
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
