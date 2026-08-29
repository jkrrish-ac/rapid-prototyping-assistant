# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
WORKDIR /app

# Install deps for the whole workspace (npm workspaces needs the root manifest)
COPY package.json ./
COPY apps/api/package.json ./apps/api/package.json
RUN npm install --workspace=apps/api --include-workspace-root

COPY apps/api ./apps/api

FROM base AS development
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["npm", "run", "start:dev"]

FROM base AS build
WORKDIR /app/apps/api
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY apps/api/package.json ./apps/api/package.json
RUN npm install --workspace=apps/api --include-workspace-root --omit=dev
COPY --from=build /app/apps/api/dist ./apps/api/dist
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
