import { Crown } from "lucide-react";
import { DocSection, DocP, DocList, RoleTag } from "./documentation-ui";

export function MasterAdminSections() {
  return (
    <DocSection id="master-admin-overview" title="Overseeing the Platform" icon={Crown}>
      <RoleTag>Master Administrators</RoleTag>
      <DocP>
        Master Administrator is the platform's top-level account type. In
        addition to everything a Super Administrator can do, a Master
        Administrator can:
      </DocP>
      <DocList>
        <li>Invite new Super Administrators.</li>
        <li>See and manage admin accounts across the entire platform, at every level.</li>
      </DocList>
      <DocP>
        In practice, day-to-day organization and payment management happens
        at the Client and Super Administrator levels - the Master
        Administrator role exists mainly to set up and oversee that
        structure.
      </DocP>
    </DocSection>
  );
}
