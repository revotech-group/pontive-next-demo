"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import {
  BillingPortal,
  Checkout,
  useAccountClient,
  useSession,
} from "@/components/pontkit";

/**
 * The billing page's client half (billing-svc docs/m17-design.md, Part 4, P70).
 *
 * It asks the kit's account client which Customers the signed-in user may
 * see (`GET /mgmt/v1/me/billing/customers`), offers the user's own and the
 * current organization's, and shows `<Checkout>` for one with no plan and
 * `<BillingPortal>` for one with a plan. Every call goes out with a
 * management-API token drawn through the refresh cookie on /__pontive, which
 * carries `pontive:billing:read` and `pontive:billing:pay` (see
 * components/providers.tsx).
 *
 * The kit's types come from @pontive/pontkit-core, which this app never
 * installs (the loader fetches it), so the few fields read here are typed
 * locally.
 */

/** A Customer the user may see, as `GET /me/billing/customers` lists it. */
interface BillingAccount {
  id: string;
  subject: { type: "user" | "organization"; id: string };
  name?: string;
  email?: string;
  permissions?: { read: boolean; pay: boolean };
  /** A suspended organization its owner may recover (P79). */
  recovery?: boolean;
}

interface BillingClient {
  getUser(): { sub?: string; email?: string; name?: string } | null;
  getOrganization(): { id: string } | null;
  listMyOrganizations(): Promise<{ id: string; name?: string }[]>;
  listBillingAccounts(): Promise<BillingAccount[]>;
  listMyContracts(options?: {
    subject?: BillingAccount["subject"];
  }): Promise<{ status: string }[]>;
}

/** One choice in "Bill to": the user, an organization, or a suspended one. */
interface Choice {
  /** `usr_...` or `org_...`: what the widgets get as `subject`. */
  subject: string;
  kind: "user" | "organization";
  label: string;
  detail: string;
  account: BillingAccount | null;
  /** A contract in force (or scheduled), as the portal reads it. */
  hasPlan: boolean;
}

type Loaded =
  | { key: string; choices: Choice[] }
  | { key: string; failed: string };

/** The contract statuses the portal shows a plan for (pontkit-core `currentContract`). */
const PLAN_STATUSES = ["trialing", "active", "ending", "scheduled"];

/**
 * What `<Checkout>` offers: package ids or keys with their frequencies, set at
 * build time for the instance this image signs in against. Public, like every
 * NEXT_PUBLIC_ value.
 */
const PACKAGES = process.env.NEXT_PUBLIC_PONTIVE_BILLING_PACKAGES ?? "";

/**
 * Both on this app's own origin, which billing-svc checks against the
 * request's (P71). The element makes them absolute on this page; the success
 * URL comes back with `?checkout_session_id=`.
 */
const SUCCESS_URL = "/billing";
const CANCEL_URL = "/billing?checkout=cancelled";

function isBillingClient(client: unknown): client is BillingClient {
  const c = client as Partial<BillingClient> | undefined;
  return (
    typeof c?.listBillingAccounts === "function" &&
    typeof c?.listMyContracts === "function"
  );
}

function errorCode(error: unknown): string {
  const e = error as { code?: unknown; status?: unknown } | null;
  if (e && typeof e.code === "string") return e.code;
  if (e && typeof e.status === "number") return `HTTP ${e.status}`;
  return "unknown_error";
}

async function hasPlan(client: BillingClient, account: BillingAccount) {
  // A recovery account is always shown in the portal: checkout is not one of
  // its actions (P79), and its contracts are read there.
  if (account.recovery) return true;
  const contracts = await client.listMyContracts({ subject: account.subject });
  return contracts.some((c) => PLAN_STATUSES.includes(c.status));
}

