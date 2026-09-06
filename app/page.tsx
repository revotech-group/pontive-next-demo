import Link from "next/link";
import { SignedIn, SignedOut } from "@/components/pontkit";

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

const features = [
  {
    title: "No DNS record",
    body: "The rewrite lives in next.config.mjs. Nothing to register, nothing to propagate, nothing to verify.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18Z" />
      </svg>
    ),
  },
  {
    title: "No certificate",
    body: "Requests never leave the app's own origin, so they are covered by the certificate the deployment already has.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="4" y="10" width="16" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 1 1 8 0v3" />
      </svg>
    ),
  },
  {
    title: "First-party cookies",
    body: "The refresh cookie comes from the origin the page is on, so Safari keeps it and SameSite=Lax still sends it.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3a9 9 0 1 0 9 9a4 4 0 0 1-5-5a4 4 0 0 1-4-4Z" />
        <path d="M9 12h.01M13 16h.01M15 10h.01" />
      </svg>
    ),
  },
];

export default function Home() {
  return (
    <>
      <section className="pv-hero">
        <div className="pv-container pv-hero__inner">
          <span className="pv-eyebrow">
            <span className="pv-eyebrow__dot" aria-hidden="true" />
            Same-origin auth
          </span>
          <h1>Auth on this app&apos;s own origin</h1>
          <p>
            The auth endpoints are served from{" "}
            <code className="pv-code">/__auth</code>, rewritten onto the auth
            server by <code className="pv-code">next.config.mjs</code>. The
            browser never talks to another origin, so every cookie it gets back
            is first-party.
          </p>
          <div className="pv-hero__actions">
            <SignedOut>
              <Link href="/signup" className="pv-btn pv-btn--primary pv-btn--lg">
                Create an account
              </Link>
              <Link href="/signin" className="pv-btn pv-btn--ghost pv-btn--lg">
                Sign in
              </Link>
            </SignedOut>
            <SignedIn>
              <Link href="/profile" className="pv-btn pv-btn--primary pv-btn--lg">
                Go to your account
              </Link>
            </SignedIn>
          </div>
        </div>
      </section>

      <section className="pv-section">
        <div className="pv-container">
          <div className="pv-card">
            <div className="pv-flow">
              <div className="pv-flow__node">
                <span className="pv-flow__label">Browser</span>
                <span className="pv-flow__title">the page you are on</span>
                <span className="pv-flow__note">One origin, start to finish</span>
              </div>

              <div className="pv-flow__arrow" aria-hidden="true">
                <ArrowIcon />
              </div>

              <div className="pv-flow__node pv-flow__node--origin">
                <span className="pv-flow__label">This app</span>
                <span className="pv-flow__title">/__auth/auth/v1/*</span>
                <span className="pv-flow__note">A rewrite, not a redirect</span>
              </div>

              <div className="pv-flow__arrow" aria-hidden="true">
                <ArrowIcon />
              </div>

              <div className="pv-flow__node">
                <span className="pv-flow__label">Upstream</span>
                <span className="pv-flow__title">the auth server</span>
                <span className="pv-flow__note">
                  Receives its own Host, so it knows which project it is
                </span>
              </div>
            </div>

            <p className="pv-flow__caption">
              The hostname on the right never reaches the browser — it is a
              build-time variable, and the bundle only knows the path.
            </p>
          </div>
        </div>
      </section>

      <section className="pv-section">
        <div className="pv-container">
          <div className="pv-section__head">
            <span className="pv-kicker">What it replaces</span>
            <h2>The custom-domain setup, minus the setup</h2>
            <p>
              Pointing an app at an auth server on another hostname makes the
              refresh cookie third-party. The usual fix is a custom domain. This
              is the same result from a rewrite.
            </p>
          </div>

          <div className="pv-grid">
            {features.map((feature) => (
              <article key={feature.title} className="pv-card pv-feature">
                <span className="pv-feature__icon" aria-hidden="true">
                  {feature.icon}
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="pv-section">
        <div className="pv-container pv-container--narrow">
          <div className="pv-section__head">
            <span className="pv-kicker">The whole integration</span>
            <h2>Three lines of config</h2>
          </div>

          <div className="pv-codeblock">
            <div className="pv-codeblock__bar">
              <span className="pv-codeblock__dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              <span className="pv-codeblock__name">next.config.mjs</span>
            </div>
            <pre>
              <code>
                <span className="pv-tok-key">import</span> {"{ authProxyRewrites }"}{" "}
                <span className="pv-tok-key">from</span>{" "}
                <span className="pv-tok-str">
                  &quot;@pontive/pontkit-nextjs/server&quot;
                </span>
                ;{"\n\n"}
                <span className="pv-tok-key">export default</span> {"{"}
                {"\n"}
                {"  "}
                <span className="pv-tok-key">async</span> rewrites() {"{"}
                {"\n"}
                {"    "}
                <span className="pv-tok-key">return</span> authProxyRewrites({"{"}{" "}
                authHost: process.env.PONTIVE_AUTH_HOST {"}"});{"\n"}
                {"  "}
                {"}"},{"\n"}
                {"}"};{"\n"}
              </code>
            </pre>
          </div>
        </div>
      </section>

      <section className="pv-section">
        <div className="pv-container pv-container--narrow">
          <SignedOut>
            <div className="pv-card pv-session">
              <div className="pv-session__body">
                <span className="pv-status">
                  <span className="pv-status__dot" aria-hidden="true" />
                  Signed out
                </span>
                <h3>Nothing in the session yet</h3>
                <p>
                  <Link href="/signin">Sign in</Link> and then reload the page —
                  the session comes back, which is the part that only works when
                  the refresh cookie is first-party.
                </p>
              </div>
            </div>
          </SignedOut>

          <SignedIn>
            <div className="pv-card pv-session">
              <div className="pv-session__body">
                <span className="pv-status pv-status--on">
                  <span className="pv-status__dot" aria-hidden="true" />
                  Signed in
                </span>
                <h3>The session survives a reload</h3>
                <p>
                  Reload this page. Nothing is held in local storage — the
                  session is rebuilt from the refresh cookie, which the browser
                  only sends because it came from this origin.
                </p>
              </div>
            </div>
          </SignedIn>
        </div>
      </section>
    </>
  );
}
