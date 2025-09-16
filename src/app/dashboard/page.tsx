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
import { useState, useEffect } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";

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
import type { PerdiemRequest, Venue, Employee } from "@/lib/data";
import { ReportDialog } from "@/components/report-dialog";
import { getPerDiemRequestsByEmployee, getVenues, getEmployeeById } from "@/lib/firebase/firestore";
import app from "@/lib/firebase/config";

const auth = getAuth(app);

/**
 * Converts an array of objects to a CSV formatted string.
 * @param {any[]} data - The array of objects to convert.
 * @param {string[]} columns - The columns to include in the CSV.
 * @param {string[]} columnHeaders - The display headers for the columns.
 * @returns {string} A string in CSV format.
 */
const toCSV = (data: any[], columns: string[], columnHeaders: string[]): string => {
  const header = columnHeaders.join(',') + '\n';
  const rows = data.map(row =>
    columns.map(colName => {
      let cellData = row[colName];
      // Handle cases where data might be missing or needs formatting
      if (cellData === null || cellData === undefined) {
        return '""';
      }
      // Escape commas and quotes
      cellData = String(cellData).replace(/"/g, '""');
      if (String(cellData).includes(',')) {
        cellData = `"${cellData}"`;
      }
      return cellData;
    }).join(',')
  ).join('\n');

  return header + rows;
};

/**
 * The main dashboard component for an employee.
 * It filters and displays per diem requests for the logged-in user.
 * @returns {JSX.Element} The rendered employee dashboard page.
 */
export default function EmployeeDashboard() {
  const [userRequests, setUserRequests] = useState<PerdiemRequest[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setAuthUser(user);
      } else {
        // Redirect to login if not authenticated
        // router.push('/');
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    async function fetchData() {
      if (!authUser) return;

      setLoading(true);
      try {
        const [userData, requests, venuesData] = await Promise.all([
          getEmployeeById(authUser.uid),
          getPerDiemRequestsByEmployee(authUser.uid),
          getVenues()
        ]);
        
        setCurrentUser(userData);
        setUserRequests(requests);
        setVenues(venuesData);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [authUser]);
  

  /**
   * Generates and downloads a report of the user's per diem requests.
   * @param {PerdiemRequest[]} filteredData - The data to include in the report, pre-filtered by the ReportDialog.
   * @param {'pdf' | 'csv'} format - The desired report format.
   */
  const handleDownloadReport = (filteredData: PerdiemRequest[], format: 'pdf' | 'csv') => {
    if (format === 'pdf') {
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
    } else if (format === 'csv') {
      const columns = ["date", "eventName", "location", "totalPerdiem", "status"];
      const columnHeaders = ["Date", "Event", "Location", "Amount (Ksh)", "Status"];
      const csvData = toCSV(filteredData, columns, columnHeaders);
      
      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'my_perdiem_requests_report.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const getFirstName = (name: string | undefined) => {
    if (!name) return "";
    return name.split(" ")[0];
  };


  return (
    <div className="grid flex-1 items-start gap-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Welcome Back, {getFirstName(currentUser?.name)}!</h1>
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
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    Loading your requests...
                  </TableCell>
                </TableRow>
              ) : userRequests.map((request) => (
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
                      request.status === "Approved" ? "secondary" :
                      request.status === "Pending" ? "outline" : "destructive"
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
