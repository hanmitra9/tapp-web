# TAPP website on Railway (or any Docker host): landing + signed-in pages + admin, served by nginx.
# Build: landing comes prerendered from the repo; the web app and admin panel are built here.
# Runtime env: PORT (set by Railway). Build arg / Railway variable: SITE_URL (public URL, for canonical/og links).
FROM node:22-bookworm AS build
ARG SITE_URL=https://tappcreators.com
WORKDIR /src
COPY app/package.json app/package-lock.json app/
COPY admin/package.json admin/package-lock.json admin/
RUN cd app && npm ci --no-audit --no-fund && cd ../admin && npm ci --no-audit --no-fund
COPY . .
RUN python3 site/tools/build_all.py "$SITE_URL" --skip-landing

FROM nginx:1.27-alpine
COPY deploy/nginx.railway.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /src/dist /usr/share/nginx/html
ENV PORT=8080
EXPOSE 8080
