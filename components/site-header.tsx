"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignedIn, SignedOut, NavUser } from "@/components/saasbase";
import { ThemeToggle } from "@/components/theme-toggle";

const links = [
  { href: "/", label: "Overview" },
  { href: "/profile", label: "Account" },
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
            <NavUser accountSettingsPath="/profile" />
          </SignedIn>
        </div>
      </div>
    </header>
  );
}
