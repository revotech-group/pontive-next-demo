# Pontive Next.js demo

Pontive auth in a Next.js app on Vercel, with the auth endpoints proxied under
the app's own origin.

## What this demonstrates

A browser treats a cookie as first-party only when it comes from the origin the
page is on. An app talking to an auth server on another hostname is cross-site,
so the refresh cookie is a third-party cookie — blocked outright in Safari, and
withheld everywhere for a production project, whose cookies are `SameSite=Lax`.
The symptom is a sign-in that appears to work and then reports *"no auth flow in
progress"* on the very next request.

The usual fix is a custom domain: a DNS record, a certificate, a verification
step. This app does it with a rewrite instead — the whole integration is three
lines:

```js
// next.config.mjs
import { authProxyRewrites } from "@pontive/pontkit-nextjs/server";

export default {
  async rewrites() {
    return authProxyRewrites({ authHost: process.env.PONTIVE_AUTH_HOST });
  },
};
```

`/__auth/auth/v1/*` and `/__auth/oauth2/*` are now served from this app's own
origin, so every cookie the auth server sets is first-party. The SDK is pointed
at the path rather than the hostname:

```ts
<Provider env={{ domain: "/__auth", appId, ... }}>
```

No DNS record, no certificate, no CDN configuration. A rewrite to an external
destination sends the destination's Host upstream, which is what the auth server
needs to resolve which project it is answering as — so there is no header to
configure and nothing to get wrong.

## Server rendering, and why it is no longer a gotcha

This used to be the hard part. The React bindings declared their component
classes as `class SbProvider extends HTMLElement {}` at module scope, so
importing them on a server threw `ReferenceError: HTMLElement is not defined` —
and `"use client"` was no defence, because Next renders client components on the
server too. Every widget had to be wrapped in `next/dynamic` with `ssr: false`.

Those placeholder classes are gone. `@pontive/pontkit-react` takes the element
types from `@pontive/pontkit-core` with `import type`, which erases at build,
so there is nothing left to evaluate on a server.

`components/pontkit.tsx` is therefore a plain re-export file now. It keeps
`"use client"` because these are custom elements driven by browser APIs and
there is nothing for a server to do with them beyond rendering the placeholder
they hydrate into — but that is a statement about where they belong, not a
workaround for a crash.

## Running it

```bash
npm install
npm run dev
```


Two things have to be true of the project this app points at, or sign-in fails
with a 403 before anything interesting happens:

1. **The origin must be registered on the app.** `http://localhost:3000` for
   local development, and the deployed URL for Vercel. Without it auth-api
   answers `{"error":{"code":"ForbiddenError","message":"origin is not allowed
   for this app"}}`.
2. **A `localhost` origin must not be blocked at the edge.** The dev
   deployment's WAF currently refuses any flow-start whose `origin_url` has a
   `localhost` or `127.0.0.1` host, with a CloudFront "Request blocked" page
   rather than a JSON error. Local sign-in cannot work until that rule carries an
   exclusion for `/auth/v1/authflows/*`.

Neither applies to a deployed Vercel URL, which is a real `https` origin.

## Deploying to Vercel

Import the repo; the defaults are correct and no `vercel.json` is needed —
`next.config.mjs` rewrites are honoured as-is. Set these in the project's
environment variables:

| Variable | Value | Reaches the browser |
|---|---|---|
| `PONTIVE_AUTH_HOST` | the auth server's hostname | no — build-time only |
| `NEXT_PUBLIC_PONTIVE_AUTH_DOMAIN` | `/__auth` | yes |
| `NEXT_PUBLIC_PONTIVE_APP_ID` | the app id | yes |
| `NEXT_PUBLIC_PONTIVE_PROJECT_ID` | the project id — not read by the API client any more (the token names the project); kept only until the framework packages are rebuilt without it | yes |
| `NEXT_PUBLIC_PONTIVE_API_BASE_URL` | the management gateway, e.g. `https://api.us.pontive.com`; the SDK calls it from the browser with the user's bearer token | yes |

Then register the deployment's URL as an allowed origin on the app. That one
registration governs both surfaces: the auth server's CORS allowlist, and the
management gateway's per-app origin check on every call `<AccountSettings>`
makes with the user's token.

`PONTIVE_AUTH_HOST` is deliberately not `NEXT_PUBLIC_` — the browser never needs the
auth server's real hostname, and keeping it out of the bundle is what makes the
proxy path the only one the app knows about.

## Verifying the proxy

Against a running instance, these two say whether the rewrite and the Host are
both right:

```bash
curl -i localhost:3000/__auth/auth/v1/apps/$APP_ID/branding.css   # 200 text/css
curl -i -X POST localhost:3000/__auth/oauth2/token                # 400 grant_type is required
```

A 200 stylesheet means the project resolved, which only happens if the auth
server received its own hostname as Host. HTML back instead means the rewrite
did not match and Next served the app itself.
