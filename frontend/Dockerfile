# 1. 의존성 설치 단계 (Dependencies)
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# 의존성 파일 복사
COPY package.json package-lock.json* ./

# [핵심] --legacy-peer-deps를 추가하여 의존성 충돌 해결
RUN npm install --legacy-peer-deps

# 2. 빌드 단계 (Builder)
FROM node:20-alpine AS builder
WORKDIR /app

# deps 단계에서 설치된 node_modules 복사
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js 빌드 진행
# 필요 시 환경 변수 주입 가능 (NEXT_PUBLIC_API_URL 등)
RUN npm run build

# 3. 실행 단계 (Runner)
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production

# 보안을 위해 비관리자 계정 사용
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 빌드 결과물 중 실행에 필요한 파일만 복사 (이미지 용량 최적화)
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

USER nextjs

EXPOSE 3000

# Next.js 실행
CMD ["npm", "start"]