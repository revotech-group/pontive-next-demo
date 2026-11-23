"use client";

import { Provider } from "./pontkit";

/**
 * `domain` is a PATH, not a hostname — `/__pontive`, which `next.config.mjs`
 * rewrites onto the auth server. That is the whole point of the integration:
 * the browser only ever talks to this app's own origin, so the cookies the auth
 * server sets are first-party and survive `SameSite=Lax`.
 *
 * Every value here is public. The auth server's real hostname is `PONTIVE_AUTH_HOST`,
 * which is read in next.config.mjs at build time and never shipped to the
 * browser. The SDK is not passed: `<Provider>` injects `Auth` from
 * `@pontive/oidc-client` itself.
 *
 * `apiBaseUrl` is the management gateway the account widgets call; it must be
 * absolute, since the auth proxy does not forward `/me` or `/mgmt/v1`.
 */
/**
 * `scope` is what sign-in asks for, and it replaces the default
 * `openid email profile`, so those stay listed. The three `pontive:org:member:*`
 * scopes let `<MemberManagement>` on /members draw a management-API token
 * (pontive-spec 41): the app must be allowed them ("Organization member
 * management for end users" on the app), refresh tokens must be on, and the
 * user's organization roles still decide what each person can do. They never
 * ride on the app's own access token, so the server routes here never see them.
 */
const SCOPE =
  "openid email profile pontive:org:member:read pontive:org:member:manage pontive:org:member:invite";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider
      domain={process.env.NEXT_PUBLIC_PONTIVE_AUTH_DOMAIN!}
      appId={process.env.NEXT_PUBLIC_PONTIVE_APP_ID!}
      apiBaseUrl={process.env.NEXT_PUBLIC_PONTIVE_API_BASE_URL!}
      signinUrl="/signin"
      signupUrl="/signup"
      signinRedirectUrl="/"
      scope={SCOPE}
    >
      {children}
    </Provider>
  );
}
