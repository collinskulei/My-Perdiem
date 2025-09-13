
"use client";

import { useState } from "react";
import { Download, Calendar as CalendarIcon } from "lucide-react";
import { DateRange } from "react-day-picker";
import { format, isWithinInterval, parseISO } from "date-fns";

import { Button } from "@/components/ui/button";
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
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { PerdiemRequest, Venue } from "@/lib/data";

interface ReportDialogProps {
  reportData: PerdiemRequest[];
  venues: Venue[];
  onDownload: (filteredData: PerdiemRequest[]) => void;
}

export function ReportDialog({ reportData, venues, onDownload }: ReportDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [date, setDate] = useState<DateRange | undefined>();
  const [venue, setVenue] = useState<string>("all");

  const handleGenerateReport = () => {
    let filteredData = reportData;

    if (date?.from && date?.to) {
      filteredData = filteredData.filter(item => {
        const itemDate = new Date(item.date);
        return isWithinInterval(itemDate, { start: date.from!, end: date.to! });
      });
    }

    if (venue !== "all") {
        const selectedVenue = venues.find(v => v.id === venue);
        if (selectedVenue) {
            filteredData = filteredData.filter(item => item.location === selectedVenue.city);
        }
    }
    
    onDownload(filteredData);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <Download className="mr-2 h-4 w-4" />
          Download Report
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate Report</DialogTitle>
          <DialogDescription>
            Filter the data for your report and download it as a PDF.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="date-range" className="text-right">
              Date Range
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant={"outline"}
                  className={cn(
                    "w-[240px] justify-start text-left font-normal col-span-3",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date?.from ? (
                    date.to ? (
                      <>
                        {format(date.from, "LLL dd, y")} -{" "}
                        {format(date.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(date.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={date?.from}
                  selected={date}
                  onSelect={setDate}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="venue-filter" className="text-right">
              Venue
            </Label>
            <Select value={venue} onValueChange={setVenue}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select a venue" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Venues</SelectItem>
                {venues.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name} ({v.city})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleGenerateReport}>Generate PDF</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
