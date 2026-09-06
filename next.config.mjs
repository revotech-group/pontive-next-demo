import { authProxyRewrites } from "@pontive/pontkit-nextjs/server";

/**
 * The whole auth integration, on the deployment side.
 *
 * A browser only treats a cookie as first-party when it comes from the origin
 * the page is on. An app talking to an auth server on another hostname is
 * cross-site, so the refresh cookie is a third-party cookie — blocked outright
 * in Safari, and withheld everywhere when the project's cookies are SameSite=Lax,
 * which is what a production project gets. The symptom is a sign-in that appears
 * to work and then reports "no auth flow in progress" on the very next request.
 *
 * These rewrites put `/__auth/auth/v1/*` and `/__auth/oauth2/*` on this app's own
 * origin, so every cookie the auth server sets is first-party. No DNS record, no
 * certificate, no CDN configuration — a rewrite to an external destination sends
 * the destination's Host upstream, which is exactly what the auth server needs to
 * resolve which project it is answering as.
 *
 * PONTIVE_AUTH_HOST is read at build time and never reaches the browser; the browser
 * only ever sees NEXT_PUBLIC_PONTIVE_AUTH_DOMAIN, which is the path above.
 */
const nextConfig = {
  async rewrites() {
    return authProxyRewrites({ authHost: process.env.PONTIVE_AUTH_HOST });
  },
};

export default nextConfig;
