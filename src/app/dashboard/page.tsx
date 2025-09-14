/**
 * @file This file defines the main dashboard page for an authenticated employee.
 * It displays a welcome message and a table of the user's recent per diem requests.
 * It also provides options to create a new request or download a report of existing requests.
 */
"use client";

import Link from "next/link";
import { PlusCircle } from "lucide-react";
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
  CardFooter
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { perdiemRequests, venues } from "@/lib/data";
import type { PerdiemRequest } from "@/lib/data";
import { ReportDialog } from "@/components/report-dialog";

/**
 * The main dashboard component for an employee.
 * It filters and displays per diem requests for the logged-in user.
 * @returns {JSX.Element} The rendered employee dashboard page.
 */
export default function EmployeeDashboard() {
  // Filters requests to show only those belonging to the current user (mocked as user '1' or '2').
  const userRequests = perdiemRequests.filter(req => req.employeeId === '1' || req.employeeId === '2');

  /**
   * Generates and downloads a PDF report of the user's per diem requests.
   * @param {PerdiemRequest[]} filteredData - The data to include in the report, pre-filtered by the ReportDialog.
   */
  const handleDownloadReport = (filteredData: PerdiemRequest[]) => {
    const doc = new jsPDF();
    doc.text("My Perdiem Requests Report", 14, 16);
    
    const tableColumn = ["Date", "Event", "Location", "Amount", "Status"];
    const tableRows: (string | number)[][] = [];

    filteredData.forEach(request => {
      const requestData = [
        request.date,
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
    
    doc.save("my_perdiem_requests_report.pdf");
  };

  return (
    <div className="grid flex-1 items-start gap-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Welcome Back, John!</h1>
            <p className="text-muted-foreground">Here's a list of your recent perdiem requests.</p>
        </div>
        <div className="flex items-center gap-2">
            {/* ReportDialog handles filtering logic and triggers onDownload */}
            <ReportDialog 
              reportData={userRequests}
              venues={venues}
              onDownload={handleDownloadReport}
            />
            <Button asChild>
              <Link href="/dashboard/request">
                <PlusCircle className="mr-2 h-4 w-4" />
                New Perdiem Request
              </Link>
            </Button>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recent Requests</CardTitle>
          <CardDescription>
            Your perdiem requests from the last 90 days.
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
              {userRequests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>
                    <div className="font-medium">{request.eventName}</div>
                    <div className="hidden text-sm text-muted-foreground md:inline">
                      {request.location}
                    </div>
                  </TableCell>
                  <TableCell>
                    {/* Badge color changes based on request status */}
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter className="flex justify-center border-t p-4">
          <Button size="sm" variant="ghost">View All Requests</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
