# PontKit package architecture

Status: decided 2026-09-04, revised 2026-09-06 against the code. §9 steps 1–4 implemented and pushed; steps 5–9 outstanding. Nothing is released — see §12 for the two release chains that gate everything.
Scope: renaming `@saasbase-io/core-elements`, `@saasbase-io/elements` and `@revotech-group/revotech-ui-kit` to PontKit, and the npm/repo structure for adding more UI frameworks and more products (billing, subscription management, fine-grained authorization, OIDC client libraries, webhook SDKs).

## Revision history

| Date | Change |
|---|---|
| 2026-09-04 | Initial. Scope, package layout, repo split, `pont-` rename. |
| 2026-09-06 (pm) | **Implementation record.** §9 steps 1–4 done across five repos. Adds §12 (release chains), §13 (the HTTP header migration, which this document never mentioned and which turned out to be its own cross-service change) and §14 (pre-existing bugs the work surfaced). §6.2 gains a fourth element collision the first audit missed. §6.4 gains the four ways a mechanical rename fails silently, all found the hard way. §6.5's claim that identity-svc holds seeded flow definitions is corrected — it holds none. `auth-api/web/hosted-login` added to §1 as a consumer the plan never listed. |
| 2026-09-06 | **Corrected against the code.** Three errors fixed and two repos added. §5 (core version resolution) is **deleted** — it is already built, and the replacement it proposed would regress SRI. §6's claim that `--sb-*` tokens are "purely local" is false: branding-svc constructs token names in Go and stores compiled CSS per brand. `ui-kit` (`@revotech-group/revotech-ui-kit`, 208 elements, 1405 `--sb-*` declarations, compiled straight into core's published stylesheet) and `saasbase-dashboard` (1671 `--sb-*`, 129 files) were absent from the plan and are now in it. Decisions added: **absorb ui-kit into `pontkit-core`** (§2, §4.A) and **collapse `sb-` and `rtg-` into one `pont-` prefix** (§2, §6). Inventory numbers re-measured (§6): 8 DOM events not 1; 402 tokens in core's own `src/styles`, the 1768 figure was core plus ui-kit. Collision analysis added (§6.2). |

## 1. Current state

| Repo | npm name | Role |
|---|---|---|
| `ui-kit` | `@revotech-group/revotech-ui-kit` 1.0.10 | 52 component families, 208 `rtg-*` Lit primitives, Tailwind prefix `rtg-`. Declares 1405 `--sb-*` and 658 `--rtg-*` tokens. `dist/library.css` is `@import`ed by core's `tailwind.css:5`, so it lands verbatim in the published PontKit stylesheet. Consumed only by core (and the dead `saasbase-ui-elements`). |
| `pontkit-core` (ex-`saasbase-core-elements`) | `@saasbase-io/core-elements` 2.16.x | 58 `sb-*` Lit elements built on the ui-kit primitives, Tailwind prefix `sb-`, `catalog.json` (30 curated tags). Loaded at runtime from the CDN. Contains the merged loginflow auth SDK under `src/auth`. |
| `pontkit` (ex-`saasbase-elements`) | `@saasbase-io/elements` 2.10.x | React wrappers via a hand-rolled `wrap()`, plus `./proxy` (server-side auth proxy for Next/Vite) and `./web-components` (CDN loader) subpaths. 29 source files. |
| `saasbase-dashboard` | private app | The branding editor. 1671 distinct `--sb-*` and 655 `--rtg-*` across 129 files, `<sb-*>` markup, and a token manifest scraped from core's compiled stylesheet (`scripts/branding/refresh-token-manifest.ts`). |
| `branding-svc` | Go service | Curates `catalog.json` (30 tags), compiles brand tokens **server-side** into `--sb-ref-*` / `--sb-sem-*` / component-tier CSS and stores the result per brand. Owns `deployment_core_elements` / `project_core_elements_override` / `core_elements_history`. |
| `identity-svc` | Go service | Serves the catalog to the flow engine; `GetCoreElements` reports the release a project loads. |
| `pontive-next-demo` | consumer | Depends on `@saasbase-io/elements` from the registry only. Core is never installed. |
| `pontive-react-demo` | consumer | Vite + React Router demo (ex-`saasbase-react-demo`). Depends on `@saasbase-io/elements`; package still named `saasbased-react-demo`. Migrates alongside the Next demo. |
| `auth-api/web/hosted-login` | consumer, inside a service | **Not in the first draft's repo list.** The hosted sign-in and sign-up pages served on every project's auth domain. Depends on `@saasbase-io/core-elements@2.16.5` directly and constructs `sb-provider` / `sb-signin` / `sb-signup` in `src/boot.ts`. Its `dist/` is committed. Arguably a more important consumer than either demo, and it migrates with them (§9 step 8c). |

Dead repos carrying the old names, archived rather than migrated: `saasbase-ui-elements` (an older package also publishing `@saasbase-io/elements`, last touched 2025-12), `saasbase-branding-and-widgets` (2026-05), `saasbase-widget-customiser` (2026-03). `loginflow-engine` was deleted outright on 2026-09-06.

Also touched, by the header migration rather than the rename (§13): `saasbase-core` (the shared Go library every service embeds), `auth-api`, `management-api`, `platform-management-api`, `go-core`.

Problems that a multi-framework, multi-product future makes worse:

- **Types are hand-mirrored.** Core does not export `@/types`. The React repo keeps parallel prop interfaces in `src/types/` and stub element classes in `src/virtual-web-components.ts`. Every new framework would repeat this.
- **No element manifest.** No `custom-elements.json`. `catalog.json` is hand-maintained for branding-svc and identity-svc and does not describe props/events for wrapper generation.
- **Adding a framework is four manual steps** in one Vite build: extend the stubs, add `src/frameworks/<fw>/index.ts`, add a Vite entry, add an `exports` key. Angular cannot live in that build at all (needs ng-packagr / Angular Package Format).
- **Headless auth is trapped in a Lit bundle.** The OIDC/session code in core's `src/auth` is only reachable by loading the elements.
- **Two dead brands are in the public API**, not just in package names: element tags, CSS tokens, events and window globals carry `sb`/`saasbase`, and the primitives they are built from carry `rtg` (Revotech Group). Both are visible in customer devtools and in the branding editor.

