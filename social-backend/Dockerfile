# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund


FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache ffmpeg \
	&& mkdir -p /app \
	&& chown -R node:node /app

COPY --chown=node:node --from=deps /app/node_modules ./node_modules

COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node app.js server.js ./
COPY --chown=node:node infra ./infra
COPY --chown=node:node middlewares ./middlewares
COPY --chown=node:node modules ./modules

EXPOSE 3000

USER node

CMD ["node", "server.js"]