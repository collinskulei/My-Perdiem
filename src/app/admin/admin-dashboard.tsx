

"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Download, MoreHorizontal, PlusCircle, Calendar as CalendarIcon, Check, ChevronsUpDown, Loader2, QrCode, Upload, File as FileIcon, X, Wallet, Paperclip } from "lucide-react";
import Image from "next/image";
import { DateRange } from "react-day-picker";
import { format, isWithinInterval, parseISO, isPast, endOfDay, subDays } from "date-fns";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { QRCodeCanvas } from 'qrcode.react';
import * as XLSX from 'xlsx';


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
import type { PerdiemRequest, Venue, Participant, AppEvent } from "@/lib/data";
import { dutyStationCoordinates } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import * as firestore from '@/lib/firebase/firestore';
import * as mock from '@/lib/mock-data';
import { isTestMode } from '@/lib/test-mode';
import { cn, formatCurrency } from "@/lib/utils";
import { ClientOnly } from "@/components/client-only";
import { PerDiemBalanceCard } from "@/app/dashboard/employee-dashboard";
import { Separator } from "@/components/ui/separator";

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
const defaultNewEvent = { name: "", facilitator: "", venueId: "", allocatedParticipants: [] as string[] };
const defaultFilters = { date: undefined, county: "all", dutyStation: "all", participant: "all" };

const designations = [
    "Medical Director", "Chief Nursing Officer", "Resident Doctor", "Registered Nurse", "Clinical Officer",
    "Pharmacist", "Laboratory Technologist", "Radiographer", "Physiotherapist", "Hospital Administrator",
];
const jobGroups = ["A", "B1", "B2", "B3", "B4", "B5", "C1", "C2", "C3", "C4", "C5", "D1", "D2", "D3", "D4", "D5", "E1", "E2", "E4", "H", "J", "K", "L", "M", "N", "P", "Q", "R", "S"];

