import { LayoutDashboard, FileEdit, Calculator, ListChecks, QrCode, PieChart, UserCog } from "lucide-react";
import { DocSection, DocP, DocSteps, DocList, DocNote, RoleTag } from "./documentation-ui";

export function ParticipantSections() {
  return (
    <>
      <DocSection id="participant-dashboard" title="Your Dashboard" icon={LayoutDashboard}>
        <RoleTag>Participants</RoleTag>
        <DocP>
          When you sign in, you land on your personal dashboard. From here
          you can see the events you've been added to, submit new payment
          requests, check the status of requests you've already sent, and
          look back at everything you've been paid.
        </DocP>
        <DocNote>
          Not sure where something is? Click the <strong>"Guide me"</strong>{" "}
          button (usually near the top of the dashboard, or under your
          account menu) for a short guided walkthrough that highlights every
          part of the screen.
        </DocNote>
      </DocSection>

      <DocSection id="submitting-a-request" title="Requesting a Per Diem Payment" icon={FileEdit}>
        <RoleTag>Participants</RoleTag>
        <DocP>
          After attending (or being allocated to) an event, you request your
          per diem payment directly in the app:
        </DocP>
        <DocSteps>
          <li>From your dashboard, find the event and choose "Request Per Diem".</li>
          <li>Fill in the details that apply to you - how far you travelled, how many nights you stayed, and any tickets or transport receipts.</li>
          <li>Attach photos or scans of any receipts you have (air tickets, ground transport) if asked.</li>
          <li>Review the total the app calculates for you, then submit.</li>
        </DocSteps>
        <DocP>
          Once submitted, your request goes to your organization's
          administrator for review - you'll see its status update on your
          dashboard as it moves along.
        </DocP>
      </DocSection>

      <DocSection id="payment-breakdown" title="Understanding Your Payment" icon={Calculator}>
        <RoleTag>Participants</RoleTag>
        <DocP>
          Your total per diem payment can be made up of several parts,
          depending on the event and your role. You don't need to calculate
          any of this yourself - the app works it out - but here's what each
          part means:
        </DocP>
        <DocList>
          <li><strong>Mileage</strong> - a per-kilometre rate for travelling from your duty station to the event venue in your own vehicle.</li>
          <li><strong>Accommodation</strong> - the cost of your hotel stay for each night of the event.</li>
          <li><strong>Out-of-office allowance</strong> - a daily rate for being away from your usual workplace, based on your job group.</li>
          <li><strong>Air ticket</strong> - reimbursement for a flight, if you flew to the event.</li>
          <li><strong>Ground transfer</strong> - taxi or transport costs getting to and from an airport or station.</li>
        </DocList>
        <DocP>
          Not every request includes every one of these - only the parts
          that actually apply to your trip are added together for your
          total.
        </DocP>
      </DocSection>

      <DocSection id="request-status" title="Tracking Your Request" icon={ListChecks}>
        <RoleTag>Participants</RoleTag>
        <DocP>Every request moves through one of these statuses:</DocP>
        <DocList>
          <li><strong>Pending</strong> - submitted, and waiting for an administrator to look at it.</li>
          <li><strong>Approved</strong> - reviewed and accepted, waiting to be paid.</li>
          <li><strong>Paid / Confirmed</strong> - the payment has been sent to you, along with a transaction reference.</li>
          <li><strong>Rejected</strong> - not approved. You'll see the reason given, so you know what to fix if you resubmit.</li>
          <li><strong>Amended</strong> - the amount was corrected by an administrator after approval (for example, to fix a mistake). You'll see both the original and the corrected amount, with an explanation.</li>
        </DocList>
      </DocSection>

      <DocSection id="event-check-in" title="Checking In to an Event" icon={QrCode}>
        <RoleTag>Participants</RoleTag>
        <DocP>
          Some events track daily attendance through check-ins. If your
          event uses this, you'll be able to check in each day either by
          scanning a QR code provided at the venue, or directly from your
          dashboard during the event's check-in window.
        </DocP>
      </DocSection>

      <DocSection id="participant-analytics" title="Your Payment History" icon={PieChart}>
        <RoleTag>Participants</RoleTag>
        <DocP>
          The Analytics section of your dashboard gives you an at-a-glance
          summary: how many requests you've submitted in total, how much
          you've been paid so far, and a simple chart of your requests by
          status.
        </DocP>
      </DocSection>

      <DocSection id="updating-profile" title="Updating Your Profile" icon={UserCog}>
        <RoleTag>Participants</RoleTag>
        <DocP>
          Keep your details up to date from the <strong>Profile</strong> page
          - your name, phone number, duty station, job group, designation,
          and photo. Accurate details here (especially your duty station and
          job group) help the app calculate your payments correctly.
        </DocP>
      </DocSection>
    </>
  );
}
