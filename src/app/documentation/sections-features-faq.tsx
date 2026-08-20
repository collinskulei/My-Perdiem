import { Compass, Download, CalendarRange, Lock, HelpCircle } from "lucide-react";
import { DocSection, DocSubHeading, DocP, DocList, DocNote } from "./documentation-ui";

export function FeaturesSections() {
  return (
    <>
      <DocSection id="guide-me-tour" title="The Guided Walkthrough" icon={Compass}>
        <DocP>
          Every dashboard includes a "Guide me" option that highlights each
          part of the screen, one step at a time, explaining what it does in
          plain language. It's a great way to get oriented the first time
          you use the app, and you can restart it anytime from your account
          menu.
        </DocP>
      </DocSection>

      <DocSection id="downloads" title="Downloading Reports & Charts" icon={Download}>
        <DocP>
          Anywhere you see a "Download" button, you can save that data to
          your computer:
        </DocP>
        <DocList>
          <li>Report tables download as a spreadsheet (CSV) you can open in Excel.</li>
          <li>Charts download as an image or a PDF, ready to paste into a presentation or print.</li>
          <li>On the Insights section, you can also download an entire section's worth of charts as one combined PDF report.</li>
        </DocList>
      </DocSection>

      <DocSection id="quarter-filter" title="Quarter Filters" icon={CalendarRange}>
        <DocP>
          Rather than picking a start and end date every time, use the
          Quarter shortcut on the Reports section - choose something like
          "2025 Q1" and the date range is filled in for you automatically.
        </DocP>
      </DocSection>

      <DocSection id="data-security" title="Keeping Your Data Secure" icon={Lock}>
        <DocP>
          Every organization's information is kept completely separate from
          every other organization's. A Client Administrator only ever sees
          their own organization's participants and payments - never
          another organization's data. Only Super and Master Administrators,
          whose role is to support every organization on the platform, can
          see across more than one organization at a time.
        </DocP>
      </DocSection>
    </>
  );
}

export function FaqSection() {
  return (
    <DocSection id="faq" title="Frequently Asked Questions" icon={HelpCircle}>
      <div className="space-y-5">
        <div>
          <DocSubHeading>I never received my invitation email. What do I do?</DocSubHeading>
          <DocP>Check your spam or junk folder first. If it's still not there, ask your organization's administrator to resend your invitation.</DocP>
        </div>
        <div>
          <DocSubHeading>Why was my request rejected?</DocSubHeading>
          <DocP>Every rejected request includes a reason written by the administrator who reviewed it, visible right on the request itself. Fix whatever it mentions and submit again.</DocP>
        </div>
        <div>
          <DocSubHeading>My request amount changed after it was approved. Why?</DocSubHeading>
          <DocP>An administrator may amend an approved request to correct a mistake. You'll see both the original amount and the corrected one, along with the reason for the change.</DocP>
        </div>
        <div>
          <DocSubHeading>Can I use My Perdiem on my phone?</DocSubHeading>
          <DocP>Yes - the app works in any modern web browser, on a phone, tablet, or computer, without needing to install anything.</DocP>
        </div>
        <div>
          <DocSubHeading>I'm an administrator - can I recover a deleted organization?</DocSubHeading>
          <DocP>An organization can only be deleted once every participant, event, and payment record attached to it has already been removed, so there's nothing left to lose by the time deletion happens. If you're unsure, contact support before deleting anything.</DocP>
        </div>
        <div>
          <DocSubHeading>Who do I contact if something looks wrong?</DocSubHeading>
          <DocP>Start with your own organization's administrator - they handle day-to-day questions about your account and payments. For anything technical, reach out to your platform's support contact.</DocP>
        </div>
      </div>
      <DocNote className="mt-6">
        Didn't find your answer here? Ask your administrator, or reach out
        to your platform's support contact.
      </DocNote>
    </DocSection>
  );
}
