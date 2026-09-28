"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignedIn, SignedOut, AccountMenu, OrganizationSwitcher } from "@/components/pontkit";
import { ThemeToggle } from "@/components/theme-toggle";

const links = [
  { href: "/", label: "Overview" },
  { href: "/profile", label: "Account" },
  { href: "/server", label: "Server" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="pv-header">
      <div className="pv-container pv-header__inner">
        <Link href="/" className="pv-brand">
          <span className="pv-brand__mark" aria-hidden="true">
            P
          </span>
          <span className="pv-brand__text">
            Pontive <span className="pv-brand__suffix">/ Next.js</span>
          </span>
        </Link>

        <nav className="pv-header__nav" aria-label="Main">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="pv-navlink"
              aria-current={pathname === link.href ? "page" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <span className="pv-header__spacer" />

        <div className="pv-header__actions">
          <ThemeToggle />
          <SignedOut>
            <Link href="/signin" className="pv-btn pv-btn--quiet">
              Sign in
            </Link>
            <Link href="/signup" className="pv-btn pv-btn--primary">
              Sign up
            </Link>
          </SignedOut>
          <SignedIn>
            {/* The organization the session acts in, and the ones it can move
                to. Hidden for a user with no organizations. reloadOnSwitch,
                because /server renders from the access-token cookie and must
                be re-requested to show the new organization. */}
            <OrganizationSwitcher reloadOnSwitch />
            <AccountMenu accountSettingsPath="/profile" />
          </SignedIn>
        </div>
      </div>
    </header>
  );
}
