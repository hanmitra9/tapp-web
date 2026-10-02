# One-off Railway job: applies the repo's Supabase migrations (history sync + db push) and exits.
# Service variables: SUPABASE_ACCESS_TOKEN or DB_PASSWORD. Restart policy: Never.
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /src
COPY supabase supabase
COPY deploy/db-update/run.sh /run.sh
RUN npm i -g supabase@latest --no-audit --no-fund
CMD ["bash", "/run.sh"]