**Not a problem any more.** Version resolution was listed here in the first draft as "newest on jsDelivr, with a `^1` fallback against a 2.x core". That was fixed before this document was written. See §5.

## 2. Decisions

| Question | Decision | Why |
|---|---|---|
| npm scope | One company scope, `@pontive/*`. Create the `pontive` npm org. | A platform with UI kits, OIDC clients, authz and webhook SDKs is what every platform company puts under one scope (Clerk, WorkOS, Auth0, Stripe, Supabase). Cross-layer deps (`pontkit-core` importing `oidc-client`) read like one vendor. `@pontkit/*` was the runner-up; use it only if PontKit becomes a standalone brand. |
| Package naming | Product prefix + framework suffix: `@pontive/pontkit-react`, `@pontive/pontkit-vue`. Headless SDKs are plain: `@pontive/oidc-client`, `@pontive/authz`, `@pontive/webhooks`. | WorkOS pattern (`@workos-inc/authkit-react`). Clerk uses flat `@clerk/react` because it has one UI product. |
| Per framework: packages or subpaths | **One package per framework.** | Peers differ (`react` vs `@angular/core` vs `vue`); npm 7+ auto-installs peers, so one package would force everyone to install everything or mark all peers optional. Build pipelines differ (Vite lib vs ng-packagr vs `.svelte` source). Install size and `sideEffects` differ. Neither Clerk nor WorkOS uses subpaths for frameworks. |
| Per domain (auth, billing, …): packages or subpaths | **Subpaths inside each framework package**: `@pontive/pontkit-react/auth`, `@pontive/pontkit-react/billing`. | Domains share peers and build. Domain × framework packages would give 12 near-identical packages for 3 domains × 4 frameworks. |
| Rule of thumb | Split packages along the axis where dependencies differ (framework). Use subpaths along the axis where they don't (domain). | |
| **ui-kit** | **Absorb into `pontkit-core`.** Its source is copied into the core repo and PontKit stops depending on the package. | Decided 2026-09-06. It is already a private dependency — core is its only live consumer — and its stylesheet is already inlined into core's published `dist/styles.css`, so the two ship as one artifact regardless. Keeping it separate means renaming its tokens in lockstep with core forever, across two release cadences, for a package no Pontive code will install. The copy diverges from the original by design; see the row below for what happens to the original. |
| **Prefix** | **One prefix, `pont-`, for everything.** `sb-` (58 widget elements) and `rtg-` (208 primitives) collapse into a single `pont-*` element vocabulary, a single Tailwind prefix, and a single `--pont-*` token namespace. | Decided 2026-09-06. branding-svc already treats `rtg-` and `sb-` as **one tier** (`componentTokenKey = ^(rtg\|sb)-[a-z0-9-]+$`, `pkg/branding/components.go:34`); the reference/semantic/component tiers are marked by the segment *after* the prefix, so the merge removes two names for one thing rather than erasing a distinction. The curated-vs-internal boundary is carried by `catalog.json`, not by the prefix (§6.3). Collisions are 3 tags and 1 token (§6.2). |
| Repos | Keep core separate (now including the primitives). Turn the wrapper repo into a small workspace monorepo of framework bindings. New monorepo for headless SDKs. | Core needs its own release cadence for per-customer CDN versioning. Bindings share a loader and codegen, so they belong together (Clerk's `@clerk/shared` is why one team supports 15 frameworks; WorkOS's repo-per-framework reimplements session handling each time). |
| Naming inside the code | **`pont-` everywhere. No `sb`, `Sb`, `SB`, `saasbase`, `SaaSBase`, `rtg`, `Rtg` or `RTG` anywhere** — tags, classes, events, CSS tokens, Tailwind prefix, window globals, catalog, filenames. See §6. | Decided 2026-09-04, extended to `rtg` on 2026-09-06. Do it once, at the rename, rather than carrying two dead brands into a new package namespace. |
| Core delivery | CDN, deterministic, platform-decided. **Already implemented — do not rebuild.** See §5. | |
| Headless auth | Extract core's `src/auth` into `@pontive/oidc-client`. Core depends on it like any consumer. | Mobile, Node and custom-UI customers need it without Lit. **Not** for size: measured after the extraction, `index.mjs` goes 1,001,647 → 1,014,885 bytes, about 1% *larger*, because core still inlines the package for CDN delivery. The reason is reach. |
| Element bundle per domain | Not yet. One `pontkit-core` until a second domain exists. Keep `primitives` / `wrappers` / `widgets` / `ui` boundaries clean so a later split is a package move. | Clerk and WorkOS both ship all domains in one bundle. Clerk only started splitting (`@clerk/ui`) when size became a problem. |
| Backward compat | None. `npm deprecate` the `@saasbase-io/*` packages pointing at the new names. No aliases, no shims, no dual tag registration. | Greenfield. |
| ui-kit after absorption | **Keep `@revotech-group/revotech-ui-kit` published and its repo read-only. Do NOT deprecate it.** PontKit takes a copy; the package stays available to other Revotech apps at its current version. | Decided 2026-09-06. The absorption is a fork, not a migration — nothing outside Pontive has to move, and no consumer sees a deprecation warning for a package that is still correct for them. The two diverge from here; ui-kit is frozen from PontKit's point of view. |

## 3. Target package layout

Bottom up.

| Layer | Packages | Delivery | Peers |
|---|---|---|---|
| Headless SDKs | `@pontive/oidc-client` (browser OIDC/OAuth for Pontive issuers), `@pontive/authz` (fine-grained authorization client), `@pontive/webhooks` (webhooks-as-a-service), `@pontive/server` (server-side API client) | npm, bundled by the app | none |
| Elements | `@pontive/pontkit-core` — provider, contexts, **primitives (ex-ui-kit)**, design tokens, all `pont-*` elements for now. Later: `pontkit-auth`, `pontkit-billing` as separately loaded element bundles. | CDN, per-customer version | none (`lit` is a real dependency) |
| Bindings | `@pontive/pontkit-loader`, `@pontive/pontkit-react`, `-vue`, `-angular`, `-svelte`, each with domain subpaths | npm, generated from manifests | the framework |
| Meta-framework | `@pontive/pontkit-nextjs` (React binding + auth proxy under `/server`), later `-nuxt`, `-sveltekit` | npm | framework + meta-framework |

