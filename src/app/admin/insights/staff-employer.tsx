"use client";

import { useMemo, useRef } from "react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { Users } from "lucide-react";
import type { PerdiemRequest, Participant } from "@/lib/data";
import { ChartCard, SectionHeader, EmptyState, STATUS_COLORS, paletteColor, glassTooltipStyle, downloadSectionAsPdf } from "./shared";

const STAFF_CATEGORIES = [
  { key: "dhaStaff", label: "DHA" },
  { key: "mohStaff", label: "MOH" },
  { key: "knhStaff", label: "KNH" },
  { key: "shaStaff", label: "SHA" },
  { key: "otherStaff", label: "Other" },
] as const;

function topCounts(values: (string | undefined)[], limit = 10) {
  const counts = new Map<string, number>();
  for (const v of values) {
    if (!v) continue;
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

export function StaffEmployerSection({ requests, participants }: { requests: PerdiemRequest[]; participants: Participant[] }) {
  const staffCatRef = useRef<HTMLDivElement>(null);
  const employerRef = useRef<HTMLDivElement>(null);
  const jobGroupRef = useRef<HTMLDivElement>(null);
  const designationRef = useRef<HTMLDivElement>(null);
  const stackedRef = useRef<HTMLDivElement>(null);

  const data = useMemo(() => {
    const staffCategoryData = STAFF_CATEGORIES
      .map(c => ({ name: c.label, value: requests.filter(r => r[c.key] === true).length }))
      .filter(d => d.value > 0);

    const employerData = topCounts(requests.map(r => r.employer));
    const jobGroupData = topCounts(participants.map(p => p.jobGroup));
    const designationData = topCounts(participants.map(p => p.designation));

    const statuses = Array.from(new Set(requests.map(r => r.status)));
    const stackedData = STAFF_CATEGORIES.map(c => {
      const row: Record<string, string | number> = { category: c.label };
      for (const status of statuses) {
        row[status] = requests.filter(r => r[c.key] === true && r.status === status).length;
      }
      return row;
    }).filter(row => statuses.some(s => (row[s] as number) > 0));

    return { staffCategoryData, employerData, jobGroupData, designationData, stackedData, statuses };
  }, [requests, participants]);

  if (requests.length === 0 && participants.length === 0) {
    return <EmptyState message="No staff/employer data yet - once requests and participants exist, this section fills in automatically." />;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Users}
        title="Staff & Employer"
        description="Who's being paid, broken down by organization and role."
        onDownloadSection={() => downloadSectionAsPdf([
          { ref: staffCatRef, title: "Staff Category Breakdown" },
          { ref: employerRef, title: "Employer Breakdown" },
          { ref: jobGroupRef, title: "Job Group Breakdown" },
          { ref: designationRef, title: "Designation Breakdown" },
          { ref: stackedRef, title: "Staff Category by Status" },
        ], "staff-employer-insights")}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Staff Category Breakdown" chartRef={staffCatRef} filename="staff-category-breakdown">
          {data.staffCategoryData.length === 0 ? <EmptyState message="No staff-category data yet." /> : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={data.staffCategoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {data.staffCategoryData.map((_, i) => <Cell key={i} fill={paletteColor(i)} />)}
                </Pie>
                <Tooltip {...glassTooltipStyle} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Employer Breakdown (Top 10)" chartRef={employerRef} filename="employer-breakdown">
          {data.employerData.length === 0 ? <EmptyState message="No employer data yet." /> : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.employerData} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={110} />
                <Tooltip {...glassTooltipStyle} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {data.employerData.map((_, i) => <Cell key={i} fill={paletteColor(i)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Job Group Breakdown" chartRef={jobGroupRef} filename="job-group-breakdown">
          {data.jobGroupData.length === 0 ? <EmptyState message="No job group data yet." /> : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.jobGroupData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip {...glassTooltipStyle} />
                <Bar dataKey="value" name="Participants" fill={paletteColor(1)} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Designation Breakdown" chartRef={designationRef} filename="designation-breakdown">
          {data.designationData.length === 0 ? <EmptyState message="No designation data yet." /> : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.designationData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis allowDecimals={false} />
                <Tooltip {...glassTooltipStyle} />
                <Bar dataKey="value" name="Participants" fill={paletteColor(4)} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <ChartCard title="Staff Category by Status" chartRef={stackedRef} filename="staff-category-by-status">
        {data.stackedData.length === 0 ? <EmptyState message="No staff-category data yet." /> : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data.stackedData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="category" />
              <YAxis allowDecimals={false} />
              <Tooltip {...glassTooltipStyle} />
              <Legend />
              {data.statuses.map((status) => (
                <Bar key={status} dataKey={status} stackId="status" fill={STATUS_COLORS[status] ?? paletteColor(0)} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}
