FROM node:26-alpine
WORKDIR /app
COPY server.mjs legacy-http.mjs legacy-store.mjs .
ENV PORT=8090 MHD_SYNC_DATA=/data
VOLUME ["/data"]
EXPOSE 8090
CMD ["node", "server.mjs"]
