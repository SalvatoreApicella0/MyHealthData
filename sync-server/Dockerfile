FROM node:22-alpine
WORKDIR /app
COPY hub.mjs hub-http.mjs hub-static.mjs hub-state.mjs hub-store.mjs hub-primitives.mjs .
ENV PORT=8472 MHD_HUB_HOST=0.0.0.0 MHD_HUB_DATA=/data MHD_HUB_REQUIRE_ENCRYPTION=1
VOLUME ["/data"]
EXPOSE 8472
CMD ["node", "hub.mjs"]
