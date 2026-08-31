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
import { authProxyRewrites } from "@saasbase-io/elements/proxy";

export default {
  async rewrites() {
    return authProxyRewrites({ authHost: process.env.SB_AUTH_HOST });
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

## The one gotcha: server rendering

`@saasbase-io/elements/react` declares its component classes as
`class SbProvider extends HTMLElement {}` at module scope. Importing it on the
server throws `ReferenceError: HTMLElement is not defined`, and `"use client"`
does not prevent that — Next renders client components on the server too.

So every widget is imported through `next/dynamic` with `ssr: false`, collected
in `components/saasbase.tsx`. That directive is only allowed inside a client
component, which is why the pages import from there rather than from the package.
The widgets are custom elements fetched from a CDN at runtime and render nothing
on first paint regardless, so this costs nothing.

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
| `SB_AUTH_HOST` | the auth server's hostname | no — build-time only |
| `NEXT_PUBLIC_SB_AUTH_DOMAIN` | `/__auth` | yes |
| `NEXT_PUBLIC_SB_APP_ID` | the app id | yes |
| `NEXT_PUBLIC_SB_PROJECT_ID` | the project id | yes |
| `NEXT_PUBLIC_SB_API_BASE_URL` | the management API base | yes |

Then register the deployment's URL as an allowed origin on the app.

`SB_AUTH_HOST` is deliberately not `NEXT_PUBLIC_` — the browser never needs the
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
