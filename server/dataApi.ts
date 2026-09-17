import { LangfuseAPIClient, type ObservationsView, type TraceWithDetails } from '@langfuse/core';
import type { DataFile, RowPreview, TrajectoryMessage, TrajectoryRecord } from '../src/types';
import { MOCK_FILES, makeRecord, makeRowPreview } from '../src/data/mock';

export type DataSource = 'langfuse' | 'mock';

interface RuntimeConfig {
  source: DataSource;
  publicKey?: string;
  secretKey?: string;
  baseUrl: string;
  maxTraces: number;
  traceTag?: string;
}

interface LangfuseSnapshot {
  traces: TraceWithDetails[];
  groups: Map<string, TraceWithDetails[]>;
  fetchedAt: number;
}

type TraceObservation = Pick<ObservationsView, 'id' | 'type' | 'startTime'> & {
  name?: string | null;
  level?: string;
  input?: unknown;
  output?: unknown;
};

interface TraceDetails {
  id: string;
  input?: unknown;
  output?: unknown;
  observations: TraceObservation[];
}

const CACHE_TTL_MS = 30_000;
let snapshot: LangfuseSnapshot | null = null;
let snapshotPromise: Promise<LangfuseSnapshot> | null = null;

const MOCK_SEEDS: Record<string, number> = {
  f1: 11,
  f2: 22,
  f3: 33,
  f4: 44,
  f5: 55,
  f6: 66,
};

function getConfig(env: Record<string, string | undefined>): RuntimeConfig {
  const source = (env.DATA_SOURCE ?? env.VITE_DATA_SOURCE ?? 'langfuse') as DataSource;
  const baseUrl = env.LANGFUSE_BASE_URL ?? 'http://127.0.0.1:3000';
  if (!isLocalLangfuseBaseUrl(baseUrl)) {
    throw new Error('LANGFUSE_BASE_URL must point to a local or self-hosted Langfuse instance');
  }

  return {
    source: source === 'mock' ? 'mock' : 'langfuse',
    publicKey: env.LANGFUSE_PUBLIC_KEY,
    secretKey: env.LANGFUSE_SECRET_KEY,
    baseUrl,
    maxTraces: Number(env.LANGFUSE_MAX_TRACES ?? 1000),
    traceTag: env.LANGFUSE_TRACE_TAG,
  };
}

function isLocalLangfuseBaseUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;

  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === 'host.docker.internal' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    (!hostname.includes('.') && !hostname.includes(':'))
  ) {
    return true;
  }

  if (/^127\./.test(hostname) || hostname === '::1') return true;
  if (/^10\./.test(hostname)) return true;
  if (/^192\.168\./.test(hostname)) return true;
  if (/^169\.254\./.test(hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return true;
  if (/^fc[0-9a-f]{2}:/.test(hostname)) return true;
  if (/^fe[89ab][0-9a-f]:/.test(hostname)) return true;

  return false;
}

function createLangfuseClient(config: RuntimeConfig) {
  if (!config.publicKey || !config.secretKey) {
    throw new Error('Missing LANGFUSE_PUBLIC_KEY or LANGFUSE_SECRET_KEY');
  }

  return new LangfuseAPIClient({
    environment: () => '',
    baseUrl: config.baseUrl,
    username: config.publicKey,
    password: config.secretKey,
    xLangfusePublicKey: config.publicKey,
    xLangfuseSdkName: 'dataviewer',
    xLangfuseSdkVersion: '0.1.0',
  });
}

function encodeName(name: string) {
  return Buffer.from(name, 'utf8').toString('base64url');
}

function decodeName(id: string) {
  return Buffer.from(id, 'base64url').toString('utf8');
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : { value };
}

function toText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value, null, 2);
}

function estimateTokens(value: unknown) {
  const text = typeof value === 'string' ? value : toText(value);
  return Math.max(1, Math.ceil(text.length / 4));
}

function messageKey(message: TrajectoryMessage) {
  return JSON.stringify({
    role: message.role,
    content: message.content,
    reasoning: message.reasoning_content,
    calls: message.tool_calls,
  });
}

