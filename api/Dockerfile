FROM node:20-alpine AS base
WORKDIR /app

# OpenSSL (Prisma requirement on Alpine)
RUN apk add --no-cache openssl

# Install dependencies
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev && npm install --save-dev typescript tsx @types/node

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
COPY tsconfig.json ./
COPY src ./src/
RUN npx tsc -p tsconfig.json || true

# Remove dev dependencies
RUN npm prune --omit=dev

# Production image
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache openssl

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/dist ./dist
COPY --from=base /app/prisma ./prisma
COPY package*.json ./

# Run Prisma migrations on start then launch server.
#
# SECURITY / SAFETY:
#   Previously used `prisma db push --accept-data-loss`. That command can
#   silently drop columns and delete data with no rollback path. Reported
#   as C-04 of the 2026-05 @kleosr audit.
#
#   `migrate deploy` only applies committed migration files and never
#   destroys data. If no committed migrations exist yet (fresh repo state),
#   you can opt into a one-time bootstrap by setting
#   ALLOW_PRISMA_DB_PUSH_BOOTSTRAP=yes-i-understand at deploy time —
#   intentionally verbose so it never sneaks in silently.
CMD ["sh", "-c", "if [ \"$ALLOW_PRISMA_DB_PUSH_BOOTSTRAP\" = \"yes-i-understand\" ]; then echo '[bootstrap] Using prisma db push — DATA LOSS POSSIBLE'; npx prisma db push; else npx prisma migrate deploy; fi && node dist/index.js"]
