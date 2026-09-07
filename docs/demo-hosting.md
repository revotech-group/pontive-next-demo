# Hosting the PontKit framework demos

Status: decided 2026-09-07. Not yet implemented — this repo still deploys to Vercel ad hoc and no other demo exists.
Scope: where to host the per-framework PontKit demos (`pontive-next-demo`, `pontive-react-demo`, and the Nuxt/Angular/Svelte demos to come) so prospective customers can try a real sign-in, and what that costs as the number of demos grows.

## Revision history

| Date | Change |
|---|---|
| 2026-09-08 (6) | **Verified against the cluster** (§3.2). `IngressClassParams/alb-shared` carries `group.name: nonprod-shared`, so the demos join the ALB that already exists and add no load balancer. Corrects a claim made from assumption in pm-4: a plain `alb` IngressClass **does** exist on this cluster. |
| 2026-09-08 (5) | **One Ingress for all demos** (§3.2). An Ingress per demo could have meant an ALB per demo — grouping for `alb-shared` lives in an `IngressClassParams` outside these repos — at roughly the monthly cost of the managed platform §3 rejected. A single Ingress with a host rule per demo removes the dependency on grouping entirely. |
| 2026-09-08 (4) | **NetworkPolicy dropped; Ingress corrected** (§2, §3.2). Both were invented rather than observed: `pontive-gitops` has no NetworkPolicy, no quotas and no CIDR anywhere, and the cluster's IngressClasses are `alb-pontive` and `alb-shared`, not `alb`. The quotas stay — they are enforced unconditionally, unlike a NetworkPolicy the CNI may ignore in silence. |
| 2026-09-08 (3) | **§5 step 1 disambiguated, and a trap named** (§5.2). "Deploy to dev" was collapsing three independent choices — which cluster, which Pontive deployment, and which *project mode*. The third had never been raised and is the one that decides whether the demo proves anything: a sandbox project's cookies are not `SameSite=Lax`, so the proxy this demo exists to demonstrate would be doing nothing visible. |
| 2026-09-08 (2) | **arm64 images from the x86 runner** (§3.2). No arm64 runner, no QEMU — the Dockerfile pins its builder stages to `$BUILDPLATFORM` and lets only the final stage follow the target, which works because sharp is excluded from Next's output trace. Verified by building for a foreign architecture and running the result. |
| 2026-09-08 | **No bespoke IAM** (§6.4). The Go services assume a shared `GithubActionsRole` through `ci-workflows/go-microservices.yaml` and self-provision their ECR repository; the demos do the same. The narrow push-only role §6.4 argued for was justified by a risk — a public repo where anyone can propose a workflow change — that moving CI into a private repo had already removed. Adds the one question this raises: whether `GithubActionsRole`'s trust policy wildcards the org. |
| 2026-09-07 (pm, 9) | **Dev for now** (§2). Reverses pm-2's "production-grade, not the dev cluster" for the time being: `nonprod-shared` is the only cluster `platform-gitops` describes, and the audience today is the team, not customers. The revisit trigger is the first time a demo link is sent outside Revotech — which is also the point at which the `pontive-dev.com` hostname stops being acceptable. |
| 2026-09-07 (pm, 8) | **Conformed to the platform's ApplicationSet model** (§2.1, §2.2). `platform-gitops` already generates Applications from a git directory generator over a gitops repo's overlays, and `pontive-gitops` is kustomize base + `overlays/<env>`. The hand-rolled app-of-apps is deleted; the demos are now read the same way as the Go services. Records the one deliberate departure — images move by digest, not `newTag`. Also raises §7: the only cluster in `platform-gitops` is `nonprod-shared`, which contradicts §2's "production-grade, not the dev cluster". |
| 2026-09-07 (pm, 7) | **Two private repos, not one** (§2.1). Reverses pm-5: the Go services already keep manifests in dedicated `*-gitops` repos, so the demos follow that convention. Records the consequence — the digest bump now crosses a repo boundary, which `GITHUB_TOKEN` cannot do. Also fixes a bug in the first draft: an Argo `Application` must not live in the path it syncs. |
| 2026-09-07 (pm, 6) | **Scaffolded and verified.** `output: 'standalone'`, Dockerfile and the credential-free PR check landed in `pontive-next-demo`; the arm64 image was built and the proxy verified against the running container. Corrects §2/§3.2: a vanilla `NetworkPolicy` cannot restrict egress by hostname, only by CIDR. |
| 2026-09-07 (pm, 5) | **Repo inventory made explicit** (§2.1). Multi-repo, not a monorepo, and §6.5's "the manifests repo, or one beside it" is settled as **one** private infra repo. |
| 2026-09-07 (pm, 4) | **CI moves to a private repo** (§2, §6.5). The public demo repos end up with no AWS identity at all. Records that the obvious mechanism — a reusable workflow in a private repo — is closed twice over: GitHub forbids a public repo calling one, and the OIDC `sub` claim is the caller's regardless, so moving workflow *files* moves nothing. |
| 2026-09-07 (pm, 3) | **ArgoCD confirmed; §6.2 rewritten and one claim corrected.** "Blast radius is one image tag" is only true if Argo tracks an immutable digest pinned in the private manifests repo. With Argo Image Updater on a mutable tag, an ECR push *is* a production deploy, and the public repo's role becomes a deploy credential. Adds §6.4 on the ECR role itself. |
| 2026-09-07 (pm, 2) | **Demo repos will be public.** Adds §6. The host decision is unchanged — it is reinforced, because a public repo's Dockerfile and manifests are themselves the self-hosting reference a managed platform cannot provide. What changes is the pipeline: a public repo must never hold cluster credentials. Also records that `.env` is tracked and duplicates `.env.example`. |
| 2026-09-07 (pm) | **Decision reversed: EKS, not Vercel** (§2, §3). The first draft ranked Vercel first on the assumption that self-hosting meant standing up new infrastructure. It does not — the Go services already run on EKS, so the pipeline, ingress, TLS and observability exist and have an owner. That was the *only* axis Vercel won on: it is not cheaper, and running unmodified `next start` carries strictly less adapter risk than any managed platform. Adds §3.2 (the EKS shape) and §5.1 (build-time env vars bake into the image). |
| 2026-09-07 | Initial. |

