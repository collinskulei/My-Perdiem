import {
  LayoutDashboard, Users, MapPin, CalendarDays, CheckCircle2, Wallet,
  PenLine, ClipboardCheck, FileBarChart, LineChart, UploadCloud, FolderSync, UserPlus2,
  Sparkles,
} from "lucide-react";
import { DocSection, DocP, DocList, DocNote, RoleTag } from "./documentation-ui";

export function ClientAdminSections() {
  return (
    <>
      <DocSection id="admin-dashboard-overview" title="The Admin Dashboard" icon={LayoutDashboard}>
        <RoleTag>Organization Administrators</RoleTag>
        <DocP>
          As an administrator, your Per Diem dashboard is organized into
          sections listed in the sidebar on the left: Per Diem Requests, Per
          Diem Payments, Events, Event Check-ins, Per Diem Recipients,
          Venues, Reports, Analytics, Insights, Documents, and Manage.
          Related sections are grouped together and can be expanded or
          collapsed - click a group&apos;s name to open or close it. Home, at
          the top of the sidebar, shows totals across every module your
          organization uses.
        </DocP>
        <DocNote>
          Every dashboard is scoped to your own organization - you&apos;ll only
          ever see your organization&apos;s recipients, events, and payments.
        </DocNote>
      </DocSection>

      <DocSection id="managing-recipients" title="Managing Per Diem Recipients" icon={Users}>
        <RoleTag>Organization Administrators</RoleTag>
        <DocP>
          Recipients are the people your organization pays per diems to.
          The Per Diem Recipients section lists the ones with an account in
          the app; people who only appear in imported payment records can
          still be searched in Reports and Insights. From this section you can:
        </DocP>
        <DocList>
          <li><strong>Add a recipient</strong> - they&apos;ll receive an email invitation to set their own password.</li>
          <li><strong>Search</strong> for anyone by name, ID number, or phone number.</li>
          <li><strong>Edit details</strong> - update someone&apos;s phone number, duty station, job group, designation, or organization.</li>
          <li><strong>Deactivate or reactivate</strong> an account - deactivating blocks sign-in without deleting their history.</li>
        </DocList>
      </DocSection>

      <DocSection id="managing-venues" title="Managing Venues" icon={MapPin}>
        <RoleTag>Organization Administrators</RoleTag>
        <DocP>
          Venues are the locations events are held at. Add a venue once
          (name, city, and county) and it&apos;s ready to attach to any event
          going forward; you can edit a venue&apos;s details later. The venue&apos;s
          location is also what mileage calculations are based on. Venues
          are shared across events, so they can&apos;t be deleted from here.
        </DocP>
      </DocSection>

      <DocSection id="managing-events" title="Creating and Managing Events" icon={CalendarDays}>
        <RoleTag>Organization Administrators</RoleTag>
        <DocP>An event represents a training, workshop, or meeting your recipients attend. When creating one, you&apos;ll set:</DocP>
        <DocList>
          <li>Its name, venue, and dates.</li>
          <li>A facilitator name.</li>
          <li>Which recipients are allocated to attend - pick registered recipients, or upload an Excel/CSV list with Name and Phone columns.</li>
          <li>Check-in start/end times, if you&apos;re tracking daily attendance.</li>
          <li>Allowance rates per job group, if this event pays different amounts to different roles.</li>
        </DocList>
        <DocP>
          You can also attach a program or an invitation letter as a file
          for recipients to refer to, and generate a QR code for check-in.
        </DocP>
      </DocSection>

      <DocSection id="approving-requests" title="Reviewing and Approving Requests" icon={CheckCircle2}>
        <RoleTag>Organization Administrators</RoleTag>
        <DocP>
          Requests submitted through the app land in the Per Diem Requests
          section. For each one you can:
        </DocP>
        <DocList>
          <li><strong>Approve it</strong> - moves it forward to be paid.</li>
          <li><strong>Amend it</strong> - while it&apos;s still Pending (see Correcting a Payment).</li>
          <li><strong>Reject it</strong> - you&apos;ll be asked for a reason, which the recipient will see.</li>
        </DocList>
        <DocNote>
          Payment records brought in from your existing spreadsheets don&apos;t
          go through this step - they appear under Per Diem Payments and in
          Reports.
        </DocNote>
      </DocSection>

      <DocSection id="paying-requests" title="Paying Approved Requests" icon={Wallet}>
        <RoleTag>Organization Administrators</RoleTag>
        <DocP>
          Approved requests are paid per event. In Events, open the
          event&apos;s menu and choose <strong>Mark Event Paid</strong>, then
          enter the transaction reference (for example, an M-Pesa code or
          bank reference). Every approved request for that event is marked
          Paid with that reference, so there&apos;s a clear record of the
          payment.
        </DocP>
        <DocNote>
          Imported payment records that are still Pending (money owed) are
          marked as paid by your Super Administrator once the payment has
          gone out.
        </DocNote>
      </DocSection>

      <DocSection id="amending-requests" title="Correcting a Payment" icon={PenLine}>
        <RoleTag>Organization Administrators</RoleTag>
        <DocP>
          Need to correct a request before it&apos;s approved? Amend it while
          it&apos;s still Pending - adjust the mileage, accommodation,
          out-of-office allowance, air ticket or ground transfer and give a
          reason. The original amount is kept alongside the new one, so
          there&apos;s always a clear trail of what changed and why. The
          Amended tab in Reports lists every amended record.
        </DocP>
      </DocSection>

      <DocSection id="checkin-reports" title="Event Check-In Reports" icon={ClipboardCheck}>
        <RoleTag>Organization Administrators</RoleTag>
        <DocP>
          For events tracking daily attendance, the Event Check-ins section
          shows who has checked in, and on which days, for every event
          currently underway. You can download a check-in report for any of
          them - an Excel register with each recipient&apos;s attendance per
          day and their attendance percentage.
        </DocP>
      </DocSection>

      <DocSection id="reports-filtering" title="Reports & Filtering" icon={FileBarChart}>
        <RoleTag>Organization Administrators</RoleTag>
        <DocP>
          The Reports section lets you narrow down per diem data to exactly
          what you need, then view it split by status - Paid, Pending
          (imported payments still owed), Approved, Rejected, and Amended -
          and download Paid, Pending, Approved or Rejected as a CSV
          spreadsheet. You can filter by:
        </DocP>
        <DocList>
          <li>A date range, or a quick &quot;Quarter&quot; shortcut like &quot;2025 Q1&quot;.</li>
          <li>County or duty station.</li>
          <li>A specific recipient&apos;s name or phone number.</li>
          <li>Venue, event type, or event name.</li>
          <li>Employer, staff category, or training dates.</li>
          <li>Flagged repeat payments only.</li>
          <li>Transport or DSA allowance amount ranges.</li>
        </DocList>
        <DocP>
          Search for any one person by name or phone and the Reports tab
          will show a running total of everything they&apos;ve been paid,
          alongside every individual payment record.
        </DocP>
      </DocSection>

      <DocSection id="analytics-charts" title="Analytics Charts" icon={LineChart}>
        <RoleTag>Organization Administrators</RoleTag>
        <DocP>
          The Analytics section gives you a quick visual summary of your
          organization&apos;s per diem activity - total requests, total paid
          out, a breakdown by status, and a trend over the last 30 days.
          You can also search for a specific recipient here to see their
          total paid and full payment history.
        </DocP>
      </DocSection>

      <DocSection id="client-insights" title="Insights" icon={Sparkles}>
        <RoleTag>Organization Administrators</RoleTag>
        <DocP>
          Insights is a deeper analytics view of your own organization,
          grouped into Overview, Financial, Staff &amp; Employer, Training,
          and Amendments. Filter everything by event type, event name,
          county, year, month, or payment date range, look up any
          recipient&apos;s full payment history, and download any chart - or a
          whole section - as a PDF report.
        </DocP>
        <DocNote>
          Like the rest of your dashboard, Insights only ever shows your
          organization&apos;s data.
        </DocNote>
      </DocSection>

      <DocSection id="historical-import" title="Past Payment Records" icon={UploadCloud}>
        <RoleTag>Organization Administrators</RoleTag>
        <DocP>
          Per diem payments your organization made outside the app are kept
          here as a record, so everything lives in one place. Send your
          payment spreadsheets to your Super Administrator, who imports them
          for you. Once imported, the records show up in:
        </DocP>
        <DocList>
          <li><strong>Per Diem Payments</strong> - every imported record.</li>
          <li><strong>Reports</strong> - filtered, split by status, and downloadable.</li>
          <li><strong>Insights</strong> and <strong>Home</strong> - in every total and chart.</li>
        </DocList>
        <DocNote>
          The import recognizes records it already has, so an updated
          version of the same spreadsheet fills in gaps rather than creating
          duplicates. Repeat payments to the same person are flagged for
          review.
        </DocNote>
      </DocSection>

      <DocSection id="documents-onedrive" title="Sending Documents to Head Office" icon={FolderSync}>
        <RoleTag>Organization Administrators</RoleTag>
        <DocP>
          If your organization shares payment-list documents with a central
          office, you can upload them directly into your organization&apos;s
          shared OneDrive folder, then use the Documents section to sync and
          track their status (Submitted, Processing, or Done) without
          leaving the app.
        </DocP>
      </DocSection>

      <DocSection id="inviting-admins" title="Inviting Other Administrators" icon={UserPlus2}>
        <RoleTag>Organization Administrators</RoleTag>
        <DocP>
          Need a colleague to help manage your organization&apos;s account? Invite
          them as another Organization Administrator from the Manage section - they&apos;ll
          receive an email invitation just like a new recipient does.
        </DocP>
      </DocSection>
    </>
  );
}
