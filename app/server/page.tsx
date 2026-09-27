import Link from "next/link";

import { ORGANIZATION_ERROR_PARAM } from "@pontive/pontkit-nextjs/server";

import { pontive } from "@/lib/pontive";

// Read per request: this page is the signed-in user's, not a static one.
export const dynamic = "force-dynamic";

export default async function ServerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await pontive().auth();
  const organizationError = (await searchParams)[ORGANIZATION_ERROR_PARAM];
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

      ) : null}

      {session ? (
        <div className="pv-card pv-session">
          <div className="pv-session__body">
            <span className="pv-kicker">Organization</span>
            {session.organization ? (
              <>
                <h3>{session.organization.id}</h3>
                <p>
                  Role <code className="pv-code">{session.organization.role ?? "none"}</code>
                  {session.organization.roles.length > 1 ? (
                    <>
                      {" "}of <code className="pv-code">{session.organization.roles.join(", ")}</code>
                    </>
                  ) : null}
                  ; permissions{" "}
                  <code className="pv-code">
                    {session.organization.permissions.length ? session.organization.permissions.join(", ") : "none"}
                  </code>
                  . Read from the same access token: the auth server re-resolves them on every refresh.
                </p>
              </>
            ) : (
              <p>
                This session acts in no organization: a B2C user, or one with several organizations whose app has not
                picked one. Nobody is asked to choose at sign-in.
              </p>
            )}
            {organizationError ? (
              <p className="pv-status">
                Switch refused: <code className="pv-code">{String(organizationError)}</code>. The session is unchanged.
              </p>
            ) : null}
            <form action="/api/auth/switch-organization" method="get" className="pv-inline-form">
              <input type="hidden" name="returnTo" value="/server" />
              <input name="organization_id" placeholder="org_…" required className="pv-input" />
              <button type="submit" className="pv-btn">
                Switch organization
              </button>
            </form>
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