type UnregisteredParticipant = { name: string; phoneNumber: string };

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
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [perdiemRequests, setPerdiemRequests] = useState<PerdiemRequest[]>([]);
  const [events, setEvents] = useState<AppEvent[]>([]);
  
  const [isAddVenueOpen, setIsAddVenueOpen] = useState(false);
  const [newVenue, setNewVenue] = useState(defaultNewVenue);
  
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<AppEvent | null>(null);
  const [eventFormData, setEventFormData] = useState<{name: string; facilitator: string; venueId: string; allocatedParticipants: string[] }>(defaultNewEvent);
  const [eventDates, setEventDates] = useState<Date[] | undefined>();
  const [isParticipantSelectOpen, setParticipantSelectOpen] = useState(false);
  const [uploadedParticipants, setUploadedParticipants] = useState<UnregisteredParticipant[]>([]);
  const [participantFile, setParticipantFile] = useState<File | null>(null);
  const [programFile, setProgramFile] = useState<File | null>(null);
  const [letterFile, setLetterFile] = useState<File | null>(null);
  
  const [isParticipantDialogOpen, setIsParticipantDialogOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  const [participantFormData, setParticipantFormData] = useState<Partial<Participant>>({});
  const [isSaving, setIsSaving] = useState(false);

  // State for participant-specific data in the dialog
  const [participantEvents, setParticipantEvents] = useState<AppEvent[]>([]);
  const [participantRequests, setParticipantRequests] = useState<PerdiemRequest[]>([]);


  // QR Code Success Dialog
  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false);
  const [successDialogData, setSuccessDialogData] = useState<{ event: AppEvent; } | null>(null);

  // Bulk Paid Dialog
  const [isBulkPaidDialogOpen, setIsBulkPaidDialogOpen] = useState(false);
  const [bulkPaidEvent, setBulkPaidEvent] = useState<AppEvent | null>(null);
  const [bulkMpesaCode, setBulkMpesaCode] = useState("");
  const approvedRequestsForBulkPay = useMemo(() => {
    if (!bulkPaidEvent) return [];
    return perdiemRequests.filter(
        (req) => req.eventId === bulkPaidEvent.id && req.status === 'Approved'
    );
  }, [bulkPaidEvent, perdiemRequests]);

  // Filters for reports
  const [filters, setFilters] = useState<{
    date: DateRange | undefined;
    county: string;
    dutyStation: string;
    participant: string;
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
      const [venuesData, participantsData, requestsData, eventsData] = await Promise.all([
        dataProvider.getVenues(),
        dataProvider.getParticipants(),
        dataProvider.getPerDiemRequests(),
        dataProvider.getEvents()
      ]);
      setVenues(venuesData);
      setParticipants(participantsData);
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
        const allParticipants = participants;

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
            const participantIds = allParticipants.filter(p => p.dutyStation === filters.dutyStation).map(p => p.id);
            data = data.filter(req => participantIds.includes(req.participantId));
        }

        if (filters.participant !== 'all') {
            data = data.filter(req => req.participantId === filters.participant);
        }

        setFilteredReportData(data);
    }, [perdiemRequests, events, venues, participants, filters]);

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
        allocatedParticipants: eventToEdit.allocatedParticipants,
      });
      setEventDates((eventToEdit.eventDates || []).map(dateStr => parseISO(dateStr)));
      setUploadedParticipants(eventToEdit.unregisteredParticipants || []);
      // Note: We don't re-populate file inputs for security reasons, but show existing file names.
      if (eventToEdit.programFilename) setProgramFile({ name: eventToEdit.programFilename } as File);
      if (eventToEdit.letterFilename) setLetterFile({ name: eventToEdit.letterFilename } as File);

    } else {
      setEditingEvent(null);
      setEventFormData(defaultNewEvent);
      setEventDates(undefined);
      setUploadedParticipants([]);
      setParticipantFile(null);
      setProgramFile(null);
      setLetterFile(null);
    }
    setIsEventDialogOpen(true);
  };
  
  const handleOpenQrDialog = (event: AppEvent) => {
      setSuccessDialogData({ event });
      setIsSuccessDialogOpen(true);
  }

  const handleSaveEvent = async () => {
    const selectedVenue = venues.find(v => v.id === eventFormData.venueId);
    if (!eventFormData.name || !eventDates || eventDates.length === 0 || !eventFormData.venueId || !selectedVenue || !eventFormData.facilitator ) {
        toast({ title: "Missing fields", description: "Please fill all event details, including at least one date.", variant: "destructive" });
        return;
    }

    if (!letterFile && !editingEvent?.letterFilename) {
        toast({ title: "Missing Document", description: "The Event Letter is required to create or update an event.", variant: "destructive" });
        return;
    }

    const formattedDates = eventDates.map(date => format(date, 'yyyy-MM-dd')).sort();

    const allDbParticipants = await dataProvider.getParticipants();
    const phoneToIdMap = new Map(allDbParticipants.map(p => [p.phoneNumber, p.id]));

    const manuallySelectedIds = eventFormData.allocatedParticipants;
    const uploadedRegisteredIds = uploadedParticipants
        .map(up => phoneToIdMap.get(up.phoneNumber))
        .filter((id): id is string => !!id);

    const finalAllocatedIds = [...new Set([...manuallySelectedIds, ...uploadedRegisteredIds])];

    const finalUnregistered = uploadedParticipants.filter(up => !phoneToIdMap.has(up.phoneNumber));

    const eventData: Partial<AppEvent> = {
        name: eventFormData.name,
        eventDates: formattedDates,
        venueId: eventFormData.venueId,
        venueName: selectedVenue.name,
        venueCity: selectedVenue.city,
        facilitator: eventFormData.facilitator,
        allocatedParticipants: finalAllocatedIds,
        unregisteredParticipants: finalUnregistered,
        programFilename: programFile?.name,
        letterFilename: letterFile?.name,
    };
    
    try {
      let eventId = editingEvent?.id;
      let finalEvent: AppEvent;
      if (editingEvent) {
        // Update existing event
        await dataProvider.updateEvent(editingEvent.id, eventData);
        finalEvent = { ...editingEvent, ...eventData, checkedInParticipants: editingEvent.checkedInParticipants || {} };
        toast({ title: "Success", description: "Event updated successfully." });
      } else {
        // Add new event
        eventId = await dataProvider.addEvent(eventData);
        finalEvent = { id: eventId, ...eventData, checkedInParticipants: {} } as AppEvent;
        toast({ title: "Success", description: "Event created successfully." });
      }
      setIsEventDialogOpen(false);
      await fetchAllData(); // Refresh all data

      // Open success dialog with QR code
      if(eventId) {
        setSuccessDialogData({ event: finalEvent });
        setIsSuccessDialogOpen(true);
      }

    } catch (error) {
      console.error("Error saving event: ", error);
      toast({ title: "Error", description: `Failed to save event.`, variant: "destructive" });
    }
  };

    const handleOpenParticipantDialog = async (participant: Participant) => {
        setEditingParticipant(participant);
        setParticipantFormData(participant);
        
        // Fetch participant-specific data
        const [empEvents, empRequests] = await Promise.all([
            dataProvider.getEventsByParticipant(participant.id),
            dataProvider.getPerDiemRequestsByParticipant(participant.id)
        ]);
        setParticipantEvents(empEvents);
        setParticipantRequests(empRequests);
        
        setIsParticipantDialogOpen(true);
    };

  const handleSaveParticipant = async () => {
    if (!editingParticipant) return;
    setIsSaving(true);
    try {
      await dataProvider.updateParticipant(editingParticipant.id, participantFormData);
      toast({ title: "Success", description: "Participant details updated." });
      setIsParticipantDialogOpen(false);
      await fetchAllData(); // Refresh data
    } catch (error) {
      console.error("Error updating participant: ", error);
      toast({ title: "Error", description: "Failed to update participant.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };


  const updateRequestStatus = useCallback(async (requestId: string, status: 'Approved' | 'Rejected') => {
    try {
      await dataProvider.updatePerDiemRequest(requestId, { status });
      setPerdiemRequests(prev => prev.map(req => req.id === requestId ? { ...req, status } : req));
      toast({ title: "Success", description: `Request status updated to ${status}.` });
    } catch (error) {
      console.error(`Error updating status for request ${requestId}:`, error);
      toast({ title: "Error", description: "Failed to update request status.", variant: "destructive" });
    }
  }, [toast]);

  const handleOpenBulkPaidDialog = (event: AppEvent) => {
    setBulkPaidEvent(event);
    setBulkMpesaCode("");
    setIsBulkPaidDialogOpen(true);
  };

  const handleConfirmBulkPaid = async () => {
    if (!bulkPaidEvent || !bulkMpesaCode) {
      toast({ title: "Missing Code", description: "Please enter the M-Pesa transaction code.", variant: "destructive" });
      return;
    }
    try {
      await dataProvider.markEventAsPaid(bulkPaidEvent.id, bulkMpesaCode);
      toast({ title: "Success", description: `All approved per diems for ${bulkPaidEvent.name} marked as Paid.` });
      setIsBulkPaidDialogOpen(false);
      fetchAllData(); // Refresh data to show updated statuses
    } catch (error) {
      console.error(`Error marking event as paid ${bulkPaidEvent.id}:`, error);
      toast({ title: "Error", description: "Failed to perform bulk payment.", variant: "destructive" });
    }
  };


  const handleDownloadPerDiemReport = (dataToDownload: PerdiemRequest[], reportName: string) => {
    const detailedData = dataToDownload.map(req => {
        const event = events.find(e => e.id === req.eventId);
        const participant = participants.find(p => p.id === req.participantId);
        const eventDuration = event && event.eventDates ? event.eventDates.length : 0;
        const daysAttended = participant && event?.checkedInParticipants?.[participant.id] ? Object.keys(event.checkedInParticipants[participant.id]).length : 0;
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
        "date", "participantName", "eventName", "eventStartDate", "eventEndDate", "eventFacilitator",
        "eventAttendance", "location", "mileageTotal", "accommodationTotal", "outOfOfficeAllowance", 
        "totalPerdiem", "status", "mpesaTransactionCode"
    ];
    const columnHeaders = [
        "Request Date", "Participant Name", "Event", "Event Start", "Event End", "Facilitator",
        "Attendance (Days)", "Location", "Mileage (Ksh)", "Accommodation (Ksh)", "Allowance (Ksh)",
        "Total Amount (Ksh)", "Status", "M-Pesa Code"
    ];
    const csvData = toCSV(detailedData, columns, columnHeaders);
    downloadCSV(csvData, `${reportName}_report.csv`);
  };

  const handleDownloadCheckinReport = (event: AppEvent) => {
    const eventDays = getEventDays(event);
    const dateColumns = eventDays.map(day => format(day, 'yyyy-MM-dd'));
    const dateHeaders = eventDays.map(day => format(day, 'MMM d'));

    const allocatedParticipants = participants.filter(p => event.allocatedParticipants.includes(p.id));

    const reportData = allocatedParticipants.map(participant => {
        const row: {[key: string]: any} = {
            participantId: participant.id,
            participantName: participant.name,
        };

        let checkedInCount = 0;
        dateColumns.forEach(dateString => {
            const isCheckedIn = !!event.checkedInParticipants?.[participant.id]?.[dateString];
            row[dateString] = isCheckedIn ? 'Checked-In' : 'Absent';
            if (isCheckedIn) checkedInCount++;
        });
        
        row.attendancePercentage = eventDays.length > 0 ? `${Math.round((checkedInCount / eventDays.length) * 100)}%` : '0%';

        return row;
    });

    const columns = ['participantName', 'participantId', ...dateColumns, 'attendancePercentage'];
    const headers = ['Participant Name', 'Participant ID', ...dateHeaders, 'Attendance %'];

    const csvData = toCSV(reportData, columns, headers);
    downloadCSV(csvData, `check-in-report_${event.name.replace(/\s+/g, '-')}.csv`);
  };

  const nonAdminParticipants = participants.filter(p => p.role !== 'Admin');

  const handleSelectParticipant = useCallback((participantId: string) => {
    setEventFormData(prev => {
        const newSelection = prev.allocatedParticipants.includes(participantId)
            ? prev.allocatedParticipants.filter(id => id !== participantId)
            : [...prev.allocatedParticipants, participantId];
        return { ...prev, allocatedParticipants: newSelection };
    });
  }, []);

  const handleSelectAllParticipants = (check: boolean | string) => {
     if (check) {
        setEventFormData(prev => ({ ...prev, allocatedParticipants: nonAdminParticipants.map(p => p.id) }));
     } else {
        setEventFormData(prev => ({ ...prev, allocatedParticipants: [] }));
     }
  };
  
  const getTotalCheckinsForEvent = (event: AppEvent) => {
    if (!event.checkedInParticipants) return 0;
    return Object.values(event.checkedInParticipants).reduce((total, dailyCheckins) => total + Object.keys(dailyCheckins).length, 0);
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

  const getBadgeVariant = (status: PerdiemRequest['status']) => {
    switch (status) {
        case 'Pending': return 'outline';
        case 'Approved': return 'secondary';
        case 'Paid': return 'default';
        case 'Confirmed': return 'success';
        case 'Rejected': return 'destructive';
        default: return 'outline';
    }
   };
  
    const handleParticipantFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setParticipantFile(file);

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
            
            const [headers, ...rows] = data as string[][];
            const nameIndex = headers.findIndex(h => h.toLowerCase().includes('name'));
            const phoneIndex = headers.findIndex(h => h.toLowerCase().includes('phone'));

            if (nameIndex === -1 || phoneIndex === -1) {
                toast({
                    title: "Invalid File Format",
                    description: "Excel file must contain 'Name' and 'Phone' columns.",
                    variant: "destructive"
                });
                setParticipantFile(null);
                return;
            }

            const parsedParticipants: UnregisteredParticipant[] = rows.map(row => ({
                name: row[nameIndex] || '',
                phoneNumber: String(row[phoneIndex] || '').replace(/\D/g, '').slice(-9), // Extract last 9 digits
            })).filter(p => p.name && p.phoneNumber && p.phoneNumber.length === 9);

            setUploadedParticipants(parsedParticipants);
            toast({
                title: "File Processed",
                description: `${parsedParticipants.length} participants parsed from the file.`
            });
        };
        reader.readAsBinaryString(file);
    };

    const totalAssignedCount = useMemo(() => {
        const manualIds = new Set(eventFormData.allocatedParticipants);
        uploadedParticipants.forEach(up => {
            const existingParticipant = participants.find(p => p.phoneNumber.slice(-9) === up.phoneNumber);
            if (existingParticipant) {
                manualIds.add(existingParticipant.id);
            }
        });
        const uploadedNewCount = uploadedParticipants.filter(up => !participants.some(p => p.phoneNumber.slice(-9) === up.phoneNumber)).length;
        return manualIds.size + uploadedNewCount;
    }, [eventFormData.allocatedParticipants, uploadedParticipants, participants]);
    
    const FileUploadDisplay = ({ file, onClear, label }: { file: File | null; onClear: () => void; label: string; }) => {
        return (
            <div>
                <Label>{label}</Label>
                <div className="flex items-center justify-between p-3 border rounded-lg bg-gray-50 dark:bg-muted/20 mt-2">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <FileIcon className="h-6 w-6 text-gray-600 flex-shrink-0"/>
                        <div className="truncate">
                           <span className="text-sm font-medium">{file?.name}</span>
                        </div>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={onClear}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        );
    }


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
            <TabsTrigger value="participants">Participants</TabsTrigger>
            <TabsTrigger value="venues">Venues</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>
        </div>
        <TabsContent value="requests">
          <Card>
            <CardHeader><CardTitle>Perdiem Requests</CardTitle><CardDescription>Overview of all submitted per diem requests.</CardDescription></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                    <TableHeader><TableRow><TableHead>Participant</TableHead><TableHead>Event</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Amount</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
                    <TableBody>
                    {loading ? <TableRow><TableCell colSpan={6} className="h-24 text-center">Loading requests...</TableCell></TableRow> : perdiemRequests.map(request => (
                        <TableRow key={request.id}>
                        <TableCell><div className="font-medium">{request.participantName}</div><div className="hidden text-sm text-muted-foreground md:inline">ID: {request.participantId}</div></TableCell>
                        <TableCell>{request.eventName}</TableCell>
                        <TableCell><Badge variant={getBadgeVariant(request.status)}>{request.status}</Badge></TableCell>
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
                                        <DropdownMenuItem onSelect={() => updateRequestStatus(request.id, 'Approved')} disabled={request.status !== 'Pending'}>
                                            Approve
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onSelect={() => updateRequestStatus(request.id, 'Rejected')} disabled={request.status === 'Rejected' || request.status === 'Paid' || request.status === 'Confirmed'}>
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
                    <DialogContent className="sm:max-w-3xl flex flex-col max-h-[90vh]">
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

                                <Separator />

                                <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-4">
                                    <Label className="text-left sm:text-right">Event Documents</Label>
                                     <div className="col-span-3 space-y-4">
                                        {!programFile ? (
                                            <div>
                                                <Label htmlFor="program-upload" className="text-sm font-normal">Event Program (PDF)</Label>
                                                <Input id="program-upload" type="file" className="mt-1" onChange={(e) => setProgramFile(e.target.files?.[0] || null)} accept=".pdf" />
                                            </div>
                                        ) : (
                                            <FileUploadDisplay file={programFile} onClear={() => setProgramFile(null)} label="Event Program (PDF)" />
                                        )}
                                         {!letterFile ? (
                                            <div>
                                                <Label htmlFor="letter-upload" className="text-sm font-normal">Event Letter (PDF) <span className="text-destructive">*</span></Label>
                                                <Input id="letter-upload" type="file" className="mt-1" onChange={(e) => setLetterFile(e.target.files?.[0] || null)} accept=".pdf" />
                                            </div>
                                        ) : (
                                            <FileUploadDisplay file={letterFile} onClear={() => setLetterFile(null)} label="Event Letter (PDF)" />
                                        )}
                                    </div>
                                </div>


                                <Separator />

                                <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-4">
                                    <div className="text-left sm:text-right">
                                        <Label>Assign Participants</Label>
                                        <p className="text-xs text-muted-foreground">Total assigned: {totalAssignedCount}</p>
                                    </div>
                                    <div className="col-span-3 space-y-4">
                                        <div>
                                            <h4 className="font-medium text-sm mb-2">Option 1: Bulk Upload</h4>
                                            {!participantFile ? (
                                                <Label htmlFor="bulk-upload" className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 dark:bg-muted/20 dark:hover:bg-muted/40">
                                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                        <Upload className="w-8 h-8 mb-2 text-gray-500" />
                                                        <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">Upload Excel/CSV</span></p>
                                                    </div>
                                                    <Input id="bulk-upload" type="file" className="hidden" onChange={handleParticipantFileUpload} accept=".xlsx, .xls, .csv" />
                                                </Label>
                                            ) : (
                                               <FileUploadDisplay file={participantFile} onClear={() => { setParticipantFile(null); setUploadedParticipants([]); }} label="Bulk Participants" />
                                            )}
                                        </div>

                                        <div className="relative">
                                          <Separator />
                                          <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-background px-2 text-xs text-muted-foreground">OR</span>
                                        </div>

                                        <div>
                                             <h4 className="font-medium text-sm mb-2">Option 2: Manually Select</h4>
                                             <Popover open={isParticipantSelectOpen} onOpenChange={setParticipantSelectOpen}>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                                                        <ChevronsUpDown className="mr-2 h-4 w-4" />
                                                        {eventFormData.allocatedParticipants.length > 0 ? `${eventFormData.allocatedParticipants.length} selected` : "Select registered participants"}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                                    <Command>
                                                        <CommandInput placeholder="Search participants..." />
                                                        <CommandList>
                                                            <CommandEmpty>No participants found.</CommandEmpty>
                                                            <CommandGroup>
                                                                <CommandItem
                                                                    onSelect={() => handleSelectAllParticipants(!(eventFormData.allocatedParticipants.length === nonAdminParticipants.length))}
                                                                    className="cursor-pointer"
                                                                >
                                                                    <Checkbox
                                                                        className="mr-2"
                                                                        checked={eventFormData.allocatedParticipants.length > 0 && eventFormData.allocatedParticipants.length === nonAdminParticipants.length}
                                                                        onCheckedChange={(checked) => handleSelectAllParticipants(checked)}
                                                                    />
                                                                    <span>Select All</span>
                                                                </CommandItem>
                                                            </CommandGroup>
                                                            <CommandSeparator />
                                                            <CommandGroup>
                                                                {nonAdminParticipants.map((participant) => (
                                                                    <CommandItem
                                                                        key={participant.id}
                                                                        onSelect={() => handleSelectParticipant(participant.id)}
                                                                        className="cursor-pointer"
                                                                    >
                                                                        <Checkbox
                                                                            className="mr-2"
                                                                            checked={eventFormData.allocatedParticipants.includes(participant.id)}
                                                                            onCheckedChange={() => handleSelectParticipant(participant.id)}
                                                                        />
                                                                        <span>{participant.name}</span>
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
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader><TableRow><TableHead>Event Name</TableHead><TableHead>Venue</TableHead><TableHead>Dates</TableHead><TableHead>Attachments</TableHead><TableHead>Assigned</TableHead><TableHead>Attendance</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
                        <TableBody>
                            {loading ? <TableRow><TableCell colSpan={7} className="h-24 text-center">Loading events...</TableCell></TableRow> 
                            : events.map((event) => {
                                const lastEventDate = event.eventDates?.length ? parseISO(event.eventDates[event.eventDates.length - 1]) : new Date(0);
                                const isEventPast = isPast(endOfDay(lastEventDate));
                                const totalAssigned = event.allocatedParticipants.length + (event.unregisteredParticipants?.length || 0);
                                const hasApprovedRequests = perdiemRequests.some(r => r.eventId === event.id && r.status === 'Approved');

                                return (
                                    <TableRow key={event.id}>
                                        <TableCell className="font-medium">{event.name}</TableCell>
                                        <TableCell>{event.venueName}</TableCell>
                                        <TableCell className="whitespace-nowrap">{(event.eventDates || []).join(', ')}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {event.programFilename && <Paperclip className="h-4 w-4 text-muted-foreground" title="Program attached" />}
                                                {event.letterFilename && <FileIcon className="h-4 w-4 text-muted-foreground" title="Letter attached" />}
                                            </div>
                                        </TableCell>
                                        <TableCell>{totalAssigned}</TableCell>
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
                                                    <DropdownMenuItem onSelect={() => handleOpenQrDialog(event)}>
                                                        Generate QR Code
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onSelect={() => handleOpenBulkPaidDialog(event)} disabled={!hasApprovedRequests}>
                                                        Mark Event Paid
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
                                const allocatedParticipants = participants.filter(p => event.allocatedParticipants.includes(p.id));

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
                                                                <TableHead>Participant</TableHead>
                                                                {eventDays.map(day => (
                                                                    <TableHead key={format(day, 'yyyy-MM-dd')} className="text-center whitespace-nowrap">{format(day, 'MMM d')}</TableHead>
                                                                ))}
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {allocatedParticipants.map(participant => (
                                                                <TableRow key={participant.id}>
                                                                    <TableCell className="whitespace-nowrap">{participant.name}</TableCell>
                                                                    {eventDays.map(day => {
                                                                        const dateString = format(day, 'yyyy-MM-dd');
                                                                        const isCheckedIn = !!event.checkedInParticipants?.[participant.id]?.[dateString];
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

        <TabsContent value="participants">
          <Card>
            <CardHeader><CardTitle>Participants</CardTitle><CardDescription>A list of all registered participants.</CardDescription></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                    <TableHeader><TableRow><TableHead className="w-[64px]"><span className="sr-only">Image</span></TableHead><TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead>Duty Station</TableHead><TableHead>Job Group</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
                    <TableBody>
                    {loading ? <TableRow><TableCell colSpan={6} className="h-24 text-center">Loading participants...</TableCell></TableRow> : participants.map(participant => (
                        <TableRow key={participant.id}>
                        <TableCell><Image alt="Participant avatar" className="aspect-square rounded-full object-cover" height="40" src={participant.avatarUrl} width="40" data-ai-hint="person portrait"/></TableCell>
                        <TableCell className="font-medium whitespace-nowrap">{participant.name}<div className="text-sm text-muted-foreground">{participant.participantNumber}</div></TableCell>
                        <TableCell>{participant.role}</TableCell>
                        <TableCell>{participant.dutyStation}</TableCell>
                        <TableCell>{participant.jobGroup}</TableCell>
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
                                    <DropdownMenuItem onSelect={() => handleOpenParticipantDialog(participant)}>Edit</DropdownMenuItem>
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
                <div className="overflow-x-auto">
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
                                <Label htmlFor="participant-filter">Participant</Label>
                                <Select value={filters.participant} onValueChange={(v) => setFilters(f => ({ ...f, participant: v }))}>
                                    <SelectTrigger><SelectValue placeholder="Select Participant" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Participants</SelectItem>
                                        {nonAdminParticipants.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
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
                             data={filteredReportData.filter(r => r.status === 'Paid' || r.status === 'Confirmed')}
                             loading={loading}
                             onDownload={() => handleDownloadPerDiemReport(filteredReportData.filter(r => r.status === 'Paid' || r.status === 'Confirmed'), 'paid_perdiems')}
                             isPaidReport={true}
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
    
    <Dialog open={isParticipantDialogOpen} onOpenChange={setIsParticipantDialogOpen}>
        <DialogContent className="sm:max-w-2xl flex flex-col max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Edit Participant</DialogTitle>
            <DialogDescription>Update the details for {editingParticipant?.name}.</DialogDescription>
          </DialogHeader>
           <div className="flex-1 overflow-y-auto pr-6 -mr-6 space-y-6">
                {editingParticipant && (
                    <PerDiemBalanceCard 
                        participant={editingParticipant}
                        events={participantEvents}
                        requests={participantRequests}
                        venues={venues}
                    />
                )}
                <div className="space-y-4 py-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Full Name</Label>
                            <Input id="name" value={participantFormData.name || ''} onChange={(e) => setParticipantFormData(prev => ({ ...prev, name: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phoneNumber">Phone Number</Label>
                            <Input id="phoneNumber" value={participantFormData.phoneNumber || ''} onChange={(e) => setParticipantFormData(prev => ({ ...prev, phoneNumber: e.target.value }))} />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="space-y-2">
                            <Label htmlFor="idNumber">ID Number</Label>
                            <Input id="idNumber" value={participantFormData.idNumber || ''} onChange={(e) => setParticipantFormData(prev => ({ ...prev, idNumber: e.target.value }))} />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="gender">Gender</Label>
                            <Select value={participantFormData.gender} onValueChange={(value) => setParticipantFormData(prev => ({ ...prev, gender: value }))}>
                                <SelectTrigger id="gender"><SelectValue placeholder="Select gender" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="male">Male</SelectItem>
                                    <SelectItem value="female">Female</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {editingParticipant?.role !== 'Admin' && (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="participantNumber">Employee Number</Label>
                                    <Input id="participantNumber" value={participantFormData.participantNumber || ''} onChange={(e) => setParticipantFormData(prev => ({ ...prev, participantNumber: e.target.value }))} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="dutyStation">Duty Station</Label>
                                    <Select value={participantFormData.dutyStation} onValueChange={(value) => setParticipantFormData(prev => ({ ...prev, dutyStation: value }))}>
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
                                    <Select value={participantFormData.jobGroup} onValueChange={(value) => setParticipantFormData(prev => ({ ...prev, jobGroup: value }))}>
                                        <SelectTrigger id="jobGroup"><SelectValue placeholder="Select a job group" /></SelectTrigger>
                                        <SelectContent>
                                            {jobGroups.map((group) => (<SelectItem key={group} value={group}>{group}</SelectItem>))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="role">Role/Designation</Label>
                                    <Select value={participantFormData.role} onValueChange={(value) => setParticipantFormData(prev => ({ ...prev, role: value }))}>
                                        <SelectTrigger id="role"><SelectValue placeholder="Select a designation" /></SelectTrigger>
                                        <SelectContent>
                                            {designations.map((d) => (<SelectItem key={d} value={d}>{d}</SelectItem>))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </>
                    )}
                     {editingParticipant?.role === 'Admin' && (
                        <div className="space-y-2">
                            <Label htmlFor="organizationName">Organization Name</Label>
                            <Input id="organizationName" value={participantFormData.organizationName || ''} onChange={(e) => setParticipantFormData(prev => ({ ...prev, organizationName: e.target.value }))} />
                        </div>
                    )}
                </div>
            </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsParticipantDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveParticipant} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
    </Dialog>
    <SuccessDialog
        isOpen={isSuccessDialogOpen}
        onClose={() => setIsSuccessDialogOpen(false)}
        event={successDialogData?.event}
    />
    <Dialog open={isBulkPaidDialogOpen} onOpenChange={setIsBulkPaidDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bulk Payment for {bulkPaidEvent?.name}</DialogTitle>
          <DialogDescription>
            Enter a single M-Pesa code to mark all approved per diems for this event as paid.
          </DialogDescription>
        </DialogHeader>
         <div className="space-y-4 py-4">
            {approvedRequestsForBulkPay.length > 0 ? (
                <>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="mpesa-code" className="text-right">
                        M-Pesa Code
                        </Label>
                        <Input
                        id="mpesa-code"
                        value={bulkMpesaCode}
                        onChange={(e) => setBulkMpesaCode(e.target.value.toUpperCase())}
                        className="col-span-3"
                        placeholder="e.g., SDE8A4D2F1"
                        />
                    </div>
                     <div className="max-h-60 overflow-y-auto space-y-2 rounded-md border p-4">
                        <h4 className="font-medium text-sm">Approved Requests ({approvedRequestsForBulkPay.length})</h4>
                        <p className="text-sm text-muted-foreground">Total: {formatCurrency(approvedRequestsForBulkPay.reduce((sum, r) => sum + r.totalPerdiem, 0))}</p>
                        {approvedRequestsForBulkPay.map(req => (
                             <div key={req.id} className="flex justify-between items-center text-sm">
                                <span>{req.participantName}</span>
                                <span>{formatCurrency(req.totalPerdiem)}</span>
                            </div>
                        ))}
                    </div>
                </>
            ) : (
                <p className="text-center text-muted-foreground">There are no approved per diem requests for this event.</p>
            )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsBulkPaidDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmBulkPaid} disabled={approvedRequestsForBulkPay.length === 0}>Confirm Bulk Payment</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

// Helper component for the report tabs to reduce repetition
function ReportTabContent({ title, data, loading, onDownload, isPaidReport = false }: { title: string, data: PerdiemRequest[], loading: boolean, onDownload: () => void, isPaidReport?: boolean }) {
    const getBadgeVariant = (status: PerdiemRequest['status']) => {
        switch (status) {
            case 'Pending': return 'outline';
            case 'Approved': return 'secondary';
            case 'Paid': return 'default';
            case 'Confirmed': return 'success';
            case 'Rejected': return 'destructive';
            default: return 'outline';
        }
    };
    
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
                 <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Participant</TableHead>
                                <TableHead>Event</TableHead>
                                {isPaidReport ? (
                                    <>
                                        <TableHead>Confirmation</TableHead>
                                        <TableHead>M-Pesa Code</TableHead>
                                    </>
                                ) : (
                                    <TableHead>Status</TableHead>
                                )}
                                <TableHead>Date</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={isPaidReport ? 6 : 5} className="h-24 text-center">Loading report data...</TableCell></TableRow>
                        ) : data.length === 0 ? (
                             <TableRow><TableCell colSpan={isPaidReport ? 6 : 5} className="h-24 text-center">No requests match the current filters.</TableCell></TableRow>
                        ) : data.map(request => (
                            <TableRow key={request.id}>
                            <TableCell>{request.participantName}</TableCell>
                            <TableCell>{request.eventName}</TableCell>
                             {isPaidReport ? (
                                <>
                                    <TableCell><Badge variant={getBadgeVariant(request.status)}>{request.status}</Badge></TableCell>
                                    <TableCell className="font-mono">{request.mpesaTransactionCode || '-'}</TableCell>
                                </>
                            ) : (
                                <TableCell><Badge variant={getBadgeVariant(request.status)}>{request.status}</Badge></TableCell>
                            )}
                            <TableCell className="whitespace-nowrap">{request.date}</TableCell>
                            <TableCell className="text-right whitespace-nowrap">{formatCurrency(request.totalPerdiem)}</TableCell>
                            </TableRow>
                        ))}
                        </TableBody>
                    </Table>
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
      Confirmed: '#22c55e',
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

function SuccessDialog({ isOpen, onClose, event }: { isOpen: boolean; onClose: () => void; event: AppEvent | undefined }) {
    const qrCodeRef = useRef<HTMLDivElement>(null);

    if (!event) return null;

    const { name: eventName, id: eventId, eventDates } = event;
    const checkinUrl = typeof window !== 'undefined' ? `${window.location.origin}/dashboard?tab=checkins&eventId=${eventId}` : '';
    const dateString = (eventDates || []).join(', ');

    const downloadQRCode = () => {
        const canvas = qrCodeRef.current?.querySelector('canvas');
        if (canvas) {
            const padding = 20;
            const textHeight = 60; // Space for two lines of text
            const newCanvas = document.createElement('canvas');
            newCanvas.width = canvas.width + padding * 2;
            newCanvas.height = canvas.height + padding * 2 + textHeight;
            const ctx = newCanvas.getContext('2d');
            
            if (ctx) {
                // Fill background with white
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, newCanvas.width, newCanvas.height);
                
                // Draw the QR code canvas onto the new canvas with padding
                ctx.drawImage(canvas, padding, padding + 10);

                // Add text below the QR code
                ctx.fillStyle = '#000000';
                ctx.textAlign = 'center';
                
                // Event Name
                ctx.font = '16px sans-serif';
                ctx.fillText(eventName, newCanvas.width / 2, canvas.height + padding + 30);

                // Event Dates
                ctx.font = '12px sans-serif';
                ctx.fillStyle = '#555555';
                ctx.fillText(dateString, newCanvas.width / 2, canvas.height + padding + 50);

                const pngUrl = newCanvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
                let downloadLink = document.createElement("a");
                downloadLink.href = pngUrl;
                downloadLink.download = `${eventName.replace(/\s+/g, '_').toLowerCase()}_qr_code.png`;
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
            }
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-center">Event QR Code</DialogTitle>
                    <DialogDescription className="text-center">Share this QR code with participants for easy check-in.</DialogDescription>
                </DialogHeader>
                <div className="flex flex-col items-center justify-center gap-4 py-4">
                    <div ref={qrCodeRef} className="p-4 bg-white rounded-lg inline-block">
                       <QRCodeCanvas value={checkinUrl} size={256} />
                    </div>
                     <div>
                        <p className="font-semibold text-lg text-center">{eventName}</p>
                        <p className="text-sm text-muted-foreground text-center">{dateString}</p>
                    </div>
                </div>
                <DialogFooter className="sm:justify-center gap-2">
                    <Button type="button" onClick={downloadQRCode}><Download className="mr-2 h-4 w-4" />Download</Button>
                    <Button type="button" variant="secondary" onClick={onClose}>Done</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

    





    


    



    

    
