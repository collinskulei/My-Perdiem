/**
 * @file Client Admin's "Documents" tab: a link to their client's OneDrive
 * submission folder, a manual Sync button, and the resulting list of
 * tracked submissions with status. Uploading happens directly in OneDrive's
 * own website (see docs/MILESTONE_HANDOFF.md's Milestone 5 section) - this
 * tab never handles file bytes, only what Microsoft Graph reports exists.
 */
"use client";

import { useState } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import * as supabaseDb from "@/lib/supabase/database";
import type { Client, Document } from "@/lib/data";

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

export function AdminDocumentsTab({
  client,
  documents,
  onChanged,
}: {
  client: Client | null;
  documents: Document[];
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    const result = await supabaseDb.syncClientDocuments();
    setIsSyncing(false);
    if (result.success) {
      toast({ title: "Synced", description: `Found ${result.count ?? 0} file(s) in your OneDrive folder.` });
      onChanged();
    } else {
      toast({ title: "Sync failed", description: result.error, variant: "destructive" });
    }
  };

  const folderNotConfigured = !client?.onedriveDriveId || !client?.onedriveFolderId;

  return (
    <Card>
      <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <CardTitle>Documents</CardTitle>
          <CardDescription>
            Upload payment-list documents directly in your OneDrive folder, then sync here to track them.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          {client?.onedriveFolderLink && (
            <Button size="sm" variant="outline" asChild>
              <a href={client.onedriveFolderLink} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Open OneDrive Folder
              </a>
            </Button>
          )}
          <Button size="sm" onClick={handleSync} disabled={isSyncing || folderNotConfigured}>
            {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Sync
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {folderNotConfigured ? (
          <p className="text-sm text-muted-foreground">
            Your OneDrive submission folder hasn&apos;t been configured yet - contact your Super Admin.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Modified</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium">
                    {doc.onedriveWebUrl ? (
                      <a href={doc.onedriveWebUrl} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">
                        {doc.onedriveFileName}
                      </a>
                    ) : (
                      doc.onedriveFileName
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[doc.status]}>{STATUS_LABELS[doc.status]}</Badge>
                  </TableCell>
                  <TableCell>{doc.onedriveModifiedAt ? new Date(doc.onedriveModifiedAt).toLocaleString() : "—"}</TableCell>
                </TableRow>
              ))}
              {documents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No submissions yet. Upload a file to your OneDrive folder, then click Sync.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
