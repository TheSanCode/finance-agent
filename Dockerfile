FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
COPY apps ./apps
COPY packages ./packages
COPY tests ./tests
COPY tsconfig.json ./
COPY vitest.config.ts ./
COPY eslint.config.mjs ./
COPY prettier.config.mjs ./

RUN npm ci
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

COPY package*.json ./
COPY apps ./apps
COPY packages ./packages
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/health || exit 1
CMD ["node", "dist/apps/api/src/index.js"]
