/**
 * @file This file defines the ReportDialog component.
 * It's a reusable dialog that allows users to filter data by date range and venue,
 * and then trigger a download action to generate a PDF or CSV report.
 */
"use client";

import { useState } from "react";
import { Download, Calendar as CalendarIcon } from "lucide-react";
import { DateRange } from "react-day-picker";
import { format, isWithinInterval } from "date-fns";

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

/**
 * Props for the ReportDialog component.
 */
interface ReportDialogProps {
  /** The full dataset of per diem requests to be filtered. */
  reportData: PerdiemRequest[];
  /** A list of available venues for the filter dropdown. */
  venues: Venue[];
  /** Callback function that is triggered to download the report with the filtered data. */
  onDownload: (filteredData: PerdiemRequest[], format: 'pdf' | 'csv') => void;
}

/**
 * A dialog component for generating filtered reports.
 * @param {ReportDialogProps} props - The properties for the component.
 * @returns {JSX.Element} The rendered report dialog.
 */
export function ReportDialog({ reportData, venues, onDownload }: ReportDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [date, setDate] = useState<DateRange | undefined>();
  const [venue, setVenue] = useState<string>("all");

  /**
   * Handles the report generation process.
   * It filters the `reportData` based on the selected date range and venue,
   * then calls the `onDownload` callback with the filtered results and the chosen format.
   * @param {'pdf' | 'csv'} format - The desired report format.
   */
  const handleGenerateReport = (format: 'pdf' | 'csv') => {
    let filteredData = reportData;

    // Filter by date range if selected
    if (date?.from && date?.to) {
      filteredData = filteredData.filter(item => {
        const itemDate = new Date(item.date);
        return isWithinInterval(itemDate, { start: date.from!, end: date.to! });
      });
    }

    // Filter by venue if 'All Venues' is not selected
    if (venue !== "all") {
        const selectedVenue = venues.find(v => v.id === venue);
        if (selectedVenue) {
            filteredData = filteredData.filter(item => item.location === selectedVenue.city);
        }
    }
    
    // Trigger the download with the filtered data and close the dialog
    onDownload(filteredData, format);
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
            Filter the data for your report and download it as a PDF or CSV.
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
          <Button onClick={() => handleGenerateReport('csv')} variant="outline">Generate CSV</Button>
          <Button onClick={() => handleGenerateReport('pdf')}>Generate PDF</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
