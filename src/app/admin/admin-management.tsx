/**
 * @file Milestone 3 console UI. Master Admin invites Super Admins and sees
 * every admin account; Super Admin (and Master Admin) manage Clients, invite
 * Client Admins, and manage each client's work types; a Client Admin invites
 * and can demote peer Client Admins at their own client. Rendered as a tab
 * inside AdminDashboard, gated by the logged-in admin's access tier.
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, PlusCircle, Trash2, UserPlus, UserMinus } from "lucide-react";

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import * as supabaseDb from "@/lib/supabase/database";
import { inviteAdmin } from "@/lib/admin-api-client";
import { HistoricalImportDialog } from "./admin-historical-import";
import type { Client, Participant, WorkType } from "@/lib/data";

/**
 * Master Admin: invite Super Admins, see every admin account platform-wide.
 * Client Admin: invite peer Client Admins for their own client, and demote
 * (never invite/see Super/Master Admin, never another client).
 */
function AdminsSection({
  currentAdmin,
  participants,
  onChanged,
}: {
  currentAdmin: Participant;
  participants: Participant[];
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [demotingId, setDemotingId] = useState<string | null>(null);

  const isMasterAdmin = currentAdmin.accessTier === "master_admin";

  const visibleAdmins = isMasterAdmin
    ? participants.filter((p) => p.accessTier !== "client_user")
    : participants.filter((p) => p.accessTier === "client_admin" && p.clientId === currentAdmin.clientId);

  const handleInvite = async () => {
    if (!email || !name) {
      toast({ title: "Missing fields", description: "Name and email are required.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const result = await inviteAdmin(
      isMasterAdmin
        ? { email, name, tier: "super_admin" }
        : { email, name, tier: "client_admin", clientId: currentAdmin.clientId ?? undefined }
    );
    setIsSubmitting(false);
    if (result.success) {
      toast({ title: "Invite sent", description: `${name} has been invited as ${isMasterAdmin ? "a Super Admin" : "a Client Admin"}.` });
      setIsOpen(false);
      setEmail("");
      setName("");
      onChanged();
    } else {
      toast({ title: "Invite failed", description: result.error, variant: "destructive" });
    }
  };

  const handleDemote = async (participant: Participant) => {
    setDemotingId(participant.id);
    try {
      await supabaseDb.setAccessTier(participant.id, "client_user");
      toast({ title: "Demoted", description: `${participant.name} is now a Participant.` });
      onChanged();
    } catch (error: any) {
      toast({ title: "Could not demote", description: error.message, variant: "destructive" });
    } finally {
      setDemotingId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Admins</CardTitle>
          <CardDescription>
            {isMasterAdmin
              ? "Master, Super, and Client Admin accounts across the platform."
              : "Client Admins at your organization."}
          </CardDescription>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              {isMasterAdmin ? "Invite Super Admin" : "Invite Client Admin"}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{isMasterAdmin ? "Invite a Super Admin" : "Invite a Client Admin"}</DialogTitle>
              <DialogDescription>They&apos;ll receive an email invite to set their password.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="admin-invite-name">Full Name</Label>
                <Input id="admin-invite-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-invite-email">Email</Label>
                <Input id="admin-invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button onClick={handleInvite} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Invite
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Tier</TableHead>
              {!isMasterAdmin && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleAdmins.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.name}</TableCell>
                <TableCell>{p.email}</TableCell>
                <TableCell>
                  <Badge variant={p.accessTier === "master_admin" ? "default" : "secondary"}>
                    {p.accessTier}
                  </Badge>
                </TableCell>
                {!isMasterAdmin && (
                  <TableCell className="text-right">
                    {p.id !== currentAdmin.id && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline" disabled={demotingId === p.id}>
                            <UserMinus className="mr-2 h-4 w-4" />
                            Demote
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Demote {p.name}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              They&apos;ll lose Client Admin access and become a regular participant. This can be undone by inviting them again as a Client Admin.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDemote(p)}>Demote</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
            {visibleAdmins.length === 0 && (
              <TableRow>
                <TableCell colSpan={isMasterAdmin ? 3 : 4} className="text-center text-muted-foreground">
                  No admin accounts yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/**
 * One client's row in the Clients table: invite a Client Admin for it, and
 * manage its work types inline.
 */
function ClientRow({ client, onChanged }: { client: Client; onChanged: () => void }) {
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
    <>
      <TableRow className="cursor-pointer" onClick={() => setExpanded((v) => !v)}>
        <TableCell className="font-medium">{client.name}</TableCell>
        <TableCell className="text-right">
          <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" onClick={(e) => e.stopPropagation()}>
                <UserPlus className="mr-2 h-4 w-4" />
                Invite Client Admin
              </Button>
            </DialogTrigger>
            <DialogContent onClick={(e) => e.stopPropagation()}>
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
          {" "}
          <HistoricalImportDialog clientId={client.id} clientName={client.name} />
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={2} className="bg-muted/30">
            <div className="p-4 space-y-3">
              <p className="text-sm font-medium">Work Types</p>
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
              <div className="flex gap-2 max-w-sm">
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
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

/**
 * Super Admin and Master Admin: manage the client list, invite Client Admins,
 * and manage each client's work types.
 */
function ClientsSection() {
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [newClientName, setNewClientName] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const loadClients = useCallback(async () => {
    setLoading(true);
    setClients(await supabaseDb.getClients());
    setLoading(false);
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const handleAddClient = async () => {
    if (!newClientName.trim()) return;
    setIsAdding(true);
    try {
      await supabaseDb.addClient(newClientName.trim());
      setNewClientName("");
      await loadClients();
      toast({ title: "Client added", description: `${newClientName.trim()} has been created.` });
    } catch (error: any) {
      toast({ title: "Could not add client", description: error.message, variant: "destructive" });
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Clients</CardTitle>
        <CardDescription>Each client is a separate tenant. Click a row to manage its work types.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <ClientRow key={client.id} client={client} onChanged={loadClients} />
              ))}
              {clients.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground">
                    No clients yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">
          Invite Client Admins from a client&apos;s row above once it exists.
        </p>
      </CardFooter>
    </Card>
  );
}

/**
 * Top-level export rendered inside AdminDashboard's tabs. Shows only the
 * sections the logged-in admin's tier is allowed to see.
 */
export function AdminManagement({
  currentAdmin,
  participants,
  onParticipantsChanged,
}: {
  currentAdmin: Participant;
  participants: Participant[];
  onParticipantsChanged: () => void;
}) {
  return (
    <div className="space-y-6">
      {(currentAdmin.accessTier === "master_admin" || currentAdmin.accessTier === "client_admin") && (
        <AdminsSection currentAdmin={currentAdmin} participants={participants} onChanged={onParticipantsChanged} />
      )}
      {(currentAdmin.accessTier === "master_admin" || currentAdmin.accessTier === "super_admin") && (
        <ClientsSection />
      )}
    </div>
  );
}
