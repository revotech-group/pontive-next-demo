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
 * These rewrites put `/__pontive/auth/v1/*` and `/__pontive/oauth2/*` on this app's own
 * origin, so every cookie the auth server sets is first-party. No DNS record, no
 * certificate, no CDN configuration — a rewrite to an external destination sends
 * the destination's Host upstream, which is exactly what the auth server needs to
 * resolve which project it is answering as.
 *
 * PONTIVE_AUTH_HOST is read at build time and never reaches the browser; the browser
 * only ever sees NEXT_PUBLIC_PONTIVE_AUTH_DOMAIN, which is the path above.
 */
const nextConfig = {
  /**
   * Emits `.next/standalone` — a minimal `server.js` plus only the traced
   * `node_modules`, runnable without an `npm install`. This is what the
   * container runs; see the Dockerfile.
   *
   * It does not copy `.next/static` (or `public/`, which this app has none of),
   * because those are meant for a CDN. The Dockerfile copies `.next/static`
   * in explicitly so `server.js` serves it.
   */
  output: "standalone",

  /**
   * Sharp is the only architecture-specific thing in the traced output, and it
   * is 27MB of 46MB. Excluding it makes `.next/standalone` pure JavaScript,
   * which is what lets the image be built for arm64 on an x86 runner: the
   * builder stage runs natively and the runtime stage is arm64, with no QEMU
   * anywhere. Without this, an x86 build would silently copy an
   * `@img/sharp-linux-x64` binary into a Graviton image.
   *
   * Safe because this app renders no `next/image`. If one is ever added, drop
   * this and the build has to emulate — or optimize images somewhere else.
   */
  outputFileTracingExcludes: {
    "**/*": ["node_modules/sharp/**", "node_modules/@img/**"],
  },

  async rewrites() {
    return authProxyRewrites({ authHost: process.env.PONTIVE_AUTH_HOST });
  },

  /**
   * The billing page's Content Security Policy: the one pontkit-core's
   * docs/kit/checkout.md publishes for a page with `<pont-checkout>` or
   * `<pont-billing-portal>`, set here so the documented policy is tested where
   * a client would use it (billing-svc docs/m17-design.md, R12).
   */
  async headers() {
    return [
      {
        source: "/billing",
        headers: [{ key: "Content-Security-Policy", value: billingCsp() }],
      },
    ];
  },
};

/**
 * Built from the origins the page really talks to:
 *
 * - Stripe.js and the Payment Element's frames (`js.stripe.com`), 3D Secure
 *   and redirecting methods (`hooks.stripe.com`), Stripe's own calls
 *   (`api.stripe.com`, and Google Maps for its address autocomplete).
 * - The management gateway the billing routes are on
 *   (NEXT_PUBLIC_PONTIVE_API_BASE_URL).
 * - The kit itself, which the loader fetches at the release the platform
 *   names: from the platform's CDN (`cdn.pontive.com`), falling back to the
 *   public npm CDNs.
 * - Everything else (the auth server, the theme, the widgets' words) is on
 *   this origin through /__pontive.
 *
 * `'unsafe-inline'` in `script-src` is for Next's inline bootstrap and the
 * theme script, and in `style-src` for the style attributes the elements
 * set; `'unsafe-eval'` only for `next dev`. A header applies to a page load
 * only, so the policy covers /billing opened directly, not a client-side
 * navigation to it from another page.
 */
function billingCsp() {
  const dev = process.env.NODE_ENV === "development";
  const api = originOf(process.env.NEXT_PUBLIC_PONTIVE_API_BASE_URL);
  const kit = [
    "https://cdn.pontive.com",
    "https://cdn.jsdelivr.net",
    "https://unpkg.com",
    "https://esm.sh",
  ];
  const stripe = ["https://js.stripe.com", "https://*.js.stripe.com"];

  const directives = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : []), ...kit, ...stripe],
    "style-src": ["'self'", "'unsafe-inline'", ...kit, "https://fonts.googleapis.com"],
    "font-src": ["'self'", "data:", "https://fonts.gstatic.com"],
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "frame-src": [...stripe, "https://hooks.stripe.com"],
    "connect-src": [
      "'self'",
      ...(api ? [api] : []),
      "https://api.stripe.com",
      "https://maps.googleapis.com",
      ...kit,
    ],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };

  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}

function originOf(url) {
  try {
    return url ? new URL(url).origin : null;
  } catch {
    return null;
  }
}

export default nextConfig;
