FROM node:20-bookworm-slim

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps ./apps
COPY cli ./cli
COPY packages ./packages
COPY plugins ./plugins
COPY scripts ./scripts
COPY README.md LICENSE MIGRATION-PHASE1.md ./

RUN pnpm install --frozen-lockfile
RUN pnpm build

ENV NODE_ENV=production
ENV PORT=3000
ENV CGE_WEB_PORT=3000
ENV CGE_RUNNER_PORT=3333
ENV CGE_RUNNER_HOST=127.0.0.1
ENV RUNNER_INTERNAL_URL=http://127.0.0.1:3333
ENV CGE_CONFIG_ROOT=/data/config/claude-grc
ENV CGE_CACHE_ROOT=/data/cache/claude-grc
ENV CGE_APP_DATA_ROOT=/data/app
ENV CGE_WORKSPACE_ROOT=/data/workspaces

EXPOSE 3000

CMD ["node", "scripts/start.mjs"]
