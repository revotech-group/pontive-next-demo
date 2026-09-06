import Link from "next/link";
import { SignedIn, SignedOut, AccountSettings } from "@/components/pontkit";

export default function ProfilePage() {
  return (
    <div className="pv-container pv-page">
      <div className="pv-page__head">
        <span className="pv-kicker">Account</span>
        <h1>Your account</h1>
        <p>
          Served by the same origin as the rest of the app, so the session is
          read straight from the first-party cookie.
        </p>
      </div>

      <SignedIn>
        {/*
          The session card is the app's own markup, so the page still reads as
          finished when the widget under it has nothing to show. It routinely
          has nothing on `localhost`: `<AccountSettings>` fetches the profile
          from NEXT_PUBLIC_PONTIVE_API_BASE_URL, and a localhost origin is not one
          the management API answers — it fails with `TypeError: Failed to
          fetch` and the element renders empty. On a deployed origin registered
          on the app, the settings panel fills the space below.
        */}
        <div className="pv-card pv-session">
          <div className="pv-session__body">
            <span className="pv-status pv-status--on">
              <span className="pv-status__dot" aria-hidden="true" />
              Signed in
            </span>
            <h3>This browser holds a first-party session</h3>
            <p>
              It was rebuilt from the refresh cookie on{" "}
              <code className="pv-code">/__auth</code>, not from anything stored
              in the page.
            </p>
          </div>
        </div>

        <AccountSettings mode="PAGE" />
      </SignedIn>

      <SignedOut>
        <div className="pv-empty">
          <h3>Nothing to show yet</h3>
          <p>
            There is no session on this browser. Sign in and this page fills
            itself in from the account behind it.
          </p>
          <Link href="/signin" className="pv-btn pv-btn--primary">
            Sign in
          </Link>
        </div>
      </SignedOut>
    </div>
  );
}