## 1. The constraint

Measured against this repo, not assumed.

The demo has **no server-side data access at all** — no `cookies()`, no `headers()`, no route handlers, no server `fetch`. Every page renders statically. The only server-side thing in the entire application is one rewrite:

```js
// next.config.mjs
async rewrites() {
  return authProxyRewrites({ authHost: process.env.PONTIVE_AUTH_HOST });
}
```

That rewrite is not incidental. It **is** the demo: `/__auth/auth/v1/*` and `/__auth/oauth2/*` are served from the app's own origin so the auth server's refresh cookie is first-party and survives `SameSite=Lax` and Safari's third-party blocking. Without it, sign-in appears to work and then reports *"no auth flow in progress"* on the next request.

So the hosting question is not "where do I put a static site". It is: **where can a demo serve its own origin and proxy `/__auth/*` upstream, in the way that framework's own users would do it.**

### 1.1 Static export is not available

`output: 'export'` does not merely ignore `rewrites` — it rejects them. From the installed docs, `node_modules/next/dist/docs/01-app/02-guides/static-exports.md`, "Unsupported Features": `Rewrites`, `Redirects`, `Headers`, `Proxy`. Attempting to use one under `next dev` in export mode is an error, equivalent to `export const dynamic = 'error'`.

Static-exporting the Next demo therefore means deleting `authProxyRewrites()` and moving the proxy into a platform config file. That deletes the three lines the README is written about, and removes the only consumer of the `@pontive/pontkit-nextjs/server` subpath (§3, package architecture doc) from the flagship demo of that package.

**Static export is rejected on those grounds, not on technical ones.** It would work; it would just stop demonstrating the product.

### 1.2 The same is true of every other framework

The idiomatic proxy is a server feature everywhere, which means this generalises rather than being a Next quirk:

| Demo | Idiomatic proxy | Needs a server |
|---|---|---|
| Next | `rewrites()` in `next.config.mjs` via `authProxyRewrites()` | yes |
| Nuxt | `routeRules: { '/__auth/**': { proxy } }` (Nitro) | yes |
| SvelteKit | `+server.ts` handler under `/__auth` | yes |
| React (Vite SPA) | dev: `server.proxy`; **prod: nothing** — platform config | no |
| Angular | dev: `proxy.conf.json`; **prod: nothing** unless SSR | no, unless SSR |

Two findings worth carrying into the bindings work:

- **Angular has no production framework-level proxy.** `proxy.conf.json` is a dev-server feature and does not survive `ng build`. An Angular customer either runs Angular SSR or configures their CDN. `@pontive/pontkit-angular`'s docs must say which, because the answer is not in Angular's own docs.
- **The same gap exists for plain Vite SPAs**, which is what `pontive-react-demo` is. `@saasbase-io/elements/proxy` covered the Vite dev server; production was always the customer's CDN.

## 2. Decisions

