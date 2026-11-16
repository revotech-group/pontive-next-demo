import Link from "next/link";
import { SignedIn, SignedOut, MemberManagement } from "@/components/pontkit";

export default function MembersPage() {
  return (
    <div className="pv-container pv-page">
      <div className="pv-page__head">
        <span className="pv-kicker">Organization</span>
        <h1>Members</h1>
        <p>
          The people in the organization you are signed in to, and their
          invitations. Owners and admins can invite, change roles and remove;
          everyone else sees what their role allows.
        </p>
      </div>

      <SignedIn>
        {/*
          `<MemberManagement>` calls NEXT_PUBLIC_PONTIVE_API_BASE_URL/mgmt/v1
          directly, but not with the session's access token: it draws a
          ten-minute management-API token through the refresh cookie on
          /__pontive (pontive-spec 41), carrying only the organization-member
          scopes the user's roles allow in the current organization. An empty
          organizationId means that organization, and the widget reloads when
          the organization switcher moves the session.
        */}
        <MemberManagement mode="PAGE" organizationId="" />
      </SignedIn>

      <SignedOut>
        <div className="pv-empty">
          <h3>Nothing to show yet</h3>
          <p>Sign in to see the members of your organization.</p>
          <Link href="/signin" className="pv-btn pv-btn--primary">
            Sign in
          </Link>
        </div>
      </SignedOut>
    </div>
  );
}
