# 1. Install dependencies only when needed
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* pnpm-lock.yaml* ./

# Install dependencies based on lock files
RUN if [ -f package-lock.json ]; then \
  npm ci --prefer-offline --no-audit; \
  elif [ -f pnpm-lock.yaml ]; then \
  npm install -g pnpm && pnpm install --frozen-lockfile; \
  else \
  npm install --prefer-offline --no-audit; \
  fi

# 2. Copy only source code (after deps, so cache works)
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Daftarkan ARG agar Railway meneruskan variabel lingkungan dari panel Variables saat build
ARG NEXT_PUBLIC_ADMIN_PANEL_PATH
ARG NEXT_PUBLIC_API_SECRET
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_BASE_URL
ARG NEXT_PUBLIC_GTM_ID

# Set sebagai ENV agar terbaca oleh Next.js selama proses kompilasi 'npm run build'
ENV NEXT_PUBLIC_ADMIN_PANEL_PATH=$NEXT_PUBLIC_ADMIN_PANEL_PATH
ENV NEXT_PUBLIC_API_SECRET=$NEXT_PUBLIC_API_SECRET
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL
# TAMBAHKAN BARIS INI di bawah ARG variabel lainnya
ARG NEXT_PUBLIC_GA_MEASUREMENT_ID

# SET JUGA SEBAGAI ENV di bawah ENV variabel lainnya
ENV NEXT_PUBLIC_GA_MEASUREMENT_ID=$NEXT_PUBLIC_GA_MEASUREMENT_ID
ENV NEXT_PUBLIC_GTM_ID=$NEXT_PUBLIC_GTM_ID

RUN npm run build

# 3. Production image
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Next.js standalone secara otomatis membuat folder standalone yang sudah include node_modules minimalis
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Jalankan Next.js server standalone
CMD ["node", "server.js"]