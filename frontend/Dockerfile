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

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

USER nextjs

EXPOSE 3000

# Railway는 PORT 환경 변수를 자동으로 할당하므로, 
# 별도의 포트 지정 없이 npm start로 실행하면 됩니다.
CMD ["npm", "start"]