| Question | Decision | Why |
|---|---|---|
| Host | **The existing EKS cluster.** Each demo is a container running Next's `output: 'standalone'` server, in a dedicated `pontive-demos` namespace, behind the ingress the Go services already use. | §3.2. Marginal cost is effectively zero and **flat in the number of demos**, the pipeline and TLS and observability already exist and already have an owner, and it runs *unmodified* Next — no adapter in the path at all, which is strictly less risk than any managed platform including Vercel's own. |
| Static export | **No.** Every demo runs a server and shows its framework's own proxy. | §1.1. A demo that deletes the feature it demonstrates is not a demo. |
| Which cluster | **`nonprod-shared` / `overlays/dev`, for now.** | Decided 2026-09-07. It is the only cluster `platform-gitops` describes, and while the audience is the team rather than customers there is nothing to be gained by waiting for a prod entry that does not exist. |
| When to move to prod | **Before the first demo link leaves Revotech.** | A demo that is down when a prospect clicks it is worse than no demo — and `next.demos.pontive-dev.com` is not a URL to put in a sales deck. Both problems arrive on the same day: add an `overlays/prod` and a second `path:` to the ApplicationSet, and register the prod origin on the demo app. |
| Isolation | Own namespace, own AppProject, and a `ResourceQuota` + `LimitRange`. **No `NetworkPolicy`.** | §3.2. A public demo is internet-facing and is the least-reviewed code in the estate — a neighbour to the Go services, and an untrusted one. But a control has to actually work: quotas are enforced unconditionally, while a `NetworkPolicy` is inert unless the CNI enforces it, and silently so. |
| Vercel | **Fallback, not the choice.** Reconsider only if demo deploys start competing with product work for the same people. | §3.1. It is not cheaper ($20/seat/month, scaling with headcount) and not lower-risk. It buys only "nobody owns uptime", which EKS has already bought. |
| Cloudflare / Netlify | **Rejected.** | §3.1. Cloudflare's own recommended Next 16 path is `vinext`, a beta Vite plugin that *reimplements* the Next.js API surface and does not document `next.config` rewrites at all. Netlify's Next integration is likewise unverified. |
| One repo or many | **One public repo per demo, plus two private repos — `pontive-demos-ci` and `pontive-demos-gitops`. Not a monorepo.** | §2.1. |
| Domain layout | **Subdomain per demo** under one apex: `next.demos.pontive.com`, `nuxt.…`, `angular.…`, `react.…`, with a landing page at `demos.pontive.com`. | §4. |
| Pontive project | **One shared demo project and app**, with every demo's origin on its allowlist. | One brand to maintain, one set of test users, one place to look when sign-in breaks. |
| Preview deployments | **UI review only. Never advertised as working demos.** | §4.1. |
| CI/CD | **Build and push run in a private repo**, which checks out the public source at a pinned SHA. The public repos keep a credential-free PR check and the Dockerfile, and hold no AWS identity at all. | §6.5. Removes the last credential-shaped thing from a repo where anyone can propose a workflow change. |


### 2.1 The repos

| Repo | Visibility | Contents |
|---|---|---|
| `pontive-next-demo` | **public** | The demo. Dockerfile, credential-free PR check. No AWS identity. |
| `pontive-react-demo` | **public** | ditto |
| `pontive-nuxt-demo`, `-angular-`, `-svelte-` | **public** | ditto, as they are built |
| `pontive-demos-ci` | **private** | The promotion workflow, per-demo build config, and the IAM policies. Holds the only AWS identity in the picture (§6.4, §6.5) — a role that can push to one ECR path and touch nothing else. |
| `pontive-demos-gitops` | **private** | Argo's source of truth: kustomize `base/` plus `overlays/<env>/`, matching `pontive-gitops`. Builds nothing. |
| `platform-gitops` | private, **existing** | Gains one ApplicationSet and one AppProject (§2.2). Nothing else changes there, ever — new demos and new environments are picked up by the generator. |

**Not a monorepo**, for one reason that outweighs the drift risk: **a demo has to be clonable and runnable as-is.** A monorepo subdirectory is not — it inherits the root lockfile, workspace config and shared tsconfig, so `cp -r apps/nuxt ~/my-app` produces something that does not install, let alone run. The demo's entire job is to be the thing a developer copies. Next also needs an explicit `outputFileTracingRoot` to build inside a monorepo, which is exactly the kind of non-idiomatic config §4 rejects `basePath` for.

The cost is accepted duplication: each demo repeats the landing copy, the theme and the account page in its own framework's idiom. **Do not factor that into a shared `@pontive/demo-shared` package** — a demo that depends on a private helper is no longer an example anyone can copy. Duplication is the feature here.

Infra is **two** private repos, revised 2026-09-07 from an earlier "one". The first draft kept them together because promotion is a single action — build, push, bump the digest, commit — and splitting it turns that into a cross-repo commit. It does; but the Go services already keep their manifests in dedicated `*-gitops` repos, and matching an established convention is worth more than saving one `actions/checkout`.

Two consequences, neither fatal:

