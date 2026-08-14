FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json ./
COPY package-lock.json ./
RUN npm ci

FROM dependencies AS build
COPY tsconfig.json prisma.config.ts ./
COPY prisma ./prisma
COPY src ./src
COPY public ./public
RUN npm run build

FROM dependencies AS production-dependencies
RUN npm prune --omit=dev
RUN npm cache clean --force

FROM node:24-bookworm-slim AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY package-lock.json ./
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/generated/prisma ./src/generated/prisma
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/public ./public
RUN chown -R node:node /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=5 CMD node -e "fetch('http://127.0.0.1:3000/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["sh", "-c", "npm run db:deploy && node dist/server.js"]