Notes:

- `pontkit-loader` is separate because Vue/Svelte/Solid need almost nothing but the loader plus types, and must not depend on the React package.
- The auth proxy (today `@saasbase-io/elements/proxy`) moves into `pontkit-nextjs` rather than a standalone proxy package. Clerk has no generic proxy package; server glue lives in `@clerk/nextjs` with a `/server` subpath. Keep a Vite adapter as a subpath of the loader or a tiny `pontkit-vite` if it is still needed.
- Every binding package has `@pontive/pontkit-core` as a **devDependency** only (types + manifest for codegen). Nothing bundles core.
- Core is `sideEffects: true` (`@customElement` registers on import). Bindings are `sideEffects: false`.
- The 208 primitives are **not** added to `catalog.json`. They are internal composition elements; the catalog stays the 30 curated widget elements branding-svc places.

## 4. Repos

### Repo A: `pontkit-core` (rename of `saasbase-core-elements`, absorbing `ui-kit`) → `@pontive/pontkit-core`

Single package. Changes, in order:

1. **Absorb ui-kit.** `git subtree`/`git mv` its `src/` into `src/primitives/`, merge the two Tailwind configs into one (`prefix: "pont-"`, union of both `theme.extend`), fold `library.css` into the local stylesheet chain so nothing is `@import`ed from `node_modules`, and drop the `@revotech-group/revotech-ui-kit` dependency and the `node_modules/...` deep type imports in `src/types/components/rtg.ts`. Merge its deps (`class-variance-authority`, `clsx`, `tailwind-merge`, `tailwindcss-animate`, `@open-wc/lit-helpers`). Keep its 50 stories — they are the visual regression net for step 2.
2. **Run the §6 rename codemod** over the merged tree. This is one commit, before anything else structural.
3. Rename the package; keep `files: ["dist", "catalog.json"]`; add `sideEffects: true`.
4. Add `@custom-elements-manifest/analyzer`. Emit `custom-elements.json`, add to `files`, declare via the `customElements` package.json field. This is the input for every framework's wrapper generation. Mark the primitives so codegen can exclude them from the React/Vue wrapper surface if wanted.
5. Export `@/types` from `src/index.ts`.
6. Add `HTMLElementTagNameMap` declarations to the widget/wrapper elements (`pont-provider`, `pont-signin`, `pont-signup`, `pont-nav-user`, …). Today only renderers/ui declare them, which is exactly the set React wraps.
7. ✅ Extract `src/auth` to `@pontive/oidc-client`; depend on it. `waitForAuthConfigured` stays in core — it warns about `<pont-provider>`, which is a widget concern — and `auth.configured.test.ts` splits along the same line.
8. Dependency hygiene: `lit` to `dependencies`; remove `react`, `react-dom`, `next` peers, `@lit/react`, and `@storybook/web-components` from runtime deps (the bundle is ~1 MB JS + ~1 MB CSS partly because of these).
9. Rewrite the stale `CLAUDE.md` (still describes `/react` and `/next` entries that live in the other repo).
10. `catalog.json` structure, `check-catalog.mjs`, `guard-publish.mjs`, release-please: unchanged apart from the tag rename.

### Repo B: `pontkit` (rename of `saasbase-elements`) → bindings monorepo

```
pontkit/                          npm workspaces + turbo; release-please manifest mode, fixed (lockstep) versioning
  packages/
    loader/     @pontive/pontkit-loader   CDN loader, window globals, version resolution   ← src/load-web-components.ts, src/runtime-config.ts, src/core-elements-version.ts, src/utils/sdk-loaded.ts, ./web-components
    react/      @pontive/pontkit-react    wrap(), Provider/AuthState context, SignedIn/Out ← src/frameworks/react, src/utils/created-wrap.ts
    nextjs/     @pontive/pontkit-nextjs   re-exports react + `/server` auth proxy          ← src/proxy
    vue/        @pontive/pontkit-vue      plugin + generated GlobalComponents types        (new; proves the template)
    angular/    @pontive/pontkit-angular  ng-packagr, standalone directives                (later)
    svelte/     @pontive/pontkit-svelte   generated types + loader init                    (later)
  tools/
    gen-wrappers/                         reads @pontive/pontkit-core custom-elements.json, emits per-framework files
  examples/
    next/  vue/                           smoke apps
```

Codegen output per framework:
- React: the `wrap()` call list. Keep the hand-rolled `wrap()` and the DOM-ownership rule ("React owns the tag, the element owns its interior"). `@lit/react`'s `createComponent` violates that rule.
- Vue: `GlobalComponents` d.ts plus a plugin that calls the loader and sets `isCustomElement`.
- Svelte: `svelteHTML` d.ts plus loader init.
- Angular: directive inputs/outputs, `CUSTOM_ELEMENTS_SCHEMA` guidance.

Codegen removes the hand-maintained stub classes (`src/virtual-web-components.ts`) entirely, so most of this repo's `Sb*` identifiers disappear rather than getting renamed.

The loader moves **as-is** (§5). Only its identifiers are renamed.

Bindings version in lockstep with each other and independently of core, with a declared compatible core major.

### Repo C: `pontive-js` (new) → headless SDKs

Workspace monorepo: `packages/oidc-client`, `authz`, `webhooks`, `server`. Independent versions (changesets or release-please manifest without lockstep). Start by moving core's `src/auth` here.

## 5. Core version resolution — already built

**The first draft of this document proposed replacing a jsDelivr "newest version" fetch with a build-time-baked major range. Both halves of that are wrong: the fetch is already gone, and the range would be a regression. Nothing in this section is work.**

What ships today, in `saasbase-elements/src/load-web-components.ts` and `src/runtime-config.ts`:

