#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const DATASET_ID = 'Nexdata-AI/Agent-Trajectory-Data-Sample';
const DATASET_FILES = [
  'data-analyst-en',
  'data-analyst-ko',
  'deepsearch-en',
  'deepsearch-ko',
  'industry-research-en',
  'industry-research-ko',
];

const env = {};
for (const line of (await readFile('.env', 'utf8').catch(() => '')).split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '');
}

const baseUrl = new URL(env.LANGFUSE_BASE_URL ?? 'http://127.0.0.1:3000');
const publicKey = env.LANGFUSE_PUBLIC_KEY;
const secretKey = env.LANGFUSE_SECRET_KEY;

if (!publicKey || !secretKey) {
  throw new Error('Missing LANGFUSE_PUBLIC_KEY or LANGFUSE_SECRET_KEY');
}

const hostname = baseUrl.hostname.toLowerCase();
const isPrivateHost =
  hostname === 'localhost' ||
  /^127\./.test(hostname) ||
  /^10\./.test(hostname) ||
  /^192\.168\./.test(hostname) ||
  /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
  hostname === '::1' ||
  hostname.endsWith('.localhost');

if (!isPrivateHost) {
  throw new Error('LANGFUSE_BASE_URL must point to a local or self-hosted Langfuse instance');
}

const auth = Buffer.from(`${publicKey}:${secretKey}`).toString('base64');
let ingested = 0;

for (const file of DATASET_FILES) {
  const sourceUrl = `https://huggingface.co/datasets/${DATASET_ID}/resolve/main/${file}.jsonl`;
  const response = await fetch(sourceUrl, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`Failed to download ${sourceUrl}: ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  const rows = text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`Invalid JSONL in ${file}.jsonl at line ${index + 1}`, { cause: error });
      }
    });

  for (const [index, row] of rows.entries()) {
    const trajectory = row.trajectories?.[0];
    const messages = trajectory?.messages ?? [];
    const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant');
    const traceId = `${file}-${row.instance_id ?? index + 1}`;

    const payload = {
      metadata: { source: 'huggingface-dataset' },
      batch: [
        {
          type: 'trace-create',
          id: crypto.randomUUID(),
          timestamp: row.created_at ?? new Date().toISOString(),
          body: {
            id: traceId,
            timestamp: row.created_at ?? new Date().toISOString(),
            name: file,
            sessionId: row.instance_id ?? undefined,
            userId: row.model ?? undefined,
            input: messages,
            output: lastAssistant ?? row,
            metadata: {
              huggingface_dataset: DATASET_ID,
              source_file: `${file}.jsonl`,
              line: index + 1,
              trace_id: row.trace_id,
              schema_version: row.schema_version,
              model: row.model,
              cc_version: row.cc_version,
              max_tokens: row.max_tokens,
              thinking: row.thinking,
              effort: row.effort,
              turn_count: row.turn_count,
              turn_index: row.turn_index,
              status: row.status,
            },
            tags: ['agent-trajectory', 'huggingface', row.model].filter(Boolean),
          },
        },
      ],
    };

    const ingestResponse = await fetch(new URL('/api/public/ingestion', baseUrl), {
      method: 'POST',
      headers: {
        authorization: `Basic ${auth}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!ingestResponse.ok) {
      const body = await ingestResponse.text();
      throw new Error(`Langfuse ingestion failed for ${traceId}: ${ingestResponse.status} ${body}`);
    }

    const result = await ingestResponse.json();
    if (result.errors?.length) {
      throw new Error(`Langfuse rejected ${traceId}: ${JSON.stringify(result.errors)}`);
    }

    ingested += 1;
    console.log(`imported ${traceId}`);
  }
}

console.log(`Imported ${ingested} trajectories into local Langfuse.`);
