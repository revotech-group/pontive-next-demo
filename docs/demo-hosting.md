# Hosting the PontKit framework demos

Status: decided 2026-09-07. Not yet implemented — this repo still deploys to Vercel ad hoc and no other demo exists.
Scope: where to host the per-framework PontKit demos (`pontive-next-demo`, `pontive-react-demo`, and the Nuxt/Angular/Svelte demos to come) so prospective customers can try a real sign-in, and what that costs as the number of demos grows.

## Revision history

| Date | Change |
|---|---|
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
| Which cluster | **Production-grade, not the dev cluster.** | A demo that is down when a prospect clicks it is worse than no demo. If dev and prod are separate clusters, demos go on prod. |
| Isolation | Own namespace, `ResourceQuota` + `LimitRange`, and a default-deny egress `NetworkPolicy` permitting DNS and TCP 443 to the public internet **while excluding the VPC and cluster CIDRs**. | §3.2. A public demo is internet-facing and is the least-reviewed code in the estate. It is a neighbour to the Go services, and should be treated as an untrusted one. |
| Vercel | **Fallback, not the choice.** Reconsider only if demo deploys start competing with product work for the same people. | §3.1. It is not cheaper ($20/seat/month, scaling with headcount) and not lower-risk. It buys only "nobody owns uptime", which EKS has already bought. |
| Cloudflare / Netlify | **Rejected.** | §3.1. Cloudflare's own recommended Next 16 path is `vinext`, a beta Vite plugin that *reimplements* the Next.js API surface and does not document `next.config` rewrites at all. Netlify's Next integration is likewise unverified. |
| One repo or many | **One public repo per demo, plus one private infra repo. Not a monorepo.** | §2.1. |
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
| `pontive-demos-infra` | **private** | Build-and-push workflows (one matrix job over the demo repos), the Argo `Application`s, and the Deployment/Service/Ingress manifests with pinned image digests. Holds the only AWS identity in the picture (§6.4, §6.5). |

**Not a monorepo**, for one reason that outweighs the drift risk: **a demo has to be clonable and runnable as-is.** A monorepo subdirectory is not — it inherits the root lockfile, workspace config and shared tsconfig, so `cp -r apps/nuxt ~/my-app` produces something that does not install, let alone run. The demo's entire job is to be the thing a developer copies. Next also needs an explicit `outputFileTracingRoot` to build inside a monorepo, which is exactly the kind of non-idiomatic config §4 rejects `basePath` for.

The cost is accepted duplication: each demo repeats the landing copy, the theme and the account page in its own framework's idiom. **Do not factor that into a shared `@pontive/demo-shared` package** — a demo that depends on a private helper is no longer an example anyone can copy. Duplication is the feature here.

Infra is **one** private repo, not a separate CI repo and manifests repo. Promotion is a single action — build, push, bump the digest, commit — and splitting it across two repos turns that into a cross-repo commit for no gain at this size. Argo watches a path within it.

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
- **Resources.** These are static pages plus one proxy route. A demo pod is tens of megabytes of RAM. N demos fit in existing node headroom; the marginal cost is a rounding error against the Go services.
- **Ingress.** One host-based rule per demo on the existing controller, one TLS cert per subdomain from whatever already issues them. No new load balancer.
- **Isolation.** Own namespace with a `ResourceQuota` and `LimitRange` so a demo cannot starve production. Demos are internet-facing, are the least-reviewed code in the estate, and exist to be poked at by strangers. If hard separation is wanted, a tainted nodegroup; namespace-level controls are probably enough.
- **Egress is CIDR-based, not hostname-based.** A vanilla Kubernetes `NetworkPolicy` selects on IP blocks and pod/namespace labels — it **cannot** express "only `*.auth.us.pontive-dev.com`". The achievable and sufficient rule is: allow DNS, allow TCP 443 to `0.0.0.0/0` with the VPC and cluster CIDRs carved out via `except`, deny everything else. That stops a compromised demo reaching the Go services, which is the actual goal; restricting it to specific public hostnames needs Cilium (or Calico) FQDN policy, and is not worth adopting a CNI feature for.
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

