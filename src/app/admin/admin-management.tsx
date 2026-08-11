/**
 * @file Milestone 3 console UI (Admins section only - client management
 * moved to the top-level "Clients" tab, see admin-clients-overview.tsx).
 * Master Admin invites Super Admins and can manage every admin-tier account
 * (demote to Participant); a Client Admin invites and can demote peer Client
 * Admins at their own client. Rendered as a tab inside AdminDashboard, gated
 * by the logged-in admin's access tier.
 */
"use client";

import { useState } from "react";
import { Loader2, UserPlus, UserMinus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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
import type { Participant } from "@/lib/data";

/**
 * Master Admin: invite Super Admins, see and demote every admin-tier account
 * platform-wide (set_access_tier()'s master_admin branch is unrestricted).
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
              <TableHead className="text-right">Actions</TableHead>
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
                <TableCell className="text-right">
                  {p.id !== currentAdmin.id && p.accessTier !== "master_admin" && (
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
                            They&apos;ll lose {p.accessTier === "super_admin" ? "Super Admin" : "Client Admin"} access and become a regular participant. This can be undone by inviting them again.
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
              </TableRow>
            ))}
            {visibleAdmins.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
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
 * Top-level export rendered inside AdminDashboard's tabs. Shows only the
 * sections the logged-in admin's tier is allowed to see. Client management
 * (invite Client Admins, work types, per-client stats) lives in the
 * top-level "Clients" tab (admin-clients-overview.tsx) for Super/Master
 * Admin instead of here.
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
    </div>
  );
}
