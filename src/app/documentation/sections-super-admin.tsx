import { Building2, LayoutDashboard, Trash2, Inbox, Sparkles, Search } from "lucide-react";
import { DocSection, DocP, DocSteps, DocList, DocNote, RoleTag } from "./documentation-ui";

export function SuperAdminSections() {
  return (
    <>
      <DocSection id="managing-clients" title="Managing Every Organization" icon={Building2}>
        <RoleTag>Super Administrators</RoleTag>
        <DocP>
          As a Super Administrator, the Clients section gives you an
          overview of every organization on the platform - each shown as
          its own card, with live counts of its administrators and
          participants. From a client's card you can:
        </DocP>
        <DocList>
          <li>Invite that organization's first Client Administrator.</li>
          <li>Jump straight to their list of participants.</li>
          <li>Import historical payment records on their behalf.</li>
          <li>Set up their shared OneDrive submission folder.</li>
        </DocList>
      </DocSection>

      <DocSection id="client-dashboard-button" title="Viewing a Client's Dashboard" icon={LayoutDashboard}>
        <RoleTag>Super Administrators</RoleTag>
        <DocP>
          Need to see things exactly the way one organization's own
          administrator does? Click the <strong>Dashboard</strong> button on
          that organization's card, and you'll be taken directly into their
          admin dashboard - their events, their participants, their
          requests - with full ability to manage things on their behalf if
          needed.
        </DocP>
      </DocSection>

      <DocSection id="deleting-clients" title="Removing an Organization" icon={Trash2}>
        <RoleTag>Super Administrators</RoleTag>
        <DocP>
          An organization can only be removed once it's completely empty -
          no participants, events, or payment history attached. This is a
          deliberate safeguard: it's never possible to accidentally delete
          real payment records this way.
        </DocP>
        <DocSteps>
          <li>Open the organization's card and choose "Delete Client".</li>
          <li>Type the organization's name exactly to confirm.</li>
          <li>If anything is still attached to it, you'll get a clear message telling you so instead of an error - archive or clear it out first.</li>
        </DocSteps>
      </DocSection>

      <DocSection id="all-submissions" title="Reviewing Submissions From All Clients" icon={Inbox}>
        <RoleTag>Super Administrators</RoleTag>
        <DocP>
          The Submissions section is a single queue showing every document
          uploaded by every organization, so nothing gets missed. Open a
          file directly, and once you've processed it, mark it Processing or
          Done to keep the queue current.
        </DocP>
      </DocSection>

      <DocSection id="insights" title="Insights: Platform-Wide Analytics" icon={Sparkles}>
        <RoleTag>Super Administrators</RoleTag>
        <DocP>
          Insights is a deeper, richer analytics view across every
          organization at once, organized into five areas:
        </DocP>
        <DocList>
          <li><strong>Overview</strong> - total activity, trends, and which organizations have been paid the most.</li>
          <li><strong>Financial</strong> - how spending breaks down by allowance type, and by status.</li>
          <li><strong>Staff & Employer</strong> - who's being paid, by category and employer.</li>
          <li><strong>Training</strong> - how long trainings run, and where they happen.</li>
          <li><strong>Cross-Organization</strong> - side-by-side comparisons between organizations.</li>
        </DocList>
        <DocP>
          Every chart can be downloaded as a PDF, either individually or as
          a full report for an entire section, with one click.
        </DocP>
      </DocSection>

      <DocSection id="participant-lookup" title="Looking Up Anyone, Anywhere" icon={Search}>
        <RoleTag>Super Administrators</RoleTag>
        <DocP>
          Both the Analytics and Insights sections include a search box
          where you can type any participant's name or phone number - across
          every organization - and instantly see how much they've been paid
          in total, and every individual payment on record for them. This
          finds everyone, including people who don't have an app account of
          their own (for example, someone only ever added through a
          historical import).
        </DocP>
      </DocSection>
    </>
  );
}
