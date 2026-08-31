import Link from "next/link";
import { SignedIn, SignedOut, NavUser } from "@/components/saasbase";

export default function Home() {
  return (
    <>
      <nav>
        <Link href="/">Pontive Next.js demo</Link>
        <span className="spacer" />
        <SignedOut>
          <Link href="/signin">Sign in</Link>
          <Link href="/signup">Sign up</Link>
        </SignedOut>
        <SignedIn>
          <NavUser accountSettingsPath="/profile" />
        </SignedIn>
      </nav>

      <main>
        <h1>Auth on this app&apos;s own origin</h1>
        <p>
          The auth endpoints are served from <code>/__auth</code> here, rewritten
          onto the auth server by <code>next.config.mjs</code>. The browser never
          talks to another origin, so every cookie is first-party — no DNS
          record, no certificate, no CDN configuration.
        </p>

        <SignedOut>
          <p>
            You are signed out. <Link href="/signin">Sign in</Link> to see the
            session survive a reload.
          </p>
        </SignedOut>

        <SignedIn>
          <p>
            You are signed in. Reload the page: the session is rebuilt from the
            refresh cookie, which only works because that cookie is first-party.
          </p>
        </SignedIn>
      </main>
    </>
  );
}
