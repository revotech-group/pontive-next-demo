# syntax=docker/dockerfile:1

# The cluster's nodes are Graviton, so this image must be linux/arm64:
#
#   docker buildx build --platform linux/arm64 ...
#
# It is built on an x86 runner all the same, and no QEMU is involved. The
# builder stages pin $BUILDPLATFORM so they run natively; only the final stage
# follows the target platform, which is the one that needs an arm64 `node`.
#
# That works because `next.config.mjs` excludes sharp from the output trace, so
# `.next/standalone` is pure JavaScript with nothing architecture-specific in
# it. This is the same idea as the Go services' `ARG GOARCH=arm64` — decide the
# architecture in the Dockerfile, build natively — except Go cross-compiles a
# static binary while Node needs a real arm64 runtime, so here it is the base
# image of the last stage that carries the architecture rather than a compiler
# flag. Add a `next/image` and the trace gains a native binary again; see the
# note in next.config.mjs.
#
# `next/font/google` downloads Inter, JetBrains Mono and Playfair Display during
# `next build`, so the builder stage needs egress to fonts.googleapis.com and
# fonts.gstatic.com. A network-isolated build will fail there, not at runtime.

ARG NODE_IMAGE=node:24-alpine

FROM --platform=$BUILDPLATFORM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM --platform=$BUILDPLATFORM ${NODE_IMAGE} AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Every variable this app reads is resolved at BUILD time, which is why they are
# build args and not runtime env:
#
#   - PONTIVE_AUTH_HOST is read by next.config.mjs and serialised into the routes
#     manifest as the rewrite destination.
#   - NEXT_PUBLIC_* are inlined into the JavaScript bundle.
#
# So an image is specific to one Pontive project. Setting these in a Deployment
# manifest does nothing: the pod starts clean and sign-in fails against whatever
# host was compiled in. Build one image per target project and tag accordingly.
#
# BuildKit's linter warns `SecretsUsedInArgOrEnv` on PONTIVE_AUTH_HOST because
# the name contains "AUTH". It is a false positive: this is a public DNS name,
# not a credential. Do not "fix" it by moving it to a runtime secret — the value
# is consumed by next.config.mjs during `next build` and ends up verbatim in
# .next/routes-manifest.json, so a runtime secret would simply never be read.
ARG PONTIVE_AUTH_HOST
ARG NEXT_PUBLIC_PONTIVE_APP_ID
ARG NEXT_PUBLIC_PONTIVE_PROJECT_ID
ARG NEXT_PUBLIC_PONTIVE_API_BASE_URL
ARG NEXT_PUBLIC_PONTIVE_AUTH_DOMAIN=/__auth

ENV PONTIVE_AUTH_HOST=${PONTIVE_AUTH_HOST} \
    NEXT_PUBLIC_PONTIVE_APP_ID=${NEXT_PUBLIC_PONTIVE_APP_ID} \
    NEXT_PUBLIC_PONTIVE_PROJECT_ID=${NEXT_PUBLIC_PONTIVE_PROJECT_ID} \
    NEXT_PUBLIC_PONTIVE_API_BASE_URL=${NEXT_PUBLIC_PONTIVE_API_BASE_URL} \
    NEXT_PUBLIC_PONTIVE_AUTH_DOMAIN=${NEXT_PUBLIC_PONTIVE_AUTH_DOMAIN} \
    NEXT_TELEMETRY_DISABLED=1

# Fail here rather than shipping an image that builds cleanly and cannot sign in.
RUN for v in PONTIVE_AUTH_HOST NEXT_PUBLIC_PONTIVE_APP_ID \
             NEXT_PUBLIC_PONTIVE_PROJECT_ID NEXT_PUBLIC_PONTIVE_API_BASE_URL; do \
      eval "val=\$$v"; \
      [ -n "$val" ] || { echo "missing required build arg: $v" >&2; exit 1; }; \
    done

RUN npm run build

# No --platform: this stage follows the target, so it is the arm64 one.
FROM ${NODE_IMAGE} AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

# `server.js` and its traced dependencies, then the static assets standalone
# deliberately leaves behind. This app has no `public/` directory; add a third
# COPY for it if one is ever introduced.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# The server drains in-flight requests on SIGTERM. Give the pod a
# terminationGracePeriodSeconds of 30 so it is allowed to.
CMD ["node", "server.js"]