async function loadChoices(client: BillingClient): Promise<Choice[]> {
  const user = client.getUser();
  const organization = client.getOrganization();

  const [accounts, organizations] = await Promise.all([
    client.listBillingAccounts(),
    // Only for the organization's name; the id is enough without it.
    client.listMyOrganizations().catch(() => []),
  ]);

  const byId = new Map(accounts.map((a) => [a.subject.id, a]));
  const listed: Omit<Choice, "hasPlan">[] = [];

  if (user?.sub) {
    listed.push({
      subject: user.sub,
      kind: "user",
      label: "Personal",
      detail: user.email ?? user.name ?? user.sub,
      account: byId.get(user.sub) ?? null,
    });
  }

  if (organization) {
    const account = byId.get(organization.id) ?? null;
    const name =
      organizations.find((o) => o.id === organization.id)?.name ??
      account?.name ??
      organization.id;
    listed.push({
      subject: organization.id,
      kind: "organization",
      label: name,
      detail: "The organization you are signed in to",
      account,
    });
  }

  // Anything else billing lists: a suspended organization its owner may
  // recover (P79), which the session's token no longer names.
  for (const account of accounts) {
    if (listed.some((c) => c.subject === account.subject.id)) continue;
    listed.push({
      subject: account.subject.id,
      kind: account.subject.type,
      label: account.name ?? account.subject.id,
      detail: account.recovery
        ? "Suspended for non-payment"
        : "Another account you may see",
      account,
    });
  }

  return Promise.all(
    listed.map(async (choice) => ({
      ...choice,
      hasPlan: choice.account ? await hasPlan(client, choice.account) : false,
    })),
  );
}

/** The default: an account with a plan, the organization's first, else the user's. */
function defaultChoice(choices: Choice[]): Choice | undefined {
  return (
    choices.find((c) => c.kind === "organization" && c.hasPlan && !c.account?.recovery) ??
    choices.find((c) => c.kind === "user" && c.hasPlan) ??
    choices.find((c) => c.account?.recovery) ??
    choices.find((c) => c.kind === "organization") ??
    choices[0]
  );
}

