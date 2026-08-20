import {
  LayoutDashboard, Users, MapPin, CalendarDays, CheckCircle2, Wallet,
  PenLine, ClipboardCheck, FileBarChart, LineChart, UploadCloud, FolderSync, UserPlus2,
} from "lucide-react";
import { DocSection, DocP, DocSteps, DocList, DocNote, RoleTag } from "./documentation-ui";

export function ClientAdminSections() {
  return (
    <>
      <DocSection id="admin-dashboard-overview" title="The Admin Dashboard" icon={LayoutDashboard}>
        <RoleTag>Client Administrators</RoleTag>
        <DocP>
          As an administrator, your dashboard is organized into sections
          listed in the sidebar on the left: Per Diem Requests, Events,
          Event Check-ins, Participants, Venues, Reports, Analytics, and
          Manage. Related sections are grouped together and can be expanded
          or collapsed - click a group's name to open or close it.
        </DocP>
        <DocNote>
          Every dashboard is scoped to your own organization - you'll only
          ever see your organization's participants, events, and payments.
        </DocNote>
      </DocSection>

      <DocSection id="managing-participants" title="Managing Participants" icon={Users}>
        <RoleTag>Client Administrators</RoleTag>
        <DocP>From the Participants section you can:</DocP>
        <DocList>
          <li><strong>Add a participant</strong> - they'll receive an email invitation to set their own password.</li>
          <li><strong>Search</strong> for anyone by name, ID number, or phone number.</li>
          <li><strong>Edit details</strong> - update someone's phone number, duty station, job group, designation, or organization.</li>
          <li><strong>Deactivate or reactivate</strong> an account - deactivating blocks sign-in without deleting their history.</li>
        </DocList>
      </DocSection>

      <DocSection id="managing-venues" title="Managing Venues" icon={MapPin}>
        <RoleTag>Client Administrators</RoleTag>
        <DocP>
          Venues are the locations events are held at. Add a venue once
          (name, city, and county) and it's ready to attach to any event
          going forward. The venue's location is also what mileage
          calculations are based on.
        </DocP>
      </DocSection>

      <DocSection id="managing-events" title="Creating and Managing Events" icon={CalendarDays}>
        <RoleTag>Client Administrators</RoleTag>
        <DocP>An event represents a training, workshop, or meeting your participants attend. When creating one, you'll set:</DocP>
        <DocList>
          <li>Its name, venue, and dates.</li>
          <li>A facilitator name.</li>
          <li>Which participants are allocated to attend.</li>
          <li>Check-in start/end times, if you're tracking daily attendance.</li>
          <li>Allowance rates per job group, if this event pays different amounts to different roles.</li>
        </DocList>
        <DocP>
          You can also attach a program or an invitation letter as a file
          for participants to refer to.
        </DocP>
      </DocSection>

      <DocSection id="approving-requests" title="Reviewing and Approving Requests" icon={CheckCircle2}>
        <RoleTag>Client Administrators</RoleTag>
        <DocP>
          Every submitted request lands in the Per Diem Requests section.
          Open one to see its full breakdown, then either:
        </DocP>
        <DocList>
          <li><strong>Approve it</strong> - moves it forward to be paid.</li>
          <li><strong>Reject it</strong> - you'll be asked for a reason, which the participant will see.</li>
        </DocList>
      </DocSection>

      <DocSection id="paying-requests" title="Paying Approved Requests" icon={Wallet}>
        <RoleTag>Client Administrators</RoleTag>
        <DocP>
          Once a request is approved, mark it as Paid and record the
          transaction reference (for example, an M-Pesa code or bank
          reference) so there's a clear record of the payment. If several
          participants from the same event are all ready to be paid at
          once, you can pay them together in a single bulk action instead
          of one at a time.
        </DocP>
      </DocSection>

      <DocSection id="amending-requests" title="Correcting a Payment" icon={PenLine}>
        <RoleTag>Client Administrators</RoleTag>
        <DocP>
          Made a mistake after approving a request? You can amend it -
          change the amount and give a reason for the correction. The
          original amount is kept alongside the new one, so there's always
          a clear trail of what changed and why.
        </DocP>
      </DocSection>

      <DocSection id="checkin-reports" title="Event Check-In Reports" icon={ClipboardCheck}>
        <RoleTag>Client Administrators</RoleTag>
        <DocP>
          For events tracking daily attendance, the Event Check-ins section
          shows who has checked in, and on which days, for every event
          currently underway. You can download a full check-in report for
          any event.
        </DocP>
      </DocSection>

      <DocSection id="reports-filtering" title="Reports & Filtering" icon={FileBarChart}>
        <RoleTag>Client Administrators</RoleTag>
        <DocP>
          The Reports section lets you narrow down per diem data to exactly
          what you need, then view it split by status (Approved, Paid,
          Rejected, Amended) or download it as a spreadsheet. You can filter
          by:
        </DocP>
        <DocList>
          <li>A date range, or a quick "Quarter" shortcut like "2025 Q1".</li>
          <li>County or duty station.</li>
          <li>A specific participant's name or phone number.</li>
          <li>Employer, staff category, or training dates.</li>
          <li>Transport or DSA allowance amount ranges.</li>
        </DocList>
        <DocP>
          Search for any one person by name or phone and the Reports tab
          will show a running total of everything they've been paid,
          alongside every individual payment record.
        </DocP>
      </DocSection>

      <DocSection id="analytics-charts" title="Analytics Charts" icon={LineChart}>
        <RoleTag>Client Administrators</RoleTag>
        <DocP>
          The Analytics section gives you a visual summary of your
          organization's per diem activity - total requests, total paid
          out, a breakdown by status, and a trend of requests over time.
          You can also search for a specific participant here to see their
          total paid and full payment history.
        </DocP>
      </DocSection>

      <DocSection id="historical-import" title="Bringing In Historical Payment Records" icon={UploadCloud}>
        <RoleTag>Client Administrators</RoleTag>
        <DocP>
          If your organization made per diem payments before starting to use
          My Perdiem, you can bring that history into the app so everything
          lives in one place - upload the spreadsheet you already have, and
          the app takes care of the rest.
        </DocP>
        <DocSteps>
          <li>From the Clients or Participants area, choose "Import Historical Data".</li>
          <li>Upload your spreadsheet - the app automatically figures out which column is which (name, phone, amount, dates, and so on).</li>
          <li>Double-check the preview - anything that looks off (like an unclear date, or two names in one cell) is clearly flagged for you to fix before anything is saved.</li>
          <li>Confirm the import.</li>
        </DocSteps>
        <DocNote>
          Uploading an updated version of the same spreadsheet later (for
          example, to fill in details that weren't ready the first time) is
          safe - the app recognizes records it already has and fills in the
          gaps rather than creating duplicates.
        </DocNote>
      </DocSection>

      <DocSection id="documents-onedrive" title="Sending Documents to Head Office" icon={FolderSync}>
        <RoleTag>Client Administrators</RoleTag>
        <DocP>
          If your organization shares payment-list documents with a central
          office, you can upload them directly into your organization's
          shared OneDrive folder, then use the Documents section to sync and
          track their status (Submitted, Processing, or Done) without
          leaving the app.
        </DocP>
      </DocSection>

      <DocSection id="inviting-admins" title="Inviting Other Administrators" icon={UserPlus2}>
        <RoleTag>Client Administrators</RoleTag>
        <DocP>
          Need a colleague to help manage your organization's account? Invite
          them as another Client Administrator from the Manage section - they'll
          receive an email invitation just like a new participant does.
        </DocP>
      </DocSection>
    </>
  );
}
