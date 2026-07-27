# syntax=docker/dockerfile:1
# Image for @veriworkly/site (Next.js, standalone output).

ARG NODE_VERSION=20.19.0

FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package*.json ./
RUN npm ci

FROM base AS builder
ARG NEXT_PUBLIC_BACKEND_URL
ARG SITE_URL
ARG BACKEND_INTERNAL_URL
ENV NEXT_PUBLIC_BACKEND_URL=${NEXT_PUBLIC_BACKEND_URL}
ENV SITE_URL=${SITE_URL}
ENV BACKEND_INTERNAL_URL=${BACKEND_INTERNAL_URL}
# Opts next.config.ts into `output: "standalone"`; see the comment there.
ENV BUILD_STANDALONE=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build:site

FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -S nextjs && adduser -S nextjs -G nextjs

# The standalone bundle mirrors the monorepo layout, so server.js lives at apps/site/server.js
# and its sibling public/ and .next/static/ must be restored at the same depth.
COPY --from=builder --chown=nextjs:nextjs /app/apps/site/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/apps/site/.next/static ./apps/site/.next/static
COPY --from=builder --chown=nextjs:nextjs /app/apps/site/public ./apps/site/public

USER nextjs

EXPOSE 3000

CMD ["node", "apps/site/server.js"]
