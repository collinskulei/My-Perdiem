"use client";

import { useState, useEffect } from "react";
import { Download, MoreHorizontal, PlusCircle } from "lucide-react";
import Image from "next/image";

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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { employees, perdiemRequests } from "@/lib/data";
import type { Venue } from "@/lib/data";
import { getVenues, addVenue } from "@/lib/firebase/firestore";
import { useToast } from "@/hooks/use-toast";

export default function AdminDashboard() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [isAddVenueOpen, setIsAddVenueOpen] = useState(false);
  const [newVenue, setNewVenue] = useState({ name: "", city: "", latitude: "", longitude: "" });
  const [loadingVenues, setLoadingVenues] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchVenues = async () => {
      try {
        const firestoreVenues = await getVenues();
        setVenues(firestoreVenues);
      } catch (error) {
        console.error("Error fetching venues: ", error);
        toast({
          title: "Error",
          description: "Could not fetch venues from the database.",
          variant: "destructive",
        });
      } finally {
        setLoadingVenues(false);
      }
    };
    fetchVenues();
  }, [toast]);

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
      name: newVenue.name,
      city: newVenue.city,
      latitude: parseFloat(newVenue.latitude) || 0,
      longitude: parseFloat(newVenue.longitude) || 0,
    };
    
    try {
      const newVenueId = await addVenue(venueToAdd);
      setVenues([...venues, { id: newVenueId, ...venueToAdd }]);
      setNewVenue({ name: "", city: "", latitude: "", longitude: "" });
      setIsAddVenueOpen(false);
      toast({
        title: "Success",
        description: "Venue added successfully.",
      });
    } catch (error) {
       console.error("Error adding venue: ", error);
       toast({
        title: "Error",
        description: "Could not add the venue. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="grid flex-1 items-start gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
        <Button>
          <Download className="mr-2 h-4 w-4" />
          Download Data
        </Button>
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
                An overview of all submitted perdiem requests.
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
                    <Button type="submit" onClick={handleAddVenue}>Save Venue</Button>
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
