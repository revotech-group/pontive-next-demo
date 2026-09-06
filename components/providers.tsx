"use client";

import type { EnvConfig } from "@pontive/pontkit-nextjs";
import { Provider } from "./pontkit";

/**
 * `domain` is a PATH, not a hostname — `/__auth`, which `next.config.mjs`
 * rewrites onto the auth server. That is the whole point of the integration:
 * the browser only ever talks to this app's own origin, so the cookies the auth
 * server sets are first-party and survive `SameSite=Lax`.
 *
 * Every value here is public. The auth server's real hostname is `PONTIVE_AUTH_HOST`,
 * which is read in next.config.mjs at build time and never shipped to the
 * browser.
 */
const env: EnvConfig = {
  domain: process.env.NEXT_PUBLIC_PONTIVE_AUTH_DOMAIN!,
  appId: process.env.NEXT_PUBLIC_PONTIVE_APP_ID!,
  projectId: process.env.NEXT_PUBLIC_PONTIVE_PROJECT_ID!,
  apiBaseUrl: process.env.NEXT_PUBLIC_PONTIVE_API_BASE_URL!,
  signinUrl: "/signin",
  signupUrl: "/signup",
  signinRedirectUrl: "/",
};

export function Providers({ children }: { children: React.ReactNode }) {
  return <Provider env={env}>{children}</Provider>;
}
