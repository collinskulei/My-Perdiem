/**
 * @file Super/Master Admin "Clients" tab: one widget (card) per client showing
 * at-a-glance stats and giving access to managing that client, its admins,
 * and its participants - replaces the older plain-table client list that
 * used to live inside the "Manage" tab (admin-management.tsx's ClientsSection).
 */
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Loader2, PlusCircle, Trash2, UserPlus, Users, ShieldCheck, ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import * as supabaseDb from "@/lib/supabase/database";
import { inviteAdmin } from "@/lib/admin-api-client";
import { HistoricalImportDialog } from "./admin-historical-import";
import type { Client, Participant, WorkType } from "@/lib/data";

/**
 * One client's widget: stats, invite-a-Client-Admin, and an expandable panel
 * for work types - the same actions ClientRow used to offer inline in a
 * table row, now as a self-contained card.
 */
function ClientWidget({
  client,
  adminCount,
  participantCount,
  basePath,
  onChanged,
}: {
  client: Client;
  adminCount: number;
  participantCount: number;
  basePath: string;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [loadingWorkTypes, setLoadingWorkTypes] = useState(false);
  const [newWorkType, setNewWorkType] = useState("");
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadWorkTypes = useCallback(async () => {
    setLoadingWorkTypes(true);
    setWorkTypes(await supabaseDb.getWorkTypesByClient(client.id));
    setLoadingWorkTypes(false);
  }, [client.id]);

  useEffect(() => {
    if (expanded) loadWorkTypes();
  }, [expanded, loadWorkTypes]);

  const handleInvite = async () => {
    if (!email || !name) {
      toast({ title: "Missing fields", description: "Name and email are required.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const result = await inviteAdmin({ email, name, tier: "client_admin", clientId: client.id });
    setIsSubmitting(false);
    if (result.success) {
      toast({ title: "Invite sent", description: `${name} has been invited as ${client.name}'s Client Admin.` });
      setIsInviteOpen(false);
      setEmail("");
      setName("");
      onChanged();
    } else {
      toast({ title: "Invite failed", description: result.error, variant: "destructive" });
    }
  };

  const handleAddWorkType = async () => {
    if (!newWorkType.trim()) return;
    try {
      await supabaseDb.addWorkType(client.id, newWorkType.trim());
      setNewWorkType("");
      await loadWorkTypes();
    } catch (error: any) {
      toast({ title: "Could not add work type", description: error.message, variant: "destructive" });
    }
  };

  const handleArchiveWorkType = async (id: string) => {
    try {
      await supabaseDb.archiveWorkType(id);
      await loadWorkTypes();
    } catch (error: any) {
      toast({ title: "Could not remove work type", description: error.message, variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{client.name}</CardTitle>
        <CardDescription>/{client.slug}-admin</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1"><ShieldCheck className="h-4 w-4" />{adminCount} admin{adminCount === 1 ? "" : "s"}</span>
          <span className="flex items-center gap-1"><Users className="h-4 w-4" />{participantCount} participant{participantCount === 1 ? "" : "s"}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <UserPlus className="mr-2 h-4 w-4" />
                Invite Client Admin
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite a Client Admin for {client.name}</DialogTitle>
                <DialogDescription>They&apos;ll receive an email invite to set their password.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor={`client-admin-name-${client.id}`}>Full Name</Label>
                  <Input id={`client-admin-name-${client.id}`} value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`client-admin-email-${client.id}`}>Email</Label>
                  <Input id={`client-admin-email-${client.id}`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsInviteOpen(false)}>Cancel</Button>
                <Button onClick={handleInvite} disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send Invite
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button size="sm" variant="outline" asChild>
            <Link href={`${basePath}?tab=participants&clientId=${client.id}`}>
              <Users className="mr-2 h-4 w-4" />
              View Participants
            </Link>
          </Button>
          <HistoricalImportDialog clientId={client.id} clientName={client.name} />
        </div>
        <Button size="sm" variant="ghost" className="w-full justify-between" onClick={() => setExpanded((v) => !v)}>
          Work Types
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
        {expanded && (
          <div className="space-y-3 pt-1">
            {loadingWorkTypes ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <div className="flex flex-wrap gap-2">
                {workTypes.map((wt) => (
                  <Badge key={wt.id} variant="secondary" className="gap-1">
                    {wt.name}
                    <button onClick={() => handleArchiveWorkType(wt.id)} className="ml-1 hover:text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {workTypes.length === 0 && (
                  <span className="text-sm text-muted-foreground">No work types yet.</span>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="e.g. Site Visit Report"
                value={newWorkType}
                onChange={(e) => setNewWorkType(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddWorkType()}
              />
              <Button size="sm" variant="outline" onClick={handleAddWorkType}>
                <PlusCircle className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Top-level "Clients" tab: add-client control plus a widget grid, one card
 * per client. Rendered for Super Admin and Master Admin only (gated by the
 * caller in admin-dashboard.tsx).
 */
export function AdminClientsOverview({
  clients,
  participants,
  basePath,
  onChanged,
}: {
  clients: Client[];
  participants: Participant[];
  basePath: string;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [newClientName, setNewClientName] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const countsByClient = useMemo(() => {
    const counts = new Map<string, { admins: number; participants: number }>();
    for (const p of participants) {
      if (!p.clientId) continue;
      const entry = counts.get(p.clientId) ?? { admins: 0, participants: 0 };
      if (p.accessTier === "client_admin") entry.admins += 1;
      else if (p.accessTier === "client_user") entry.participants += 1;
      counts.set(p.clientId, entry);
    }
    return counts;
  }, [participants]);

  const handleAddClient = async () => {
    if (!newClientName.trim()) return;
    setIsAdding(true);
    try {
      await supabaseDb.addClient(newClientName.trim());
      setNewClientName("");
      onChanged();
      toast({ title: "Client added", description: `${newClientName.trim()} has been created.` });
    } catch (error: any) {
      toast({ title: "Could not add client", description: error.message, variant: "destructive" });
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Clients</CardTitle>
          <CardDescription>Each client is a separate tenant with its own admin portal.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 max-w-sm">
            <Input
              placeholder="New client name"
              value={newClientName}
              onChange={(e) => setNewClientName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddClient()}
            />
            <Button variant="outline" onClick={handleAddClient} disabled={isAdding}>
              {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>
      {clients.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">No clients yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((client) => {
            const counts = countsByClient.get(client.id) ?? { admins: 0, participants: 0 };
            return (
              <ClientWidget
                key={client.id}
                client={client}
                adminCount={counts.admins}
                participantCount={counts.participants}
                basePath={basePath}
                onChanged={onChanged}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
