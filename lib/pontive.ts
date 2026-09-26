import { pontiveAuth, type PontiveAuth } from "@pontive/pontkit-nextjs/server";

/**
 * The server's view of the session the widgets keep in the browser.
 *
 * No client secret, so the SDK runs in browser mode: the widgets sign the user
 * in and are the only thing that refreshes. Through the /__auth proxy the auth
 * server keeps an HttpOnly access-token cookie on this origin, and the server
 * reads and verifies that — it never spends the refresh token itself, so
 * refresh-token rotation never sees it spent twice.
 *
 * Built on first use: PONTIVE_AUTH_HOST is read when a request needs it, never
 * while the app builds.
 */
let instance: PontiveAuth | null = null;

export function pontive(): PontiveAuth {
  instance ??= pontiveAuth({
    // The app's issuer is its auth domain.
    issuer: `https://${process.env.PONTIVE_AUTH_HOST}`,
    clientId: process.env.NEXT_PUBLIC_PONTIVE_APP_ID!,
    authPath: process.env.NEXT_PUBLIC_PONTIVE_AUTH_DOMAIN || "/__auth",
  });

  return instance;
}