- **`GITHUB_TOKEN` cannot make the digest commit.** It is scoped to the repository it is issued for. `pontive-demos-ci` mints a **GitHub App installation token scoped to `pontive-demos-gitops` alone** — narrower than a deploy key or a fine-grained PAT, and the App's private key is the only long-lived secret anywhere in the estate. It lives in a private repo and grants `contents: write` on one repository.
- **Promotion stays one action only while `pontive-demos-gitops` accepts direct pushes.** If it gains branch protection, the workflow switches to a branch plus `gh pr create`, and shipping becomes run-the-workflow-then-merge. That is a reasonable trade for a repo Argo applies to production; it is just no longer one act.

**An Argo `Application` must live outside the path it syncs.** The first scaffold put `argocd-application.yaml` inside `apps/next-demo/`, which is that Application's own `source.path` — Argo would have rendered it as part of the app and applied an `Application` into `pontive-demos`, a namespace where Argo does not look for them. The CRs now sit in `argocd/`, reached by an app-of-apps root applied once by hand.


### 2.2 How the platform already does this

Conformed 2026-09-07, after reading `platform-gitops` rather than inventing a layout. The first scaffold had a hand-rolled app-of-apps; the platform has a working model and the demos now use it.

- **`platform-gitops/clusters/<region>/<cluster>/`** holds `applicationsets/` and `projects/`. The `pontive-apps` ApplicationSet runs a **git directory generator** over `pontive-gitops`'s `overlays/dev`, templating `pontive-{{.path.basename}}` into namespace `pontive-{{.path.basename}}` with `CreateNamespace=true`.
- **`pontive-gitops`** is kustomize `base/` plus `overlays/{dev,staging,prod}/`, and images move by an `images:` `newTag:` entry in the overlay.

The demos copy all of it: `pontive-demos-apps` generates over `pontive-demos-gitops/overlays/*`, and a new demo or a new environment therefore needs **no change in `platform-gitops`**. Two deliberate departures:

| Departure | Why |
|---|---|
| Images move by **`digest:`**, not `newTag:` | The Go services are built from private repos. These are built from public ones, so the step from "a stranger opened a pull request" to "it is running" has to be an explicit commit. A digest is content and cannot be repointed; a tag can, which would make `pontive-demos-ci`'s push-only role a deploy credential. Same reason there is no Argo Image Updater. |
| Its **own AppProject**, not a slot in `pontive` | `pontive`'s project allows `namespaceResourceWhitelist: "*"` and names `pontive-gitops` as a source. The demos get a project confined to `pontive-demos-*` namespaces, their own gitops repo, and an enumerated six resource kinds. This is §3.2's isolation argument expressed where Argo can enforce it. |

No `PodIdentityAssociation` patch is needed either — the demos hold no AWS identity at runtime, so there is no `clusterName` to rewrite. They are also not linkerd-injected, unlike the `pontive` namespace: a demo talks to one public host through its own rewrite and to nothing inside the mesh.

## 3. Candidates

Pricing verified 2026-09-07 against each vendor's own docs.

| | Cost for N demos | Ops | Idiomatic per framework | Adapter risk |
|---|---|---|---|---|
| **Existing EKS** | **~$0 marginal, flat in N** | marginal — pipeline exists | yes, all | **none** — runs `next start` |
| Vercel Pro | $20/seat/mo + usage, scales with headcount | none | yes, all | Vercel's adapter (verified) |
| Standalone VPS + Caddy | $5–12/mo flat | new; you patch, deploy, monitor | yes, all | none |
| Cloudflare Workers | $0 | none | Next only via beta `vinext` | **beta reimplementation** |

**Vercel Hobby was never an option.** Vercel's Fair Use Guidelines: *"Hobby teams are restricted to non-commercial personal use only. All commercial usage of the platform requires either a Pro or Enterprise plan,"* where commercial use includes *"advertising the sale of a product or service."* Customer-facing demos of a paid product are squarely inside that. The free tier there is a compliance problem, not a saving.

### 3.1 Why not the managed platforms

**Cloudflare** is the strongest free option and would have been the answer for a static site. Its numbers are good: Workers Free gives 100,000 requests/day, static asset requests are free and unlimited on every plan, no egress charges at any tier, and Workers Paid is $5/month.

It fails on one specific point. The installed Next docs (`01-app/01-getting-started/17-deploying.md`) list exactly two **verified** adapters — Vercel and Bun — and say Cloudflare and Netlify *"are working on verified adapters… In the meantime, they offer their own Next.js integrations."* Cloudflare's current framework guide for Next 16 recommends `vinext`, described as *"a Vite plugin that reimplements the Next.js API surface"*, and states plainly that **`vinext` is in beta**. Its published support table covers middleware and proxy routes and does not mention `next.config` rewrites at all. An external rewrite that silently does not fire would break sign-in in exactly the place the demo exists to prove works — and would look like a Pontive bug to the customer, not a hosting one.

**Netlify** does support external proxying on all plans (`/api/*  https://api.example.com/:splat  200`, no plan restriction, 26-second timeout), but its Next integration is unverified for the same reason.

