/**
 * @file Super/Master Admin "Submissions" tab: a cross-client queue of
 * OneDrive-tracked documents (see docs/MILESTONE_HANDOFF.md's Milestone 5
 * section). Open a file directly in OneDrive, clean the data and pay
 * offline, import the clean sheet via the existing Historical Import
 * feature (unchanged), then mark the submission Processing/Done here -
 * that status is what the Client Admin sees reflected on their side.
 */
"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { useToast } from "@/hooks/use-toast";
import * as supabaseDb from "@/lib/supabase/database";
import type { Client, Document, Participant } from "@/lib/data";

const STATUS_LABELS: Record<Document["status"], string> = {
  submitted: "Submitted",
  processing: "Processing",
  done: "Done",
};

const STATUS_VARIANTS: Record<Document["status"], "secondary" | "default" | "outline"> = {
  submitted: "secondary",
  processing: "default",
  done: "outline",
};

export function AdminSubmissionsTab({
  currentAdmin,
  clients,
  documents,
  onChanged,
}: {
  currentAdmin: Participant;
  clients: Client[];
  documents: Document[];
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [syncingClientId, setSyncingClientId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [syncClientId, setSyncClientId] = useState<string>("");

  const clientsById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  const handleSync = async (clientId: string) => {
    setSyncingClientId(clientId);
    const result = await supabaseDb.syncClientDocuments(clientId);
    setSyncingClientId(null);
    if (result.success) {
      toast({ title: "Synced", description: `Found ${result.count ?? 0} file(s).` });
      onChanged();
    } else {
      toast({ title: "Sync failed", description: result.error, variant: "destructive" });
    }
  };

  const handleUpdateStatus = async (doc: Document, status: "processing" | "done") => {
    setUpdatingId(doc.id);
    try {
      await supabaseDb.setDocumentStatus(doc.id, status, currentAdmin.id);
      toast({ title: status === "done" ? "Marked Done" : "Marked Processing", description: doc.onedriveFileName });
      onChanged();
    } catch (error: any) {
      toast({ title: "Could not update status", description: error.message, variant: "destructive" });
    } finally {
      setUpdatingId(null);
    }
  };

  const sortedDocuments = useMemo(
    () => [...documents].sort((a, b) => (a.status === b.status ? 0 : a.status === "done" ? 1 : -1)),
    [documents]
  );

  const configuredClients = clients.filter((c) => c.onedriveDriveId && c.onedriveFolderId);

  return (
    <Card>
      <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <CardTitle>Submissions</CardTitle>
          <CardDescription>Documents Client Admins have uploaded to their OneDrive folders, across every client.</CardDescription>
        </div>
        <div className="flex gap-2">
          <Select value={syncClientId} onValueChange={setSyncClientId}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Sync a client..." /></SelectTrigger>
            <SelectContent>
              {configuredClients.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={() => syncClientId && handleSync(syncClientId)}
            disabled={!syncClientId || syncingClientId === syncClientId}
          >
            {syncingClientId === syncClientId && syncClientId ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Sync
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>File</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Modified</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedDocuments.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell className="font-medium">{clientsById.get(doc.clientId)?.name ?? "Unknown"}</TableCell>
                <TableCell>
                  {doc.onedriveWebUrl ? (
                    <a href={doc.onedriveWebUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 underline-offset-4 hover:underline">
                      {doc.onedriveFileName}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    doc.onedriveFileName
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANTS[doc.status]}>{STATUS_LABELS[doc.status]}</Badge>
                </TableCell>
                <TableCell>{doc.onedriveModifiedAt ? new Date(doc.onedriveModifiedAt).toLocaleString() : "—"}</TableCell>
                <TableCell className="text-right space-x-2">
                  {doc.status === "submitted" && (
                    <Button size="sm" variant="outline" disabled={updatingId === doc.id} onClick={() => handleUpdateStatus(doc, "processing")}>
                      Mark Processing
                    </Button>
                  )}
                  {doc.status !== "done" && (
                    <Button size="sm" disabled={updatingId === doc.id} onClick={() => handleUpdateStatus(doc, "done")}>
                      Mark Done
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {sortedDocuments.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No submissions yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
