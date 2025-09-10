import Link from "next/link";
import { PlusCircle, MoreHorizontal } from "lucide-react";

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
import { perdiemRequests } from "@/lib/data";

export default function EmployeeDashboard() {
  const userRequests = perdiemRequests.filter(req => req.employeeId === '1' || req.employeeId === '2');

  return (
    <div className="grid flex-1 items-start gap-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Welcome Back, John!</h1>
            <p className="text-muted-foreground">Here's a list of your recent perdiem requests.</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/request">
            <PlusCircle className="mr-2 h-4 w-4" />
            New Perdiem Request
          </Link>
        </Button>
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
