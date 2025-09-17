/**
 * @file This file defines the Analytics page for administrators.
 * It provides data visualizations for per diem requests and other key metrics.
 */
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, subDays } from 'date-fns';

import type { PerdiemRequest } from '@/lib/data';
import * as firestore from '@/lib/firebase/firestore';
import * as mock from '@/lib/mock-data';
import { isTestMode } from '@/lib/test-mode';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const dataProvider = isTestMode() ? mock : firestore;

const COLORS = {
  Pending: '#f97316', // orange-500
  Approved: '#10b981', // emerald-500
  Paid: '#3b82f6', // blue-500
  Rejected: '#ef4444', // red-500
};

export default function AnalyticsPage() {
  const [requests, setRequests] = useState<PerdiemRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const requestsData = await dataProvider.getPerDiemRequests();
        setRequests(requestsData);
      } catch (error) {
        console.error("Failed to fetch analytics data:", error);
        toast({
          title: "Error",
          description: "Could not load analytics data.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [toast]);

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

  if (loading) {
    return <div className="text-center p-10">Loading analytics...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">An overview of per diem request trends.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total Requests</CardTitle>
            <CardDescription>All per diem requests submitted.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{requests.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Paid Out</CardTitle>
            <CardDescription>The total amount for all paid per diems.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{formatCurrency(totalPaid)}</p>
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
                <Pie data={pieChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {pieChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[entry.name as keyof typeof COLORS]} />
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
              <BarChart data={last30Days}>
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