export function BillingPanel() {
  const client = useAccountClient();
  const session = useSession();
  const params = useSearchParams();

  const [reloads, setReloads] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [showPortal, setShowPortal] = useState(false);
  const [recovering, setRecovering] = useState<string | null>(null);
  const [recoveryInput, setRecoveryInput] = useState("");
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  const billing = isBillingClient(client) ? client : null;
  // What the list depends on: the organization the session acts in. A token
  // refresh changes nothing here, so it does not read the list again.
  const organizationId =
    session?.organizationId ?? billing?.getOrganization()?.id ?? "";
  const key = `${organizationId}|${reloads}`;

  useEffect(() => {
    if (!billing) return;
    let cancelled = false;
    loadChoices(billing).then(
      (choices) => {
        if (!cancelled) setLoaded({ key, choices });
      },
      (error: unknown) => {
        if (!cancelled) setLoaded({ key, failed: errorCode(error) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [billing, key]);

  const notice = params.get("checkout_session_id")
    ? "Payment received. Your plan is below."
    : params.get("checkout") === "cancelled"
      ? "Checkout cancelled. Nothing was charged."
      : null;

  if (!client) {
    return <Loading />;
  }

  if (!billing) {
    return (
      <div className="pv-empty">
        <h3>Billing is not available here</h3>
        <p>
          This version of the kit has no billing client. Billing needs
          pontkit-core 1.44.0 or later.
        </p>
      </div>
    );
  }

  function recover(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = recoveryInput.trim();
    if (!/^org_[0-9a-z]+$/i.test(id)) {
      setRecoveryError("Enter an organization id, such as org_06gk...");
      return;
    }
    setRecoveryError(null);
    setRecovering(id);
  }

  const recoveryForm = (
    <details className="pv-card pv-billing__recovery" open={recovering !== null}>
      <summary>Recover a suspended organization</summary>
      <p>
        An organization that billing suspended for non-payment drops out of
        your session, so the switcher no longer offers it. Its owner can still
        open its billing here, pay the open invoice and lift the suspension.
      </p>
      <form className="pv-inline-form" onSubmit={recover}>
        <label className="pv-visually-hidden" htmlFor="pv-recovery-id">
          Organization id
        </label>
        <input
          id="pv-recovery-id"
          className="pv-input"
          placeholder="org_..."
          value={recoveryInput}
          onChange={(event) => setRecoveryInput(event.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        <button type="submit" className="pv-btn pv-btn--ghost">
          Open its billing
        </button>
      </form>
      {recoveryError ? <p className="pv-billing__error">{recoveryError}</p> : null}
    </details>
  );

  // The owner named a suspended organization: the portal with `subject` set,
  // which shows only the recovery actions (P79).
  if (recovering) {
    return (
      <div className="pv-billing">
        <div className="pv-billing__bar">
          <span className="pv-status">
            <span className="pv-status__dot" aria-hidden="true" />
            Recovery
          </span>
          <code className="pv-code">{recovering}</code>
          <span className="pv-billing__spacer" />
          <button
            type="button"
            className="pv-btn pv-btn--quiet"
            onClick={() => {
              setRecovering(null);
              setReloads((n) => n + 1);
            }}
          >
            Back to your billing
          </button>
        </div>
        <BillingPortal key={`recovery-${recovering}`} subject={recovering} />
      </div>
    );
  }

  if (!loaded || loaded.key !== key) {
    return <Loading />;
  }

  // The list was refused. The portal, unscoped, says why in the kit's own
  // words: an app without the billing scopes, a user who may not see this
  // billing, or billing not enabled on the instance.
  if ("failed" in loaded) {
    return (
      <div className="pv-billing">
        <BillingPortal key={`failed-${key}`} />
        <p className="pv-billing__hint">
          The list of your billing accounts was refused (
          <code className="pv-code">{loaded.failed}</code>).{" "}
          <button
            type="button"
            className="pv-btn pv-btn--quiet"
            onClick={() => setReloads((n) => n + 1)}
          >
            Try again
          </button>
        </p>
        {recoveryForm}
      </div>
    );
  }

  const choices = loaded.choices;
  const current =
    choices.find((c) => c.subject === chosen) ?? defaultChoice(choices);

  if (!current) {
    return (
      <div className="pv-empty">
        <h3>Nothing to bill</h3>
        <p>Your session names no user, so there is no account to bill.</p>
      </div>
    );
  }

  const portal = current.hasPlan || (showPortal && current.account !== null);

  return (
    <div className="pv-billing">
      {notice ? <p className="pv-billing__notice">{notice}</p> : null}

      {choices.length > 1 ? (
        <fieldset className="pv-billing__choices">
          <legend className="pv-kicker">Bill to</legend>
          {choices.map((choice) => (
            <label
              key={choice.subject}
              className="pv-billing__choice"
              data-selected={choice.subject === current.subject || undefined}
            >
              <input
                type="radio"
                name="pv-bill-to"
                value={choice.subject}
                checked={choice.subject === current.subject}
                onChange={() => {
                  setChosen(choice.subject);
                  setShowPortal(false);
                }}
              />
              <span className="pv-billing__choice-body">
                <span className="pv-billing__choice-label">{choice.label}</span>
                <span className="pv-billing__choice-detail">{choice.detail}</span>
              </span>
              <span
                className={
                  choice.hasPlan && !choice.account?.recovery
                    ? "pv-status pv-status--on"
                    : "pv-status"
                }
              >
                {choice.account?.recovery
                  ? "Suspended"
                  : choice.hasPlan
                    ? "Plan"
                    : "No plan"}
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}

      {portal ? (
        <BillingPortal key={`portal-${current.subject}`} subject={current.subject} />
      ) : PACKAGES ? (
        <>
          <Checkout
            key={`checkout-${current.subject}`}
            packages={PACKAGES}
            subject={current.subject}
            successUrl={SUCCESS_URL}
            cancelUrl={CANCEL_URL}
          />
          {current.account ? (
            <p className="pv-billing__hint">
              No plan yet, but there is billing history.{" "}
              <button
                type="button"
                className="pv-btn pv-btn--quiet"
                onClick={() => setShowPortal(true)}
              >
                See invoices and payment methods
              </button>
            </p>
          ) : null}
        </>
      ) : (
        <div className="pv-empty">
          <h3>No packages to offer</h3>
          <p>
            This build sets no{" "}
            <code className="pv-code">NEXT_PUBLIC_PONTIVE_BILLING_PACKAGES</code>,
            so checkout has nothing to sell.
          </p>
        </div>
      )}

      {recoveryForm}
    </div>
  );
}

function Loading() {
  return (
    <div className="pv-card pv-billing__loading" aria-busy="true">
      Reading your billing...
    </div>
  );
}
