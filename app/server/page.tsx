import Link from "next/link";

import { pontive } from "@/lib/pontive";

// Read per request: this page is the signed-in user's, not a static one.
export const dynamic = "force-dynamic";

export default async function ServerPage() {
  const session = await pontive().auth();
  const renderedAt = new Date().toISOString();

  return (
    <div className="pv-container pv-page">
      <div className="pv-page__head">
        <span className="pv-kicker">Server rendering</span>
        <h1>Rendered on the server, as you</h1>
        <p>
          This page is a server component. It asked the SDK for the session with{" "}
          <code className="pv-code">await pontive().auth()</code> and rendered
          before any of it reached your browser — no client-side fetch, no
          loading state.
        </p>
      </div>

      {session ? (
        <div className="pv-card pv-session">
          <div className="pv-session__body">
            <span className="pv-status pv-status--on">
              <span className="pv-status__dot" aria-hidden="true" />
              Signed in
            </span>
            <h3>{session.user.email ?? session.user.id}</h3>
            <p>
              User <code className="pv-code">{session.user.id}</code>, read from
              the access token the auth server keeps in an HttpOnly cookie on
              this origin and verified against its signing keys. That token
              expires at <code className="pv-code">{new Date(session.expiresAt).toISOString()}</code>;
              the widgets renew it in the browser, and the server never does.
            </p>
            <p>
              Rendered at <code className="pv-code">{renderedAt}</code>.
            </p>
          </div>
        </div>
      ) : (
        <div className="pv-empty">
          <h3>No session on the server</h3>
          <p>
            Rendered at <code className="pv-code">{renderedAt}</code> with no
            signed-in user. Sign in and reload: the server renders this page as
            you.
          </p>
          <Link href="/signin" className="pv-btn pv-btn--primary">
            Sign in
          </Link>
        </div>
      )}
    </div>
  );
}
