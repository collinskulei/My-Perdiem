import { Rocket, LogIn, Users2, SunMoon } from "lucide-react";
import { DocSection, DocP, DocSteps, DocList, DocNote } from "./documentation-ui";

export function GettingStartedSections() {
  return (
    <>
      <DocSection id="what-is-my-perdiem" title="What is My Perdiem?" icon={Rocket}>
        <DocP>
          My Perdiem is a simple way for organizations to manage the daily
          allowances (often called "per diem") paid to staff who travel for
          trainings, workshops, and other work events. Instead of filling in
          paper forms and waiting weeks for a cheque, staff submit a request
          in the app, an administrator reviews it, and payment is tracked
          from start to finish - all in one place.
        </DocP>
        <DocP>
          Whether you are the person receiving the payment, or the person
          responsible for approving and paying it, this page walks you
          through everything the app can do, in plain language.
        </DocP>
      </DocSection>

      <DocSection id="signing-in" title="Signing In" icon={LogIn}>
        <DocP>
          Everyone signs in with an email address and password. You'll
          receive your first invitation by email - click the link inside it
          to set your password, and you're ready to go.
        </DocP>
        <DocSteps>
          <li>Go to the app's sign-in page.</li>
          <li>Enter the email address your organization registered for you.</li>
          <li>Enter your password.</li>
          <li>Forgotten your password? Use "Reset Password" on the sign-in page and follow the emailed link.</li>
        </DocSteps>
        <DocNote>
          If you've never received an invitation email, check your spam
          folder first, then ask your organization's administrator to
          re-send it.
        </DocNote>
      </DocSection>

      <DocSection id="account-types" title="Your Account Type" icon={Users2}>
        <DocP>
          Everyone using My Perdiem falls into one of four account types.
          You don't need to choose one - your organization sets this up for
          you - but it helps to know what each one means, since this guide
          is organized around them:
        </DocP>
        <DocList>
          <li><strong>Participant</strong> - a staff member who attends events and requests per diem payments. Most people using the app are Participants.</li>
          <li><strong>Client Administrator</strong> - manages one organization: its participants, events, and payments.</li>
          <li><strong>Super Administrator</strong> - oversees multiple organizations on the platform.</li>
          <li><strong>Master Administrator</strong> - the platform's own top-level oversight account.</li>
        </DocList>
        <DocP>
          Everything a Participant can do, a Client Administrator can also
          do (plus more). Everything a Client Administrator can do, a Super
          Administrator can also do (plus more, across every organization).
          Use the sidebar on the left to jump straight to the section that
          matches your account.
        </DocP>
      </DocSection>

      <DocSection id="theme-toggle" title="Light & Dark Mode" icon={SunMoon}>
        <DocP>
          Prefer a brighter screen or an easier-on-the-eyes dark theme? Go to
          <strong> Settings → Preferences</strong> from your account menu and
          switch between Light and Dark mode at any time. Your choice is
          remembered the next time you sign in.
        </DocP>
      </DocSection>
    </>
  );
}