1. **Platform-decided, per project.** The loader calls `GET /auth/v1/runtime-config` and takes `core_elements_version` — an **exact** release — plus SRI hashes for the JS and CSS and, when the platform names one, its own asset URLs, which go ahead of the public CDNs in the source list.
2. **Exact fallback baked at build time.** `CORE_ELEMENTS_VERSION` is the exact release installed as a devDependency when the package was built, injected by `define` in `vite.config.ts` (`scripts/core-elements-version.mjs`). Used only when runtime-config cannot be read. `FALLBACK_VERSION = "^1"` no longer exists.
3. **SRI-verified load.** `loadVerifiedModule` fetches through a `<script type="module">` carrying `integrity`, then `import()`s from the module map. A hash mismatch fails the source and the loader moves to the next one.
4. Never `latest`, and never a range.

The server half is built too: `branding-svc` owns `deployment_core_elements`, `project_core_elements_override` and `core_elements_history` behind an audited promote-with-a-gate flow; `identity-svc` exposes `GetCoreElements`; the dashboard has a `CoreElementsCard`.

**A version range is forbidden, not merely unnecessary.** An exact release is immutable on the CDN, cacheable forever, and is the only form that admits an SRI hash — `pontive-spec/21-element-versioning-and-compatibility.md` §5 makes this normative. The `@pontive/pontkit-core@3` range URL the first draft proposed would silently drop integrity checking.

**Work in this area is limited to:** moving the three files into `packages/loader`, renaming `PACKAGE_NAME` to `@pontive/pontkit-core`, renaming the seven window globals (§6), and keeping the existing tests. A loader test asserting the baked version's major matches the core the types were generated from is worth adding.

## 6. Naming: `pont-` everywhere

No `sb`, `Sb`, `SB`, `saasbase`, `SaaSBase`, `rtg`, `Rtg` or `RTG` survives the rename, in any repo.

### 6.1 Inventory (measured 2026-09-06)

