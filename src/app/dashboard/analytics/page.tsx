/**
 * @file This file defines the Analytics page for employees.
 * It provides data visualizations for their personal per diem requests.
 */
"use client";

import { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

import type { PerdiemRequest } from '@/lib/data';
import * as firestore from '@/lib/firebase/firestore';
import * as mock from '@/lib/mock-data';
import { isTestMode } from '@/lib/test-mode';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import app from "@/lib/firebase/config";

const dataProvider = isTestMode() ? mock : firestore;
const auth = getAuth(app);
const TEST_USER_ID_KEY = 'perdiem-pro-test-user-id';

type MockUser = { uid: string };

const COLORS = {
  Pending: '#f97316', // orange-500
  Approved: '#10b981', // emerald-500
  Paid: '#3b82f6', // blue-500
  Rejected: '#ef4444', // red-500
};

export default function EmployeeAnalyticsPage() {
  const [requests, setRequests] = useState<PerdiemRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [authUser, setAuthUser] = useState<User | MockUser | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isTestMode()) {
        const testUserId = localStorage.getItem(TEST_USER_ID_KEY);
        setAuthUser(testUserId ? { uid: testUserId } : null);
    } else {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setAuthUser(user);
        });
        return () => unsubscribe();
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
        if (!authUser) {
            setLoading(false);
            return;
        };

        setLoading(true);
        try {
            const requestsData = await dataProvider.getPerDiemRequestsByEmployee(authUser.uid);
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
  }, [authUser, toast]);

  const requestsByStatus = requests.reduce((acc, req) => {
    acc[req.status] = (acc[req.status] || 0) + 1;
    return acc;
  }, {} as { [key: string]: number });

  const pieChartData = Object.entries(requestsByStatus).map(([name, value]) => ({ name, value }));

  const totalPaid = requests
    .filter(req => req.status === 'Paid')
    .reduce((sum, req) => sum + req.totalPerdiem, 0);

  if (loading) {
    return <div className="text-center p-10">Loading analytics...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">My Analytics</h1>
        <p className="text-muted-foreground">An overview of your per diem request history.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>My Total Requests</CardTitle>
            <CardDescription>All per diem requests you have submitted.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{requests.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Paid to You</CardTitle>
            <CardDescription>The total amount for all your paid per diems.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{formatCurrency(totalPaid)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>My Requests by Status</CardTitle>
          </CardHeader>
          <CardContent>
             {pieChartData.length > 0 ? (
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
             ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    You have not submitted any requests yet.
                </div>
             )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
