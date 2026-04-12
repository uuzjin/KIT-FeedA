# 1. 의존성 설치 단계
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

# 2. 빌드 단계
FROM node:20-alpine AS builder
WORKDIR /app

# Railway 대시보드에 등록한 변수를 빌드 시점에 사용하겠다는 선언
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

# 빌드 중인 Next.js가 인식할 수 있도록 환경 변수로 복사
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 빌드 진행
RUN npm run build

# 3. 실행 단계
FROM node:20-alpine AS runner
WORKDIR /app

# 권장되는 등호(=) 사용 형식
ENV NODE_ENV=production
# 텔레메트리 비활성화 (보안/프라이버시 및 런타임/빌드 성능 향상)
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# standalone 빌드 결과물과 정적 파일만 복사 (node_modules 전체 복사 제거)
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# standalone 모드에서는 server.js를 직접 실행하여 성능을 최적화합니다.
CMD ["node", "server.js"]