**AWS CloudFront's** current Free plan is 100 GB and 1M requests with no overage charges — ample — but CloudFront alone cannot run Next, so it only helps in the static-export world §1.1 rejects. It still has a role in front of the cluster if the ingress already terminates there.

**Vercel Pro** is the only managed option with no adapter caveat, and it was this document's first recommendation. It loses to EKS on every axis once the cluster exists: it costs $20/seat/month against ~$0, that cost scales with the number of engineers who deploy rather than the number of demos, and it puts the flagship demo on infrastructure Revotech does not otherwise run. Keep it as the fallback for exactly one scenario — demo maintenance starts consuming the people who should be shipping PontKit.

### 3.2 The EKS shape

Nothing here is novel; it is the deployment every one of these demos would get if it were a Go service.

- **Image.** `output: 'standalone'` in `next.config.mjs` emits `.next/standalone` with a minimal `server.js` and only the traced `node_modules`, deployable without an `npm install`. `public/` and `.next/static/` are not copied automatically — `cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/` after `next build`, after which `server.js` serves them. `PORT` and `HOSTNAME` are read from the environment, so `HOSTNAME=0.0.0.0` in the pod spec.
- **arm64 images come off the x86 runner, without QEMU.** The Go services do this with `ARG GOARCH=arm64` — decide the architecture in the Dockerfile and let the compiler cross-build. Node has no equivalent: the runtime needs a real arm64 `node`. The Node shape is to pin the builder stages to `$BUILDPLATFORM` so they run natively and let **only the final stage** follow `--platform linux/arm64`, so the architecture is carried by the last stage's base image. That is only sound if nothing architecture-specific is copied forward from the builder — which is why `next.config.mjs` sets `outputFileTracingExcludes` for sharp. Sharp was 27MB of the 46MB traced output and the only native binary in it; the app renders no `next/image`, so it was dead weight that would also have shipped an `@img/sharp-linux-x64` binary into a Graviton image. Verified by building for a foreign architecture and running the result.
- **Resources.** These are static pages plus one proxy route. A demo pod is tens of megabytes of RAM. N demos fit in existing node headroom; the marginal cost is a rounding error against the Go services.
- **Ingress.** One host-based rule per demo on the existing controller, one TLS cert per subdomain from whatever already issues them. No new load balancer.
- **Isolation.** Own namespace with a `ResourceQuota` and `LimitRange` so a demo cannot starve production, plus its own AppProject (§2.2) confining what Argo will apply on their behalf. Demos are internet-facing, are the least-reviewed code in the estate, and exist to be poked at by strangers. If hard separation is ever wanted, a tainted nodegroup.
- **No `NetworkPolicy`, deliberately.** An earlier draft specified a default-deny egress policy carving out the VPC. It was dropped on 2026-09-08 for two reasons: `pontive-gitops` has none, so it had no precedent anywhere in the estate; and more importantly a `NetworkPolicy` only does anything where the CNI enforces it. Where it does not, the API server accepts the object and it silently has no effect — which is worse than its absence, because it reads as protection in a review. Whether to enforce network policy is a cluster-wide decision about the CNI, and the demos are the wrong place to introduce it. The quotas stay on the opposite reasoning: enforced unconditionally, no placeholder needed, and they are the control that actually bounds a runaway demo. **The test is whether a control does what it claims, not whether it looks thorough.**
- **The demos add no load balancer.** Checked against `nonprod-shared-eks` on 2026-09-08 rather than assumed. The cluster runs the EKS Auto Mode ALB controller (`controller: eks.amazonaws.com/alb`) with three classes — `alb`, `alb-pontive` and `alb-shared`, the last being the default. Their `IngressClassParams` carry the ALB **group**, which is what decides how many load balancers exist: `alb-pontive` is group `pontive` and owns `k8s-pontive-2446e1c1fb-*`; **`alb-shared` is group `nonprod-shared`** and owns `k8s-nonprodshared-5460108ce8-*`, which today carries only the gRPC test hosts. Putting the demos on `alb-shared` therefore joins an existing load balancer rather than provisioning one. The class is named explicitly even though it is the default, so a change of default cannot silently move the demos.
- **One Ingress for every demo, not one per demo.** This was written as a cost control while the grouping was unknown — without a group, the controller provisions one ALB per Ingress, and an Ingress per demo would have meant roughly $20/month each, about what Vercel Pro costs and enough to dismantle the "~$0 marginal, flat in N" argument that chose EKS in §3. With `nonprod-shared` confirmed, that risk is gone and the single Ingress is kept for a smaller reason: it keeps the listener rules and the certificate in one place as demos are added. It is also the shape `pontive-gitops` already uses — one Ingress, two gRPC hosts.
- **Watch this line as demos are added.** "Flat in N" is the claim the whole hosting decision rests on. Anything that turns a new demo into a new *billable AWS resource* — a load balancer, a certificate, a hosted zone — breaks it. Host rules and a wildcard certificate do not.
- **The proxy hop stays public.** `authProxyRewrites` sends the auth server's own hostname upstream as `Host`, which is how auth-api resolves which project it is answering as. Do not "optimise" this into a cluster-internal service address — the `Host` header is the mechanism, and short-circuiting it breaks project resolution.