1. Create the shared demo project and app on production Pontive; note its auth host, app id and project id.
2. Add `output: 'standalone'` to `next.config.mjs` and a Dockerfile to this repo. Verify locally: `node .next/standalone/server.js`, then the two README curl checks against it.
3. Namespace, quota and egress policy per §3.2.
4. Ingress rule and cert for `next.demos.pontive.com`; deploy.
5. Register `https://next.demos.pontive.com` as an allowed origin on the demo app. Verify against the deployed URL — a 200 `text/css` from `/__auth/auth/v1/apps/$APP_ID/branding.css` proves the rewrite and the upstream `Host` are both right. HTML back means the rewrite did not match.
6. Repeat for `pontive-react-demo`, and resolve the production-proxy gap for Vite SPAs (§1.2) while doing it — whatever that demo does becomes the answer `@pontive/pontkit-loader`'s docs give every SPA customer.
7. Build the landing page at the apex last, once there are at least two demos to link.

### 5.1 The image is environment-specific

`next.config.js` is read during `next build` and serialised into the output — the rewrite destination is baked into the routes manifest, not read at runtime. Every variable this demo uses is build-time: `PONTIVE_AUTH_HOST` (which is why it is deliberately not `NEXT_PUBLIC_`) and all four `NEXT_PUBLIC_*` values, which are inlined into the bundle.

So a demo image **cannot be repointed at a different project by changing a pod env var**. Setting `PONTIVE_AUTH_HOST` in the Deployment manifest and expecting it to take effect is the failure mode to watch for: the pod starts clean and sign-in fails against whatever host was baked in at build. Pass them as build args in CI, one image per target project, and tag accordingly.

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

### 6.4 The ECR role

All of the following, not a subset:

- **OIDC only.** No long-lived AWS access keys in repository secrets, ever — those *are* stealable, and a public repo makes every leak path public too.
- **Trust policy pinned to `repo:<org>/<repo>:ref:refs/heads/main`**, with `aud` validated. **Never** a `repo:<org>/*` wildcard: a public repo is a place where anyone can propose a workflow change, and a loose `sub` claim turns that into role assumption.
- **Push, not deploy.** The policy grants `ecr:PutImage`, `ecr:InitiateLayerUpload`, `ecr:UploadLayerPart`, `ecr:CompleteLayerUpload` and `ecr:BatchCheckLayerAvailability` on **one repository ARN**, plus the account-wide `ecr:GetAuthorizationToken` that AWS requires (harmless — the returned token can only do what the statements above allow). No EKS permissions of any kind. No shared CI role.
- **`pull_request` only — never `pull_request_target`, never `workflow_run` with credentials.** Those run in the base repo's context with secrets available, and checking out PR code under them is the standard public-repo compromise. Fork PRs build and test; they do not touch AWS.
- A GitHub Environment with required reviewers if you want a human gate on the push itself. With §6.3's digest pinning this is belt-and-braces, since the promotion commit is already the gate.

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
- **Whether the demo project lives on `pontive-dev` or production.** The README's env example uses `pontive-dev.com` and notes the dev WAF blocks `localhost` flow-starts. §5 step 1 assumes production; confirm before building the image, since §5.1 means changing it later is a rebuild.
- **Whether demos share the production cluster or get their own.** §2 assumes a namespace on the existing production cluster with the §3.2 controls. A separate small cluster is cleaner isolation at real cost, and is probably only worth it if the demos grow beyond static pages plus a proxy.
- **How Argo currently resolves images for the Go services.** §6.3 only holds if these apps track a pinned digest. If Image Updater is already auto-tracking mutable tags across the estate, the demos should be the exception, and it is worth asking whether the Go services want the same treatment.
