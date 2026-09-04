# One image, two roles: the Next.js web app and the BullMQ worker.
# The worker runs through tsx, and `prisma generate` is a devDependency step,
# so devDependencies stay installed in the final image on purpose.

FROM node:22-bookworm-slim AS base
# openssl: Prisma query engine. curl: container healthcheck.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
# npm 11.16+ blocks dependency install scripts by default. The build verifiably
# survives that (Prisma 7 generates without its postinstall), so no workaround
# is needed — but if a future base image breaks here, that gate is the suspect.
RUN npm ci

FROM deps AS build
COPY . .
# lib/env.ts reads secrets lazily, so the build never touches the real database
# or the real key. These placeholders exist only to satisfy module-load checks,
# and are scoped to this RUN so they cannot leak into the runtime image.
RUN DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build" \
    ENCRYPTION_KEY="0000000000000000000000000000000000000000000000000000000000000000" \
    npm run build

FROM build AS runtime
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["npm", "run", "start"]