## 4. Layout

Subdomain per demo, one apex:

```
demos.pontive.com          landing page, links to each
next.demos.pontive.com     pontive-next-demo
react.demos.pontive.com    pontive-react-demo
nuxt.demos.pontive.com
angular.demos.pontive.com
```

Subdomains rather than path prefixes (`demos.pontive.com/next`) for one reason that outweighs the extra DNS records and ingress rules: **each demo gets its own cookie jar.** A prospect trying the Nuxt demo should meet a signed-out app, not inherit a session from the Next demo they clicked first. Path prefixes also mean per-demo `basePath`/`base href` configuration in every framework, which is exactly the kind of non-idiomatic detail a demo should not contain.

The cost is one allowed-origin registration per demo on the shared Pontive app. That is a one-time click each.

### 4.1 Preview deployments will not work for sign-in

Any per-commit preview URL changes per deployment and will not be on the app's origin allowlist, so auth-api answers `{"error":{"code":"ForbiddenError","message":"origin is not allowed for this app"}}` and the demo appears broken. Previews are for reviewing UI. **Only the pinned custom domains are demos**, and only those go in documentation, sales decks or README links.

The same trap already applies locally and is documented in this repo's README: `http://localhost:3000` must be registered, and the dev deployment's WAF must not block `localhost` flow-starts.

## 5. What to do

1. Settle the three choices in §5.2 and record the resulting auth host, app id and project id in `pontive-demos-ci/build/next-demo.env`.
2. Add `output: 'standalone'` to `next.config.mjs` and a Dockerfile to this repo. Verify locally: `node .next/standalone/server.js`, then the two README curl checks against it.
3. Issue a certificate covering the demo hostnames, put its ARN in `pontive-demos-gitops/overlays/dev/ingress.yaml` — the only placeholder left in either repo — and merge the `platform-gitops` branch.
4. Run the promotion workflow in `pontive-demos-ci` against the demo's commit SHA; Argo does the rest.
5. Register `https://next.demos.pontive-dev.com` as an allowed origin on the demo app. Verify against the deployed URL — a 200 `text/css` from `/__auth/auth/v1/apps/$APP_ID/branding.css` proves the rewrite and the upstream `Host` are both right. HTML back means the rewrite did not match.
6. Repeat for `pontive-react-demo`, and resolve the production-proxy gap for Vite SPAs (§1.2) while doing it — whatever that demo does becomes the answer `@pontive/pontkit-loader`'s docs give every SPA customer.
7. Build the landing page at the apex last, once there are at least two demos to link.

### 5.1 The image is environment-specific

`next.config.js` is read during `next build` and serialised into the output — the rewrite destination is baked into the routes manifest, not read at runtime. Every variable this demo uses is build-time: `PONTIVE_AUTH_HOST` (which is why it is deliberately not `NEXT_PUBLIC_`) and all four `NEXT_PUBLIC_*` values, which are inlined into the bundle.

So a demo image **cannot be repointed at a different project by changing a pod env var**. Setting `PONTIVE_AUTH_HOST` in the Deployment manifest and expecting it to take effect is the failure mode to watch for: the pod starts clean and sign-in fails against whatever host was baked in at build. Pass them as build args in CI, one image per target project, and tag accordingly.

### 5.2 "Dev" means three independent things

Worth separating, because two of them are settled and the third decides whether the demo is honest.

| Axis | Options | Status |
|---|---|---|
| Which **EKS cluster** the pods run on | `nonprod-shared`, or a prod cluster once one is described | **Settled: `nonprod-shared`** (§2), revisited when a demo link first leaves Revotech |
| Which **Pontive deployment** the demo authenticates against | the dev one at `api.pontive-dev.com`, or production Pontive | **Dev**, matching the cluster. This is what produces an auth host like `idmatic-wqpdw11s.auth.us.pontive-dev.com` |
| Which **mode the Pontive project is in** | production or sandbox | **Must be production.** See below |

They are genuinely independent — nothing stops demo pods on a nonprod cluster from authenticating against production Pontive, since the auth host is reached over the public internet like any other.

**The project must be in production mode, and this is not a detail.** This repo's README states the case the demo exists to make: the refresh cookie is withheld *"for a production project, whose cookies are `SameSite=Lax`"*. That is precisely the condition `authProxyRewrites` answers.

