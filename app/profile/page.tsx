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
          finished while the widget under it is loading. `<AccountSettings>`
          fetches the profile from NEXT_PUBLIC_PONTIVE_API_BASE_URL/mgmt/v1/me
          with the session's access token — a plain bearer request to the
          management gateway, cross-origin, with no cookies involved. The
          gateway checks the request's Origin against the origins registered
          on the app; `localhost` is admitted as a development origin, and a
          deployed URL must be registered on the app or the call is refused
          with 403.
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
