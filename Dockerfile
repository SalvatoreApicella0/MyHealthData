FROM node:26.10.0-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build

FROM node:26.10.0-alpine AS runtime
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY sync-server/hub.mjs sync-server/hub-http.mjs sync-server/hub-static.mjs sync-server/hub-state.mjs sync-server/hub-store.mjs sync-server/hub-primitives.mjs ./sync-server/
ENV PORT=8472 MHD_HUB_HOST=0.0.0.0 MHD_HUB_DATA=/data MHD_WEB_DIST=/app/dist MHD_HUB_REQUIRE_ENCRYPTION=1
VOLUME ["/data"]
EXPOSE 8472
CMD ["node", "sync-server/hub.mjs"]
