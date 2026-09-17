# DataViewer

Agent trajectory viewer built with React, Vite, Tailwind CSS, and Zustand.

## Langfuse integration

The UI does not read Langfuse credentials from the browser. The Vite dev server exposes a small Node-side API and uses the official Langfuse API client:

- `GET /api/langfuse/config`
- `GET /api/langfuse/files`
- `GET /api/langfuse/rows?fileId=...`
- `GET /api/langfuse/record?fileId=...&line=...`

Copy `.env.example` to `.env`, set the local Langfuse project keys, then run:

```bash
npm install
npm run dev
```

Trace names become dataset groups. Each trace is one row, and selecting a row fetches its observations and maps them to the viewer trajectory model. For local UI development without Langfuse credentials, set `DATA_SOURCE=mock`.

The adapter only accepts a local/private self-hosted `LANGFUSE_BASE_URL` (for example `http://127.0.0.1:3000`). Langfuse Cloud and other public endpoints are rejected. To start a local Langfuse instance:

```bash
docker compose -f docker-compose.langfuse.yml up -d
```

The built frontend still needs an equivalent `/api/langfuse` backend in production. The adapter intentionally keeps credentials server-side and can be mounted by an Express/Fastify service or reverse proxy.

## Hugging Face trajectory import

Import the public sample from `Nexdata-AI/Agent-Trajectory-Data-Sample` into the local Langfuse project:

```bash
npm run import:agent-trajectory
```

Each JSONL row becomes one Langfuse trace. The source filename becomes the file group in DataViewer, and message roles, reasoning content, and tool calls are preserved in the trace input.