Point the demo at a **sandbox** project and the failure is silent and inverted: the cookie is not `SameSite=Lax`, the third-party cookie problem never bites, sign-in works — and it would have worked without the proxy. The demo would look like a success while demonstrating nothing, and the first person to discover otherwise would be a customer copying the pattern into their own production project. A demo that cannot fail for the right reason is not evidence.

There is already a project to consider rather than create: `.env.example` points at `proj_06fghx60hnrcxftadsj44e0pj8` with app `app_06fgq637wsxt7610cfnxxthy08` on `pontive-dev`. If that becomes the demo's project, step 1 is confirming its mode and adding the deployed origin to its allowlist — not creating anything.

**Whichever way these go, §5.1 applies:** all three land in build args baked into the image, so changing one later is a rebuild and a re-promotion, not a manifest edit.

## 6. The repos are public

Decided 2026-09-07. Developers need to read the code, so every demo repo is public. This **does not change the host decision — it reinforces it**, and it adds one hard requirement to the pipeline.

### 6.1 Nothing in a demo is secret

Every value the app consumes is public by construction: `NEXT_PUBLIC_PONTIVE_APP_ID`, `NEXT_PUBLIC_PONTIVE_PROJECT_ID`, `NEXT_PUBLIC_PONTIVE_API_BASE_URL` and `NEXT_PUBLIC_PONTIVE_AUTH_DOMAIN` are inlined into the browser bundle and readable in devtools regardless. `PONTIVE_AUTH_HOST` is not `NEXT_PUBLIC_` for a different reason — the browser has no use for the auth server's real hostname, and keeping it out of the bundle is what makes `/__auth` the only path the app knows. It is not a credential; it is a public DNS name.

The security boundary is not the repo. It is the app's **allowed-origin list** plus the auth server's own checks. Publishing the app id changes nothing an attacker could not already read.

**One thing to fix before publishing:** `.env` is tracked, and is byte-identical to `.env.example`. That is not a leak — there is nothing in it — but a public reference repo that ships a committed `.env` teaches every developer who copies the demo to commit theirs, in an app where it *will* matter. Delete `.env` from the index, add it to `.gitignore`, keep `.env.example` as the only committed copy.

### 6.2 A public repo must never hold cluster credentials

This is the real consequence, and it is a pipeline question rather than a hosting one.

**The split, confirmed 2026-09-07: ArgoCD is already in use.** The public repo's only job on merge to `main` is to build the image and push it to ECR. The **private** manifests repo carries the Deployment, and Argo reconciles it — the same delivery path as the Go services. The public repo holds no Kubernetes credential at all.

**The push credential is not a stored secret.** With GitHub OIDC there is nothing in the repo to steal: the workflow presents a short-lived GitHub-signed JWT and STS returns temporary credentials. What is public is the role ARN and account id, which are identifiers, not credentials. The only question that matters is **who can cause that role to be assumed**, and on a public repo the answer is bounded by GitHub itself: a `pull_request` from a fork gets a read-only `GITHUB_TOKEN` and **cannot** be granted `id-token: write`, so it cannot mint a token at all. The org setting that relaxes this applies only to private repos. A stranger's PR therefore cannot reach ECR.

### 6.3 The trap: ECR push must not equal deploy

The blast radius of that role is one image tag in one repository **only if Argo cannot deploy an image nobody approved.** That is a property of the manifests repo, not of the workflow:

- **Pin an immutable digest** (`…@sha256:…`) in the private manifests repo, and turn on **ECR tag immutability** so a tag cannot be repointed. Promotion is then a commit to a private repo that a human makes and Argo reconciles.
- **Do not point Argo Image Updater at a mutable tag** such as `latest` or `main` for these apps. If it auto-tracks whatever lands in ECR, then a push *is* a production deploy, the private manifests repo stops being a gate, and the public repo's OIDC role has quietly become a production deploy credential. That is the whole control collapsing into a naming convention.

The remaining path to production is a maintainer merging a malicious PR to `main` and then a human promoting the digest. Branch protection with required review on `main` covers the first half; the digest bump covers the second.

### 6.4 IAM: use what the Go services use

Revised 2026-09-08, replacing a bespoke push-only role this section previously specified.

`identity-svc` calls `revotech-group/ci-workflows/.github/workflows/go-microservices.yaml`, which assumes **`arn:aws:iam::${AWS_ACCOUNT_ID}:role/GithubActionsRole`** over OIDC, names the ECR repository after `${{ github.repository }}`, and creates it on first push. The demos now do exactly that. `AWS_ACCOUNT_ID` is a secret, so no account number appears in any workflow file.

The earlier design — a dedicated role scoped to `ecr:PutImage` on one repository ARN, with the trust policy pinned to one branch — was not wrong, it was **redundant**. Its whole justification was that a public repo is a place where anyone can propose a workflow change. §6.5 had already removed that by moving CI into a private repo. Keeping the bespoke role would have meant maintaining a second IAM path, diverging from the platform, for a risk that no longer existed.

