# Build once, run the complete React/Vite + Express application on one VPS.
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM node:22-bookworm-slim
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0 DARSCHYN_DATA_DIR=/app/data
WORKDIR /app
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/node_modules ./node_modules
# Keep the audited offline maintenance utility in the *same* deployable image.
COPY --from=build --chown=node:node /app/scripts/rotate-root-credentials.cjs ./scripts/rotate-root-credentials.cjs
COPY --from=build --chown=node:node /app/extension ./extension
COPY --from=build --chown=node:node /app/mock-educational-system ./mock-educational-system
RUN mkdir -p /app/data && chown -R node:node /app/data
USER node
EXPOSE 3000
CMD ["node", "dist/server.cjs"]
