# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
WORKDIR /app

COPY package.json ./
COPY apps/web/package.json ./apps/web/package.json
RUN npm install --workspace=apps/web --include-workspace-root

COPY apps/web ./apps/web

FROM base AS development
WORKDIR /app/apps/web
EXPOSE 5173
CMD ["npm", "run", "dev"]

FROM base AS build
WORKDIR /app/apps/web
ARG VITE_API_BASE_URL=http://localhost:4000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

FROM nginx:alpine AS production
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
