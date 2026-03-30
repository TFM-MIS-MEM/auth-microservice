FROM node:20-alpine

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY package*.json pnpm-lock.yaml* ./

RUN corepack enable pnpm && pnpm install --prod --frozen-lockfile
RUN rm -rf /root/.local/share/pnpm/store

COPY . .

USER appuser

EXPOSE 3000

ENTRYPOINT ["node", "src/server.js"]
