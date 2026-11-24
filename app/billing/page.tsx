import { Suspense } from "react";
import Link from "next/link";
import { SignedIn, SignedOut } from "@/components/pontkit";
import { BillingPanel } from "@/components/billing-panel";

export default function BillingPage() {
  return (
    <div className="pv-container pv-page">
      <div className="pv-page__head">
        <span className="pv-kicker">Billing</span>
        <h1>Billing</h1>
        <p>
          Buy a plan for yourself or for the organization you are signed in
          to, then change it, pay its invoices and manage how you pay, without
          leaving the app. Card details go only into Stripe&apos;s own frames.
        </p>
      </div>

      <SignedIn>
        {/*
          `<Checkout>` and `<BillingPortal>` call
          NEXT_PUBLIC_PONTIVE_API_BASE_URL/mgmt/v1/me/billing with a
          management-API token drawn through the refresh cookie on /__pontive,
          carrying `pontive:billing:read` and `pontive:billing:pay`. Payment
          forms are Stripe's Payment Element, loaded from js.stripe.com only
          when one is needed; this route's Content Security Policy is in
          next.config.mjs. Suspense because the panel reads the query (the
          checkout's return).
        */}
        <Suspense fallback={null}>
          <BillingPanel />
        </Suspense>
      </SignedIn>

      <SignedOut>
        <div className="pv-empty">
          <h3>Nothing to show yet</h3>
          <p>Sign in to buy a plan or manage the one you have.</p>
          <Link href="/signin" className="pv-btn pv-btn--primary">
            Sign in
          </Link>
        </div>
      </SignedOut>
    </div>
  );
}