function dedupeMessages(messages: TrajectoryMessage[]) {
  const seen = new Set<string>();
  return messages.filter((message) => {
    const key = messageKey(message);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractMessages(value: unknown): TrajectoryMessage[] {
  if (value == null) return [];

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return [{ role: 'user', content: toText(value) }];
  }

  if (Array.isArray(value)) {
    if (value.some((item) => item && typeof item === 'object' && 'role' in item)) {
      return value.flatMap((item) => extractMessages(item));
    }
    return [];
  }

  const record = asRecord(value);
  if (Array.isArray(record.messages)) return extractMessages(record.messages);
  if (Array.isArray(record.input)) return extractMessages(record.input);
  if (record.input != null && typeof record.input !== 'function') return extractMessages(record.input);
  if (Array.isArray(record.output)) return extractMessages(record.output);

  if (record.role && typeof record.role === 'string') {
    const message: TrajectoryMessage = {
      role: record.role as TrajectoryMessage['role'],
      content: toText(record.content ?? record.text ?? record.message),
    };
    if (typeof record.reasoning_content === 'string') message.reasoning_content = record.reasoning_content;
    if (Array.isArray(record.tool_calls)) {
      message.tool_calls = record.tool_calls.map((call, index) => {
        const item = asRecord(call);
        const fn = asRecord(item.function);
        let args = asRecord(item.arguments);
        try {
          if (typeof fn.arguments === 'string') args = JSON.parse(fn.arguments) as Record<string, unknown>;
        } catch {
          args = { raw: fn.arguments };
        }
        return {
          id: typeof item.id === 'string' ? item.id : `call_${index}`,
          name: typeof fn.name === 'string' ? fn.name : typeof item.name === 'string' ? item.name : 'tool',
          arguments: args,
        };
      });
    }
    return [message];
  }

  const choice = asRecord(Array.isArray(record.choices) ? record.choices[0] : undefined);
  const choiceMessage = asRecord(choice.message);
  if (choiceMessage.role) return extractMessages(choiceMessage);

  if (record.answer != null) return [{ role: 'assistant', content: toText(record.answer) }];
  if (record.response != null) return [{ role: 'assistant', content: toText(record.response) }];
  if (record.query != null) return [{ role: 'user', content: toText(record.query) }];
  if (record.prompt != null) return [{ role: 'user', content: toText(record.prompt) }];

  return [];
}

function buildMessages(trace: TraceDetails): TrajectoryMessage[] {
  const traceMessages = [
    ...extractMessages(trace.input),
    ...extractMessages(trace.output),
  ];
  const observations = trace.observations ?? [];
  const generationMessages = observations
    .filter((observation) => observation.type.toUpperCase() === 'GENERATION')
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .flatMap((observation) => [
      ...extractMessages(observation.input),
      ...extractMessages(observation.output),
    ]);

  const toolMessages: TrajectoryMessage[] = observations
    .filter((observation) => observation.type.toUpperCase() !== 'GENERATION' && (observation.input != null || observation.output != null))
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .flatMap((observation) => {
      const assistant: TrajectoryMessage = {
        role: 'assistant',
        content: '',
        tool_calls: [{
          id: observation.id,
          name: observation.name ?? 'tool',
          arguments: asRecord(observation.input),
        }],
      };
      const result = toText(observation.output).trim();
      return result ? [assistant, { role: 'tool', content: result }] : [assistant];
    });

  return dedupeMessages([...traceMessages, ...generationMessages, ...toolMessages]);
}

function messageTokens(message: TrajectoryMessage) {
  return estimateTokens(message.content) + estimateTokens(message.reasoning_content ?? '');
}

function hasObservationLevel(trace: TraceDetails, level: string) {
  return (trace.observations ?? []).some((observation) => String(observation.level).toUpperCase() === level);
}

function buildRecord(trace: TraceDetails, datasetName: string, line: number, baseUrl: string): TrajectoryRecord {
  const messages = buildMessages(trace);
  const userCount = messages.filter((message) => message.role === 'user').length;
  const assistantMessages = messages.filter((message) => message.role === 'assistant');
  const toolCalls = messages.reduce((sum, message) => sum + (message.tool_calls?.length ?? 0), 0);
  const toolResults = messages.filter((message) => message.role === 'tool').length;
  const reasoningSteps = messages.filter((message) => !!message.reasoning_content).length;
  const validSteps = Math.max(1, assistantMessages.length || messages.length);

  const systemTokens = messages
    .filter((message) => message.role === 'system')
    .reduce((sum, message) => sum + messageTokens(message), 0);
  const userTokens = messages
    .filter((message) => message.role === 'user')
    .reduce((sum, message) => sum + messageTokens(message), 0);
  const reasoningTokens = messages.reduce((sum, message) => sum + estimateTokens(message.reasoning_content ?? ''), 0);
  const contentTokens = messages.reduce((sum, message) => sum + estimateTokens(message.content), 0);
  const totalTokens = Math.max(1, systemTokens + userTokens + reasoningTokens + contentTokens);
  const pct = (value: number) => Math.round((value / totalTokens) * 1000) / 10;

  const distribution = assistantMessages.length
    ? assistantMessages.map((message, index) => {
        const first = index === 0;
        return {
          step_index: index + 1,
          reasoning: estimateTokens(message.reasoning_content ?? ''),
          content: estimateTokens(message.content) + (message.tool_calls?.length ?? 0),
          system: first ? systemTokens : undefined,
          user: first ? userTokens : undefined,
        };
      })
    : [{
        step_index: 1,
        reasoning: reasoningTokens,
        content: contentTokens,
        system: systemTokens,
        user: userTokens,
      }];

  const status: TrajectoryRecord['metadata']['status'] =
    hasObservationLevel(trace, 'ERROR') ? 'error'
      : hasObservationLevel(trace, 'WARNING') ? 'warning'
        : 'clean';

  const distinctTools = new Set(
    messages.flatMap((message) => message.tool_calls?.map((call) => call.name) ?? []),
  ).size;

  return {
    id: trace.id,
    metadata: {
      analyzer_version: 'langfuse@5.11.1',
      backend: new URL(baseUrl).host,
      dataset_name: datasetName,
      line_number: line,
      file_size_kb: Math.round((toText(trace.input).length + toText(trace.output).length) / 1024 * 10) / 10,
      status,
    },
    metrics: {
      turns: userCount,
      valid_steps: validSteps,
      reasoning_steps: reasoningSteps,
      reasoning_steps_pct: Math.round((reasoningSteps / validSteps) * 1000) / 10,
      rounds: userCount,
      messages: messages.length,
      tool_calls: toolCalls,
      tool_results: toolResults,
      distinct_tools: distinctTools,
      train_tokens: reasoningTokens + contentTokens,
      analysis_tokens: systemTokens + userTokens,
      trained_pct: pct(reasoningTokens + contentTokens),
      tok_per_step_avg: Math.round(totalTokens / validSteps),
      row_size_kb: Math.round(estimateTokens(trace) * 0.75 * 10) / 10,
    },
    token_composition: {
      system: { count: systemTokens, pct: pct(systemTokens) },
      user: { count: userTokens, pct: pct(userTokens) },
      reasoning: { count: reasoningTokens, pct: pct(reasoningTokens) },
      content: { count: contentTokens, pct: pct(contentTokens) },
    },
    distribution,
    messages,
  };
}

function buildRowPreview(trace: TraceWithDetails): RowPreview {
  const candidates = [...extractMessages(trace.input), ...extractMessages(trace.output)];
  const firstUser = candidates.find((message) => message.role === 'user');
  const snippet = firstUser?.content || toText(trace.input) || toText(trace.output);
  const metadata = asRecord(trace.metadata);
  const metadataStatus = String(metadata.status ?? '').toLowerCase();

  return {
    line: 1,
    tokens: estimateTokens(trace.input) + estimateTokens(trace.output),
    snippet: snippet.slice(0, 240),
    hasError: metadataStatus === 'error',
    hasWarning: metadataStatus === 'warning',
  };
}

function relativeTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

async function fetchSnapshot(config: RuntimeConfig): Promise<LangfuseSnapshot> {
  const client = createLangfuseClient(config);
  const traces: TraceWithDetails[] = [];
  const pageSize = 100;
  let page = 1;

  while (traces.length < config.maxTraces) {
    const response = await client.trace.list({
      page,
      limit: pageSize,
      fields: 'core,io',
      orderBy: 'timestamp.desc',
      tags: config.traceTag ? [config.traceTag] : undefined,
    });
    traces.push(...response.data);
    if (!response.data.length || page >= response.meta.totalPages) break;
    page += 1;
  }

  const groups = new Map<string, TraceWithDetails[]>();
  for (const trace of traces) {
    const name = trace.name ?? 'Unnamed traces';
    const group = groups.get(name) ?? [];
    group.push(trace);
    groups.set(name, group);
  }

  return {
    traces,
    groups,
    fetchedAt: Date.now(),
  };
}

async function getSnapshot(config: RuntimeConfig): Promise<LangfuseSnapshot> {
  if (snapshot && Date.now() - snapshot.fetchedAt < CACHE_TTL_MS) return snapshot;
  snapshotPromise ??= fetchSnapshot(config).then((next) => {
    snapshot = next;
    return next;
  }).finally(() => {
    snapshotPromise = null;
  });
  return snapshotPromise;
}

async function fetchObservations(client: LangfuseAPIClient, traceId: string): Promise<TraceObservation[]> {
  const observations: TraceObservation[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const response = await client.legacy.observationsV1.getMany({
      traceId,
      page,
      limit: 100,
    });
    observations.push(...response.data);
    page += 1;
    totalPages = response.meta.totalPages;
  } while (page <= totalPages);

  return observations;
}

async function getFiles(config: RuntimeConfig): Promise<DataFile[]> {
  if (config.source === 'mock') return MOCK_FILES;

  const { groups } = await getSnapshot(config);
  return [...groups.entries()].map(([name, traces]) => {
    const sizeBytes = traces.reduce(
      (sum, trace) => sum + toText(trace.input).length + toText(trace.output).length,
      0,
    );
    return {
      id: encodeName(name),
      name,
      size: `${(sizeBytes / 1024 / 1024).toFixed(2)} MB`,
      modified: relativeTime(traces[0].timestamp),
      lines: traces.length,
      errors: traces.filter((trace) => String(asRecord(trace.metadata).status).toLowerCase() === 'error').length,
      warnings: traces.filter((trace) => String(asRecord(trace.metadata).status).toLowerCase() === 'warning').length,
    };
  });
}

async function getRows(config: RuntimeConfig, fileId: string): Promise<RowPreview[]> {
  if (config.source === 'mock') {
    const file = MOCK_FILES.find((item) => item.id === fileId);
    if (!file) return [];
    const seed = MOCK_SEEDS[fileId] ?? 7;
    return Array.from({ length: file.lines }, (_, index) => makeRowPreview(index + 1, seed));
  }

  const name = decodeName(fileId);
  const { groups } = await getSnapshot(config);
  return (groups.get(name) ?? []).map((trace, index) => ({ ...buildRowPreview(trace), line: index + 1 }));
}

async function getRecord(config: RuntimeConfig, fileId: string, line: number): Promise<TrajectoryRecord | null> {
  if (config.source === 'mock') {
    return makeRecord(line, MOCK_SEEDS[fileId] ?? 7);
  }

  const name = decodeName(fileId);
  const { groups } = await getSnapshot(config);
  const trace = (groups.get(name) ?? [])[line - 1];
  if (!trace) return null;

  const client = createLangfuseClient(config);
  const fullTrace: TraceDetails = {
    id: trace.id,
    input: trace.input,
    output: trace.output,
    observations: await fetchObservations(client, trace.id),
  };
  return buildRecord(fullTrace, name, line, config.baseUrl);
}

function sendJson(res: import('http').ServerResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

export function createDataApiMiddleware(env: Record<string, string | undefined>) {
  const config = getConfig(env);

  return async (req: import('http').IncomingMessage, res: import('http').ServerResponse, next: () => void) => {
    const path = (req.url ?? '').split('?')[0];

    try {
      if (path === '/config') {
        sendJson(res, 200, {
          source: config.source,
          baseUrl: config.source === 'langfuse' ? config.baseUrl : undefined,
          configured: config.source === 'mock' || (!!config.publicKey && !!config.secretKey),
        });
        return;
      }
      if (path === '/files') {
        sendJson(res, 200, { source: config.source, files: await getFiles(config) });
        return;
      }
      if (path === '/rows') {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const fileId = url.searchParams.get('fileId');
        if (!fileId) {
          sendJson(res, 400, { error: 'fileId is required' });
          return;
        }
        sendJson(res, 200, { source: config.source, rows: await getRows(config, fileId) });
        return;
      }
      if (path === '/record') {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const fileId = url.searchParams.get('fileId');
        const line = Number(url.searchParams.get('line'));
        if (!fileId || !Number.isInteger(line) || line < 1) {
          sendJson(res, 400, { error: 'fileId and a positive line are required' });
          return;
        }
        sendJson(res, 200, { source: config.source, record: await getRecord(config, fileId, line) });
        return;
      }
    } catch (error) {
      sendJson(res, error instanceof Error && error.message.startsWith('Missing LANGFUSE') ? 503 : 502, {
        source: config.source,
        error: error instanceof Error ? error.message : 'Langfuse request failed',
      });
      return;
    }

    next();
  };
}