One addition to the inherited pattern: the demo repositories are created **`IMMUTABLE`** with scan-on-push. `ci-workflows` does not set this, and it matters more here than there — §6.3's gate is only a gate if the tag beside the pinned digest cannot be repointed at different content.

**The one thing to check:** does `GithubActionsRole`'s trust policy match `repo:revotech-group/*`? If it does, making the demo repos public brings them inside that wildcard, and a workflow on their `main` could mint a token for it. Nothing in this design does that — the public repos' PR check declares `permissions: contents: read` and requests no `id-token` — but it is worth knowing before public repos become common in the org, because the property that protects it is a convention rather than the trust policy.

### 6.5 Moving CI into a private repo

Decided 2026-09-07. Better than §6.4, and it removes the last AWS identity from the public repos. But only one mechanism achieves it.

**What does not work: a reusable workflow in a private repo.** Closed twice over. GitHub forbids it outright — *"Actions and reusable workflows stored in private repositories cannot be used in public or internal repositories"* — and even if it were allowed it would buy nothing, because the OIDC `sub` claim is constructed from the **caller's** context. A job in the public repo calling a private reusable workflow still presents `repo:<org>/<public-repo>:…`, so the trust policy still has to name the public repo. Moving workflow *files* into a private repo moves nothing; only moving *execution* does. (`job_workflow_ref` can be pinned on as an additional condition, but it constrains which workflow ran, not which repo may assume the role.)

**What works: the private repo builds the public source.** `pontive-demos-infra` (§2.1) checks out the public demo at a pinned SHA, builds the image, pushes to ECR, and bumps the digest in the manifests repo. Argo reconciles. The §6.4 role now lives under `repo:<org>/<private-repo>:ref:refs/heads/main`, a far stronger claim, because nobody outside the org can propose a workflow change there in the first place.

**Trigger it with `workflow_dispatch` taking a SHA input.** §6.3 already requires a human to promote a digest, so this collapses two deliberate actions into one: a person names the commit to ship. A schedule polling public `main` also works if that is too manual. **Do not use `repository_dispatch` fired from the public repo** — that needs an API token stored in the public repo, which puts a credential straight back where the whole exercise was removing one.

**Keep two things in the public repo.** A **credential-free** PR workflow (install, typecheck, lint, `next build`) on `pull_request` with `permissions: contents: read` and no secrets — public repos need PR feedback, and a workflow that cannot reach AWS costs nothing to run on a stranger's branch. And the **Dockerfile**, which is both what the private build consumes and, per §6.6, the artifact a self-hosting customer copies.

The honest delta: §6.4's design was already sound and is what most public repos ship. This is a real improvement, but a narrow one — it eliminates the "anyone can open a PR editing the workflow that holds the role" surface, and nothing else.

### 6.6 Public repos are an argument for containers

A developer evaluating PontKit clones the demo for their framework and wants to run it. On the container path, the repo contains a Dockerfile and — if it points at the private manifests as an example — a deployment they can copy; the demo is a working self-hosting reference on top of being an auth reference. That is exactly the gap §1.2 identifies for Angular and Vite SPA customers, who have to solve production proxying themselves.

A managed platform gives a reader nothing to copy: a `vercel.json` and a dashboard they cannot see. That is a small point, but it runs the same direction as §2 rather than against it.

## 7. Open questions

- **The Vite/Angular production proxy (§1.2).** Neither framework has one. The demos must show *something*, and whatever they show becomes PontKit's recommended answer for the largest category of customer — a plain SPA on a CDN. Decide it deliberately rather than letting the first demo set it by accident.
- **The dev WAF.** This repo's README records that the dev deployment's WAF refuses any flow-start whose `origin_url` has a `localhost` host, with a CloudFront block page rather than a JSON error. `next.demos.pontive-dev.com` is a real `https` origin so the rule should not apply — but it is the same WAF, and it is worth confirming against the deployed demo rather than assuming, because the failure mode is an HTML page where the SDK expects JSON.
- **Whether demos share the production cluster or get their own.** §2 assumes a namespace on the existing production cluster with the §3.2 controls. A separate small cluster is cleaner isolation at real cost, and is probably only worth it if the demos grow beyond static pages plus a proxy.
- **How Argo currently resolves images for the Go services.** §6.3 only holds if these apps track a pinned digest. If Image Updater is already auto-tracking mutable tags across the estate, the demos should be the exception, and it is worth asking whether the Go services want the same treatment.
- **Where the prod cluster is described.** `nonprod-shared` in `us-east-1` is the only cluster in `platform-gitops`. Either a prod cluster's ApplicationSets live somewhere this document has not seen, or that repo grows a second cluster directory when the demos move (§2, *When to move to prod*). Worth establishing before the move rather than during it.
