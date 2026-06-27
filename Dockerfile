FROM node:26-bookworm-slim AS build
LABEL org.opencontainers.image.source="https://github.com/geek007git/Hogyoku-OSS"
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src ./src
COPY tests ./tests
RUN npm run build

FROM node:26-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY public ./public
COPY src/db/migrations ./src/db/migrations
USER node
EXPOSE 4173
CMD ["node", "dist/src/server.js"]