| Surface | Before | After | Scale |
|---|---|---|---|
| Element tags — widgets | `sb-provider`, `sb-signin`, … | `pont-provider`, `pont-signin`, … | 58 `@customElement` registrations in core; 17 distinct tags wrapped by React |
| Element tags — primitives | `rtg-button`, `rtg-card`, … | `pont-button`, `pont-card`, … | 208 registrations in ui-kit; 78 used directly by core |
| Element classes | `SbProvider`, `RtgButton` | `PontProvider`, `PontButton` | 774 `Sb[A-Z]` identifiers across 96 files in core; 37 `Rtg[A-Z]` in ui-kit; 58 in the bindings repo (most deleted by codegen, §4 Repo B) |
| DOM events | `sb:auth-changed` | `pont:auth-changed` | **8** event names: `sb:auth`, `sb:auth-changed`, `sb:branding`, `sb:design-mode`, `sb:env`, `sb:locale-changed`, `sb:set-locales`, `sb:unregistered-element` |
| Window globals | `__saasbaseCoreSdk` (core), plus `__saasbaseElementsLoaded`, `__saasbaseElementsLoading`, `__saasbaseConfiguredPatched`, `__saasbaseFailedForConfig`, `__saasbaseInitRetried`, `__saasbaseRetryInit` (bindings) | `__pontCoreSdk`, `__pontLoaded`, `__pontLoading`, `__pontConfiguredPatched`, `__pontFailedForConfig`, `__pontInitRetried`, `__pontRetryInit` | 7 globals, split across two repos |
| CSS custom properties (the theming API) | `--sb-*`, `--rtg-*` | `--pont-*` | 1763 distinct `--sb-*` (1405 declared in ui-kit, 402 in core's own `src/styles`) and 661 `--rtg-*`. The first draft's "1768 across 50 files under `src/styles/**`" conflated the two repos. |
| Tailwind utility prefix | `prefix: "sb-"` (core), `prefix: "rtg-"` (ui-kit), both Tailwind 3.4 | one `prefix: "pont-"` | 2 config lines; ~2050 `sb-` class occurrences in core TS, 8080 `rtg-` in ui-kit, 1273 `rtg-` in core |
| `catalog.json` tags | `sb-*` | `pont-*` | 30 tag entries (core), mirrored in branding-svc `pkg/markup/catalog/catalog.json` |
| Brand text and filenames | `saasbase`, `SaaSBase`, `revotech` | `pontive`, `PontKit` | 102 hits in core `src`, 52 in the bindings `src`, 17 in the demo including `components/saasbase.tsx` → `components/pontkit.tsx` |

Keep a Tailwind prefix, just make it one and rename it. Elements render into light DOM (`createRenderRoot() { return this }`), so their utility classes share a stylesheet namespace with the host application. The prefix is collision protection, not decoration.

### 6.2 Collisions from the prefix collapse

Merging the two vocabularies is nearly clean. Measured by stripping both prefixes and intersecting:

**Element tags — 4 collisions.** As resolved:

| Name | `sb-` side | `rtg-` side | Resolution |
|---|---|---|---|
| `alert` | in `catalog.json` (curated), 7 uses | 69 uses | Catalog keeps `pont-alert`. The primitive family becomes `pont-callout*`, **and its 61 component tokens move with it** — the dashboard stores those keys literally and compiles them into property names, so element and tokens must not diverge. |
| `form` | in `catalog.json`, 4 uses | 14 uses | Catalog keeps `pont-form`. The primitive root becomes `pont-form-root`, leaving its family (`form-field`, `form-item`, `form-label`, …) untouched. |
| `spinner` | 0 uses, no importers, not in the catalog | 47 uses | The widget copy was dead and duplicated the primitive — deleted rather than given an invented name. The primitive keeps `pont-spinner`. |
| `pagination` | 2 uses, not in the catalog | a 7-element family | **Missed by the first audit**, which grepped `@customElement`; this one registers via `customElements.define` directly and only surfaced as a duplicate `HTMLElementTagNameMap` entry at typecheck. The two are genuinely different — a stateful control vs a headless compositional family — so the family keeps `pont-pagination*` and the control becomes `pont-paginator`. |

An audit must cover **both** registration forms. `@customElement` alone misses 7 of 270 tags here.

**CSS tokens — 1 collision, and it was the dangerous kind.** There are **1,839** places where one layer feeds the other (`--rtg-x: var(--sb-y)`). In exactly one — `--rtg-field-label-space-gap: var(--sb-field-label-space-gap)` — the names match, so the collapse produces `--pont-x: var(--pont-x)`: a cyclic var, which CSS treats as guaranteed-invalid and drops **silently**, collapsing the auth field's label gap with nothing in any build log. The element tier's knob is now `--pont-auth-field-label-space-gap`.

Check for this mechanically before renaming: match `--(a|b)-X: var(--(a|b)-Y)` across the tree and flag every pair where X == Y after stripping prefixes.

**Tailwind classes — none possible.** Both configs generate from the same Tailwind core; the merge is of `theme.extend`, and a conflicting key there is a build-time error, not a silent collision.

### 6.3 The curated/internal boundary after the collapse

Today `branding-svc/pkg/markup/parse.go:235` rejects any tag not starting with `sb-` as a hard error, and *then* checks the catalog. After the collapse the prefix gate accepts all 266 tags and the catalog lookup becomes the only discriminator — a primitive in brand markup falls through to `CodeUnknownElement`, a **warning** rather than an error, and the node is still removed. Same outcome, weaker diagnostic.

This is acceptable because `catalog.json` was always the real boundary (branding-svc curates 30 of core's 262 elements, so the prefix was never sufficient). If the harder error is wanted back, add an `internal: true` flag to the manifest and have the catalog generator emit the primitives as explicitly-forbidden entries.

**As implemented**, the prefix is now the `elementPrefix` constant in `pkg/markup/parse.go` rather than three separate literals, with this reasoning recorded beside it.

### 6.4 Mechanics

- Do the rename as **one commit per repo, before the restructure**, so the package-split diff stays reviewable. In Repo A, absorb ui-kit first (§4.A step 1) so there is one tree to codemod.
- Codemod, not hand edits. Apply the §6.2 collision resolutions first, by hand, so the codemod cannot merge two distinct things into one name.
- **There is no green intermediate between "absorbed" and "renamed".** A Tailwind config takes a single prefix, so merging the two configs forces the prefix collapse; the tree does not build until the rename lands. Plan two commits on one branch, not two landable steps.
- Tailwind class renames fail silently, so follow the codemod with a full build **and** a rendered pass over the stories — not just a test run.
- Add a CI guard (`scripts/check-no-legacy-names.mjs`) and wire it into `prepublishOnly`. Exclude changelogs and this document, which quote the old names deliberately. **The guard is only honest once ui-kit is absorbed** — while its stylesheet is `@import`ed from `node_modules`, 1405 `--sb-*` declarations reach the published CSS without appearing in any grepped source.

#### The four ways this fails silently

Every one of these was hit. None produced an error; each was found by a diff or an audit, and each would have shipped.

**1. Word boundaries do not survive escaping.** Widget markup is stored JSON- and SQL-escaped as `\u003csb-block\u003e`. The `c` of `\u003c` is a word character, so a `\b`-anchored rule matches the *closing* tag (preceded by `/`) but not the opening one — rewriting **731 pairs** into `<sb-block></pont-block>`. Nothing fails until a widget renders. Add an explicit rule for the escape forms, ahead of the `\b` rules.

**2. Tailwind's negative modifier puts a second `-` after the prefix.** `rtg--translate-x-1/2` is not matched by `\brtg-(?=[a-z0-9])`. Such a class survives the rename, stops being generated, and nothing reports it — the radio indicator simply stops being centred. The lookahead must allow `-`: `(?=[a-z0-9-])`.

**3. The same rule is copied more than you think.** The component-tier regex `^(rtg|sb)-[a-z0-9-]+$` exists in **three** places: `branding-svc/pkg/branding/components.go`, the dashboard's `tokens/emitters/component.ts`, and the dashboard's `scripts/branding/audit-style-groups.ts`. The codemod skips all three, because the prefix there is not followed by a name. Two were obvious; the third emitted **892 false failures** once found, and a stale copy *misclassifies silently* rather than erroring. Grep for the rule itself, not just for the prefix.

**4. Case-preserving brand rules guess wrong across repos.** `SaaSBase` means the UI kit in the element repos (→ `PontKit`) and the platform in every service (→ `Pontive`). One rule cannot serve both. Guessing `PontKit` in branding-svc produced `X-PontKit-Project-ID` in a documented curl command. Decide per repo which noun the brand stood for.

And one that is not silent but wastes a cycle: a `SKIP_DIRS` list containing `build` or `dist` will skip **source** directories with those names. The dashboard has `src/**/preview/build/`; skipping it left 28 imports pointing at already-moved files and hid 2,355 further token renames.

#### Verification that actually catches things

- Diff the **generated stylesheet** against the last published one, as name sets with the deliberate renames normalised away. Anything left over is either a bug or something you deleted on purpose, and you should be able to say which.
- Assert **no self-referential custom property** in the built CSS: `--x: var(--x)`.
- Assert **every panel key resolves** against the runtime's compiled stylesheet. `audit:tokens` reporting "443 controls, 443 driving a real token, 0 naming nothing" is the single most valuable check in this work, because it is cross-repo and mechanical.
- Build Storybook and **render** a few stories. The build alone caught 20 `.mdx` files the path rename missed; rendering confirmed the negative-modifier fix.

### 6.5 Coordination

- **`catalog.json` tags are cross-service.** branding-svc curates against the catalog and identity-svc's flow engine keys off tags and attribute names. Greenfield, so no dual-tag aliasing and no data migration for stored flows.
- **Corrected: identity-svc holds no seeded flow markup.** The first draft said to "recreate seeded and default flow definitions with the new tags" in both services. All the widget markup lives in `branding-svc/db/migrations/00100_initial.sql`; identity-svc's own migrations contain zero `sb-` occurrences. Its rename is comments, resolver fixtures and prose.
- **Two branding-svc artifacts are generated, not hand-edited.** `pkg/builtinwidgets/widgets.json` (2280 `sb-` occurrences) and the five locale files come from the migration via `scripts/genbuiltinwidgets -write` and `scripts/genbuiltintranslations`. Edit the migration, then regenerate. Translation reconciliation reporting "0 added, 0 dropped, 0 reset" is the check that only tags moved and no copy did.
- **identity-svc consumes branding-svc as a Go module.** `pkg/builtinwidgets` is the artifact its resolver falls back to, so identity-svc's fixtures cannot pass until branding-svc is released. Prove the rename with a temporary `replace github.com/revotech-group/branding-svc => ../branding-svc`; do not commit it.
- **`--sb-*` tokens are NOT purely local.** The first draft claimed "no token name is constructed from backend data." That is false. branding-svc builds token names in Go and stores the compiled stylesheet per brand:
  - `pkg/branding/compile.go:274` — `fmt.Sprintf("--sb-ref-color-%s-%s", palette, shade)`
  - `pkg/branding/compile.go:144` — `"--sb-ref-radius"`; `:43` — `var(--sb-ref-color-transparent)`; `:48-49` — the white/black map
  - `pkg/branding/compile.go:387` — `fmt.Sprintf("var(--sb-ref-color-%s-%s)", head, tail)`
  - `pkg/branding/widgetstyles.go:76` — `[data-sb-widget="<id>"]`, re-parsed at `compile.go:214`
  - `pkg/branding/components.go:34` — `componentTokenKey = ^(rtg|sb)-[a-z0-9-]+$`

  So the token rename is a Go change plus a **recompile of every stored brand**, not a local codemod. The `data-sb-widget` attribute is a third cross-boundary contract (proto docs, `pkg/markup/resolve.go`, `pkg/compose/compose.go`) and renames with it.
- **The dashboard mirrors both surfaces.** `saasbase-dashboard` holds 2224 `--sb-*` and 712 `--rtg-*` names, including `src/features/branding/tokens/__fixtures__/runtime-tokens.json`, a snapshot of core's declared tokens whose own comment warns that a name disappearing from it is a panel control that silently stops working. `features/branding/tokens/emitters/component.ts` must stay byte-identical to branding-svc's `components.go` — so the two rename in the same change, along with the third copy in `audit-style-groups.ts` (§6.4).
- **Regenerate the token manifest from the local core build**, not the CDN: `refresh-token-manifest.ts` fetches `@pontive/pontkit-core@latest`, which does not exist until publish. Refreshing it is also what makes stale fixture keys honest — see §14.
- **`pont-` is a valid custom element prefix.** Custom element names need a hyphen, which `pont-provider` satisfies, and the prefix does not collide with any known library.
- **Fix the spec's stray name.** `pontive-spec/21-element-versioning-and-compatibility.md` writes `@pontive-io/core-elements`, which is neither the old name nor the decided one.

## 7. Future widgets: scoped widget tokens

When billing / member-management widgets exist, copy WorkOS's pattern: the server SDK mints a short-lived, scoped widget token (`widgets.getToken({ userId, organizationId, scopes })`) and the widget takes it as a prop. Permissions are enforced per widget scope, not by the session cookie alone.

## 8. Cleanup to fold into the move

- `MemberManagement` is wrapped over `SbAccountSettings` instead of `SbMemberManagement` (`src/frameworks/react/index.ts`).
- Dead `@lit/react` and `url` dependencies; stale `module: dist/index.js`; missing `files` / `sideEffects` in the React package.
- Unused `SbAuthState` / `SbSignedIn` / `SbSignedOut` / `SbAuthenticated` stubs.
- Core's `src/types/components/rtg.ts` imports types by `node_modules/...` path; the absorption removes the need for it entirely.
- ~~`FALLBACK_VERSION = "^1"` in the loader.~~ Already fixed; see §5.

## 9. Execution order

**Manual prerequisites (not code):**

0a. Create the `pontive` npm org (confirm name availability at creation; `@pontkit` is confirmed free, `@pontive` was inconclusive against an unauthenticated registry probe).
0b. GitHub renames in `revotech-group` — rename in place rather than creating new repos, so history, issues, release-please state and clone URLs survive: `saasbase-core-elements` → `pontkit-core`, `saasbase-elements` → `pontkit`.
0c. Create the empty `pontive-js` repo.
0d. Archive `saasbase-ui-elements`, `saasbase-branding-and-widgets`, `saasbase-widget-customiser`. Rename `saasbase-react-demo` → `pontive-react-demo` and migrate it (step 8b).
0e. `ui-kit` goes read-only after the absorption, and stays published for other Revotech apps.

**Done 2026-09-06:** the `pontive` npm org exists; `pontkit-core`, `pontkit` and `pontive-react-demo` are renamed on GitHub and locally; all trees clean.

**Then:**

1. ✅ **Done** — Repo A: absorb ui-kit (§4.A step 1), merged Tailwind config. `pontkit-core@absorb-ui-kit`, PR #313 (draft).
2. ✅ **Done** — Repo A: §6.2 collisions by hand, then the codemod. Same branch. Build, 80/80 tests, `check:catalog` clean, Storybook 444 entries, rendered pass.
3. ✅ **Done** — `branding-svc@pontive-rename` (full suite incl. postgres + golden corpus) and `saasbase-dashboard@pontive-headers` (`audit:tokens` 443/443, `audit:style-groups`, `audit:widget-defaults`, `tsc` all clean). `components.go`, `component.ts` and `audit-style-groups.ts` changed together.
4. ✅ **Done** — `identity-svc@pontive-rename`. No catalog or seed data to recreate (§6.5); verified against the local branding-svc with a temporary `replace`, zero failures.

   Not yet done for step 3: **recompiling stored brands**. That is a data operation against a live deployment, not a code change, and it belongs to the release in §12.
5. ✅ **Done (code)** — Repo C: `oidc-client` extracted to `pontive-js@main`; `pontkit-core` repointed at it. Zero runtime deps, 76/76 tests, dual ESM/CJS, `npm pack` 7 files. `tsc` in core is now clean for the first time on this branch. **Publishing `1.0.0` is outstanding** — core declares `^1.0.0` and cannot `npm install` until it exists.
6. Repo A: rename the package to `@pontive/pontkit-core`; §4.A steps 3–10; publish `3.0.0`.
7. Repo B: run the §6 codemod; convert to workspaces + turbo; `git mv` into `packages/loader`, `packages/react`, `packages/nextjs`; rename; fix §8; move the loader unchanged (§5); add `tools/gen-wrappers` and replace the hand-written React export list with generated output (diff to zero except the `MemberManagement` fix); add `packages/vue`; publish all at `3.0.0`.
8. `pontive-next-demo`: replace `@saasbase-io/elements` with `@pontive/pontkit-nextjs`; rename `components/saasbase.tsx` to `components/pontkit.tsx`, still a re-export file. Update the cascade comment at the top of `app/globals.css`, which names both the old package and `--sb-sem-font-family`. The demo's own `--pv-*` chrome tokens are unrelated and stay as they are. Read the relevant guide under `node_modules/next/dist/docs/` before touching Next.js code — this is not the Next.js in your training data.
8b. `pontive-react-demo`: rename the package `saasbased-react-demo` → `pontive-react-demo`; replace `@saasbase-io/elements` with `@pontive/pontkit-react` (Vite, not Next — it takes the React binding directly, plus the loader's Vite adapter if the proxy is used); rename `sb-`/`saasbase` identifiers in `src/`, `vite.config.ts`, `.env.production` and `.github/workflows/deploy-react-demo.yml`.
8c. `auth-api/web/hosted-login`: replace `@saasbase-io/core-elements@2.16.5` with `@pontive/pontkit-core@3`; rename the tags `src/boot.ts` constructs (`sb-provider`, `sb-signin`, `sb-signup`) and the `sb-`/`saasbase` references in `src/env.ts`; rebuild the committed `dist/`. This is the hosted login page every project's auth domain serves — do not leave it for last on the grounds that it is "inside a service".
9. `npm deprecate` all `@saasbase-io/*` packages, pointing at the new names. **Not** `@revotech-group/revotech-ui-kit` — it stays published and undeprecated for other Revotech consumers (§2).

Steps 5 and 7 are independent of the rename and can run in parallel.

**The schedule risk was misjudged.** The first draft named steps 3 and 4 as the risk. In practice step 3 was large but mechanical, step 4 was trivial, and the real cost was elsewhere: the HTTP header migration (§13), which this document never mentioned and which touches nine repos and the shared Go library, and the ordering constraints in §12, which no amount of code review substitutes for.

## 10. Verification

### Done (§9 steps 1–4)

| | Result |
|---|---|
| CI guard (§6.4) | passes in `pontkit-core` |
| `pontkit-core` | build ✓, 80/80 tests, `check:catalog` 0 mismatches over 86 resolved defaults, `tsc` 5 errors — all pre-existing auth-test failures, `main` had 17 |
| Absorption | `dist/styles.css` carries no `--sb-`, `--rtg-`, `.sb-` or `.rtg-`; nothing `@import`ed from `node_modules`; `@revotech-group/revotech-ui-kit` gone from `package.json` and lockfile |
| Stylesheet size | **1,026,755 → 573,179 bytes (44% smaller)**, from removing a doubled Tailwind pass and a primitive stylesheet that shipped twice (`postcss-append.cjs` appended what `tailwind.css` already imported). JS unchanged. |
| Stylesheet diff vs published 2.16.6 | five names unaccounted for after normalising the deliberate renames, all Tailwind utilities used only by ui-kit's deleted `light-sample-demo` |
| Cyclic vars | zero self-referential custom properties in 573KB of output |
| Storybook | builds 444 entries (366 stories, 78 docs); auth form, radio group and alert rendered and checked |
| `branding-svc` | full suite incl. postgres storage and the branding golden corpus; `genbuiltinwidgets` reports the artifact current; translation reconciliation 0 added / 0 dropped / 0 reset |
| `saasbase-dashboard` | `audit:tokens` **443 panel controls, 443 driving a real token, 0 naming nothing**; `audit:style-groups` and `audit:widget-defaults` exit 0; `tsc` 0 errors |
| Cross-repo | core's 29 catalog tags ⊂ branding-svc's 30 (`pont-block` extra), zero non-`pont-` tags; all three copies of the component-tier regex read `^pont-[a-z0-9-]+$` |
| `identity-svc` | full suite, zero failures, against a local `replace` of branding-svc |

**Not yet verified, and it is the one that needs a live system:** a brand saved before the rename, recompiled after, producing the same rendered colours. That is part of the §12 Chain B release, not of any branch.

### Outstanding

- The CI guard still needs adding to `pontkit`, `branding-svc`, `saasbase-dashboard` and both demos.
- Repo A publish: `npm run build` emits `custom-elements.json` with all 262 elements; `dist/index.d.ts` includes exported types and tag-map entries; `npm pack --dry-run` shows only `dist`, `catalog.json`, `custom-elements.json`.
- Repo B: root `npm run build` and `npm test` pass; existing `cdn-import.test.ts`, `ssr.test.ts`, `auth.test.tsx`, `runtime-config.test.ts`, `core-elements-version.test.ts` pass unchanged in their new homes; `npm pack --dry-run` per package shows correct `files`, `exports`, `sideEffects`, no `src/`.
- Demo: install from local `npm pack` tarballs (not `npm link`, which loads a second React); `next dev`; sign-in flow and a client-side navigation with no `NotFoundError`; network tab shows core fetched from the platform's asset URL with an integrity attribute, and the SRI hash enforced.
- Vue smoke app renders `<pont-provider>` with typed props and no console errors.

## 11. Reference: how Clerk and WorkOS do it

| | Clerk | WorkOS |
|---|---|---|
| Scope | `@clerk/*` | `@workos-inc/*` |
| Naming | `@clerk/react`, `@clerk/nextjs`, `@clerk/vue`, `@clerk/backend` | `@workos-inc/authkit-js`, `authkit-react`, `authkit-nextjs`, `authkit-remix`, `authkit-sveltekit`, `widgets`, `node` |
| Repos | One pnpm + turbo monorepo (~27 packages), changesets, independent versions | One repo per package |
| Headless layer | `@clerk/clerk-js` engine, `@clerk/shared` internals, `@clerk/backend` server | `@workos-inc/authkit-js` browser, `@workos-inc/node` server |
| Binding → engine | `@clerk/react` does not depend on clerk-js; hot-loads `https://{host}/npm/@clerk/clerk-js@{major}/dist/clerk.browser.js`; host is the tenant's Frontend API domain, proxy, or custom domain | `authkit-react` depends on `authkit-js` as a normal npm dep, bundled |
| Domains | All in one clerk-js bundle (auth, orgs, profile, billing); `@clerk/ui` being split out for size | All widgets in one React-only `widgets` package; peers `@radix-ui/themes`, `@tanstack/react-query`; server-minted scoped `authToken` |
| Server glue | Inside the meta-framework package: `@clerk/nextjs` root = client, `/server` = server | `@workos-inc/authkit-nextjs` |

Note that PontKit's delivery model is **stricter than Clerk's**, not a copy of it: Clerk hot-loads a major range, PontKit an exact platform-gated release with an SRI hash (§5).

Sources (checked 2026-09-04):
- https://github.com/clerk/javascript/tree/main/packages
- https://raw.githubusercontent.com/clerk/javascript/main/package.json
- https://raw.githubusercontent.com/clerk/javascript/main/packages/react/package.json
- https://raw.githubusercontent.com/clerk/javascript/main/packages/shared/src/loadClerkJsScript.ts
- https://raw.githubusercontent.com/clerk/javascript/main/packages/shared/src/versionSelector.ts
- https://github.com/orgs/workos/repositories?q=authkit
- https://raw.githubusercontent.com/workos/authkit-react/main/package.json
- https://workos.com/docs/widgets/quick-start
- https://workos.com/docs/user-management/widgets

## 12. Release chains

Nothing here can merge or deploy independently. Two chains, each a flag day, and both gated on a release only a human can trigger.

### Chain A — the request headers (§13)

1. Merge and **release `saasbase-core`** (currently v1.31.1). This is the shared Go library that reads the header.
2. Bump `github.com/revotech-group/saasbase-core` in the seven services that embed it: `auth-api`, `management-api`, `identity-svc`, `branding-svc`, `platform-core-svc`, `webhook-svc`, `eventbus-svc`.
3. Deploy those together with `saasbase-dashboard` and `@pontive/pontkit-core`.

**No partial state works, and the failure is not graceful.** CORS is the first gate a browser hits: until `auth-api`'s allowlist names the new header, a preflight carrying it is rejected and the request never reaches the middleware. Deploy the middleware first and every client still sending the old name gets a 400. The system is pre-launch, so a flag day is acceptable; if that stops being true, have the middleware read the new name and fall back to the old for one release, and ordering stops mattering.

### Chain B — the element vocabulary

1. Merge and **release `branding-svc`** (currently v0.0.26) carrying the `pont-*` catalog and regenerated `widgets.json`.
2. Bump it in `identity-svc`, whose resolver fixtures cannot pass until then (§6.5).
3. Publish `@pontive/pontkit-core@3.0.0`.
4. **Recompile every stored brand.** The compiled stylesheets in the database still carry `--sb-*` property names; nothing re-derives them on read.
5. Then the consumers: both demos and `auth-api/web/hosted-login` (§9 step 8).

`saasbase-dashboard` sits in both chains and must go out with both.

## 13. The HTTP request headers

Not in the first draft at all, and it is the change with the widest blast radius in this work.

`@pontive/pontkit-core`'s fetch wrapper sends a project header on every call to `api.*`. Renaming the element vocabulary without renaming that header leaves `saasbase` in the most literally public surface the platform has — and `pontive-spec` had **already specified `X-Pontive-Project-ID`** in five places (`02-project-management.md`, `03-user-management.md`, `15`, `16`), so the implementation was the thing lagging, not the spec.

| Header | Was | Now |
|---|---|---|
| Project scope, sent by browsers and SDKs to `api.*` | `X-Saasbase-Project-ID` | `X-Pontive-Project-ID` |
| Serialized `RequestContext`, service to service | `X-Saasbase-Context` | `X-Pontive-Context` |

Nine repos. The header is **read** in `saasbase-core/pkg/http/middlewares/{project,context}.go` — the shared library every service embeds — which is what makes this a release rather than a rename. It is **sent** by `pontkit-core` and `saasbase-dashboard`, and **allowlisted or documented** in `auth-api`, `management-api`, `platform-management-api` and `go-core`.

Both names are now constants in `saasbase-core/pkg/http/middlewares/headers.go` rather than literals at each use site, so the next person to touch one can find the others.

Two things deliberately left alone:

- **`pkg/http/http_client.go` emits `X-Truuth-Context`**, not the context header the middleware reads. That mismatch predates this work and is harmless today because nothing in the platform sets the context header. Fixing it is a behaviour change, not a rename.
- **`go-core`** is a stale copy of the same middleware that no service imports. Its headers were renamed for consistency only, so that nobody reintroduces the old names from it.

## 14. Pre-existing bugs this surfaced

None of these were caused by the rename. All were found because absorbing ui-kit made core's *declared* token set diffable against its *used* set for the first time, and because refreshing a stale snapshot made a fixture honest.

- **The body font has been broken in production.** `--sb-sem-font-family` is read by `body` and by four widget typography tokens (countdown, subtitle, title, OTP) and declared **zero times** in published 2.16.6. ui-kit renamed it to `--sb-sem-font-family-default` between 1.0.10 and the 1.1.2 core depends on, and the references were never updated — so every heading, title and OTP has been falling back to the browser default font. Fixed.
- **39 more dangling token references** remain: `var(--pont-x)` with no `--pont-x:` anywhere. Some are set at runtime by their element and are correct; telling those apart from real breakage is its own piece of work. Worth doing, worth not doing inside a rename.
- **A golden fixture asserting nothing.** `rtg-button-radius-default` has never been declared by core, not even in published 2.16.6 — the real name is `rtg-button-default-radius`. The fixture's own comment warns that "a stale key here would leave the fixture quietly asserting nothing", and a stale token manifest was what hid it.
- **The two golden corpora had already drifted.** `saasbase-dashboard`'s `compiler-golden.json` and `branding-svc`'s differ by 50 lines on `main` — the dashboard carries an `element-tier-tokens` case the service does not. They are described as enforcing that the two compilers agree; they do not currently do that.
- **`configure()` advertised a `clientSecret`.** Its validation message read "domain, appId, and clientSecret are required". Nothing has ever checked for one and `ConfigOptions` has no such field — this is a browser client, so a public client in OAuth terms, holding no secret. Five test fixtures still passed it, which is why `tsc` in core failed with exactly 5 errors on every run until the extraction. Telling a browser developer to supply a client secret is bad advice, not a stale string.
- **The stale token manifest itself.** `runtime-tokens.json` was snapshotted from a core older than the one shipping, which is precisely the failure its comment describes. Regenerating it against the real build moved it from 2409 to 2568 tokens.

