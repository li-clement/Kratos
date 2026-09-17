import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import clsx from 'clsx';
import { Flag, Copy, Lightbulb, ClipboardCheck, RefreshCw, Maximize2, X, CheckCircle2 } from 'lucide-react';
import { useViewer, useActiveRecord } from '../store';
import type { ViewTab } from '../types';
import ConversationView from './ConversationView';
import TrajectoryView from './TrajectoryView';

const TABS: { id: ViewTab; label: string }[] = [
  { id: 'scan', label: 'Data Scan' },
  { id: 'conversation', label: 'Conversation' },
  { id: 'markdown', label: 'Markdown' },
  { id: 'raw', label: 'Raw JSON' },
  { id: 'trajectory', label: 'Trajectory' },
];

function MetricCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-sm border border-slate-200 bg-white px-2 py-1.5">
      <div className="text-2xs text-slate-400">{label}</div>
      <div className={clsx('mono mt-0.5 text-sm font-semibold', accent ?? 'text-slate-700')}>{value}</div>
    </div>
  );
}

export default function InspectorPanel() {
  const viewTab = useViewer((s) => s.viewTab);
  const setViewTab = useViewer((s) => s.setViewTab);
  const showSteps = useViewer((s) => s.showSteps);
  const toggleSteps = useViewer((s) => s.toggleSteps);
  const showAllRoles = useViewer((s) => s.showAllRoles);
  const toggleAllRoles = useViewer((s) => s.toggleAllRoles);
  const rec = useActiveRecord();
  const recordLoading = useViewer((s) => s.recordLoading);
  const recordError = useViewer((s) => s.recordError);
  const reloadRecord = useViewer((s) => s.reloadRecord);

  if (!rec) {
    return (
      <section className="flex min-w-0 flex-1 flex-col bg-white">
        <div className="flex min-h-0 flex-1 items-center justify-center text-2xs text-slate-400">
          {recordError ? recordError : recordLoading ? 'Loading trajectory...' : 'Select a row'}
        </div>
      </section>
    );
  }

  const m = rec.metrics;
  const tc = rec.token_composition;

  const copyId = () => navigator.clipboard?.writeText(rec.id);

  const compData = [
    { key: 'system', label: 'system', count: tc.system.count, pct: tc.system.pct, color: '#f43f5e' },
    { key: 'user', label: 'user', count: tc.user.count, pct: tc.user.pct, color: '#3b82f6' },
    { key: 'reasoning', label: 'reasoning', count: tc.reasoning.count, pct: tc.reasoning.pct, color: '#48bb78' },
    { key: 'content', label: 'content', count: tc.content.count, pct: tc.content.pct, color: '#ed8936' },
  ];

  const distData = showAllRoles
    ? rec.distribution.map((d) => ({
        step: `S${d.step_index}`,
        reasoning: d.reasoning,
        content: d.content,
        system: d.system ?? 0,
        user: d.user ?? 0,
      }))
    : rec.distribution.map((d) => ({ step: `S${d.step_index}`, reasoning: d.reasoning, content: d.content }));

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-white">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between border-b border-slate-300 bg-slate-100 px-2 py-1">
        <div className="flex items-center gap-0.5 text-xs">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setViewTab(t.id)}
              className={clsx(
                'rounded-sm px-2 py-0.5',
                viewTab === t.id ? 'bg-white font-medium text-slate-800 shadow-sm ring-1 ring-slate-300' : 'text-slate-500 hover:bg-slate-200',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-0.5">
          <button className="flex items-center gap-1 rounded-sm bg-emerald-50 px-1.5 py-0.5 text-2xs font-medium text-emerald-700 ring-1 ring-emerald-300 hover:bg-emerald-100">
            <ClipboardCheck size={11} /> Review
          </button>
          <button className="flex items-center gap-1 rounded-sm bg-rose-50 px-1.5 py-0.5 text-2xs font-medium text-rose-600 ring-1 ring-rose-300 hover:bg-rose-100">
            <Flag size={11} /> Flag
          </button>
          <button className="flex items-center gap-1 rounded-sm bg-white px-1.5 py-0.5 text-2xs text-slate-600 ring-1 ring-slate-300 hover:bg-slate-100">
            <Lightbulb size={11} /> Suggest
          </button>
          <button onClick={copyId} className="rounded-sm bg-white p-1 text-slate-500 ring-1 ring-slate-300 hover:bg-slate-100" title="Copy ID">
            <Copy size={11} />
          </button>
          <button className="rounded-sm p-1 text-slate-500 hover:bg-slate-200" title="Fullscreen">
            <Maximize2 size={12} />
          </button>
          <button className="rounded-sm p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-500" title="Close">
            <X size={12} />
          </button>
        </div>
      </div>

      {/* 元数据子头 */}
      <div className="flex items-center gap-2 border-b border-slate-200 px-2 py-1 text-2xs text-slate-500">
        <span className="mono rounded-sm bg-slate-100 px-1.5 py-0.5">analyzer: {rec.metadata.analyzer_version}</span>
        <span className="mono rounded-sm bg-slate-100 px-1.5 py-0.5">backend: {rec.metadata.backend}</span>
        <span className="mono rounded-sm bg-slate-100 px-1.5 py-0.5">id: {rec.id}</span>
        <button
          onClick={() => void reloadRecord()}
          className="flex items-center gap-0.5 rounded-sm border border-slate-300 bg-white px-1.5 py-0.5 hover:bg-slate-100"
        >
          <RefreshCw size={10} /> Refresh
        </button>
        <label className="ml-auto flex cursor-pointer items-center gap-1 select-none">
          <span>Steps</span>
          <button
            onClick={toggleSteps}
            className={clsx(
              'relative h-3.5 w-7 rounded-full transition-colors',
              showSteps ? 'bg-emerald-500' : 'bg-slate-300',
            )}
          >
            <span
              className={clsx(
                'absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white transition-all',
                showSteps ? 'left-4' : 'left-0.5',
              )}
            />
          </button>
        </label>
      </div>

      {/* 内容区 */}
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {viewTab === 'scan' && (
          <div className="flex flex-col gap-2">
            {/* 指标卡矩阵 */}
            <div className="grid grid-cols-4 gap-1.5 lg:grid-cols-7">
              <MetricCard label="turns" value={String(m.turns)} />
              <MetricCard label="valid steps" value={String(m.valid_steps)} />
              <MetricCard label="reasoning steps" value={`${m.reasoning_steps} (${m.reasoning_steps_pct}%)`} accent="text-emerald-600" />
              <MetricCard label="rounds" value={String(m.rounds)} />
              <MetricCard label="messages" value={String(m.messages)} />
              <MetricCard label="tool calls" value={String(m.tool_calls)} accent="text-sky-600" />
              <MetricCard label="tool results" value={String(m.tool_results)} accent="text-sky-600" />
              <MetricCard label="distinct tools" value={String(m.distinct_tools)} />
              <MetricCard label="train tokens" value={m.train_tokens.toLocaleString()} />
              <MetricCard label="analysis tokens" value={m.analysis_tokens.toLocaleString()} />
              <MetricCard label="trained %" value={`${m.trained_pct}%`} accent="text-amber-600" />
              <MetricCard label="tok/step avg" value={String(m.tok_per_step_avg)} />
              <MetricCard label="row size" value={`${m.row_size_kb} KB`} />
            </div>

            {/* 质检状态 */}
            <div className="flex items-center gap-2">
              {rec.metadata.status === 'clean' ? (
                <span className="flex items-center gap-1 rounded-sm bg-emerald-50 px-2 py-0.5 text-2xs font-medium text-emerald-700 ring-1 ring-emerald-300">
                  <CheckCircle2 size={11} /> checks clean
                </span>
              ) : rec.metadata.status === 'warning' ? (
                <span className="flex items-center gap-1 rounded-sm bg-amber-50 px-2 py-0.5 text-2xs font-medium text-amber-700 ring-1 ring-amber-300">
                  <CheckCircle2 size={11} /> 1 check warning
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded-sm bg-rose-50 px-2 py-0.5 text-2xs font-medium text-rose-600 ring-1 ring-rose-300">
                  <CheckCircle2 size={11} /> checks failed
                </span>
              )}
              <span className="mono text-2xs text-slate-400">
                line #{rec.metadata.line_number} · {rec.metadata.dataset_name}
              </span>
            </div>

            {/* Token 组成条 */}
            <div className="rounded-sm border border-slate-200 p-2">
              <div className="mb-1.5 text-2xs font-medium text-slate-600">Token Composition</div>
              <div className="flex h-4 w-full overflow-hidden rounded-sm border border-slate-300">
                {compData.map((c) => (
                  <div key={c.key} style={{ width: `${c.pct}%`, background: c.color }} className="group relative" />
                ))}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                {compData.map((c) => (
                  <span key={c.key} className="flex items-center gap-1 text-2xs text-slate-500">
                    <span className="h-2 w-2 rounded-sm" style={{ background: c.color }} />
                    {c.label} <span className="mono text-slate-700">{c.count.toLocaleString()}</span>
                    <span className="mono text-slate-400">({c.pct}%)</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Token 分布柱状图 */}
            <div className="rounded-sm border border-slate-200 p-2">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-2xs font-medium text-slate-600">Token Distribution</span>
                <button
                  onClick={toggleAllRoles}
                  className={clsx(
                    'flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-2xs ring-1',
                    showAllRoles ? 'bg-sky-50 text-sky-700 ring-sky-300' : 'bg-white text-slate-500 ring-slate-300 hover:bg-slate-100',
                  )}
                >
                  show all roles
                </button>
              </div>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={distData} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                    <CartesianGrid strokeDasharray="2 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="step" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: 'rgba(148,163,184,0.15)' }}
                      contentStyle={{ fontSize: 10, borderRadius: 4, borderColor: '#cbd5e1' }}
                    />
                    <Bar dataKey="reasoning" stackId="t" fill="#48bb78" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="content" stackId="t" fill="#ed8936" />
                    {showAllRoles && <Bar dataKey="system" stackId="t" fill="#f43f5e" />}
                    {showAllRoles && <Bar dataKey="user" stackId="t" fill="#3b82f6" />}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {viewTab === 'conversation' && <ConversationView />}
        {viewTab === 'trajectory' && <TrajectoryView />}
        {viewTab === 'markdown' && (
          <pre className="mono whitespace-pre-wrap rounded-sm border border-slate-200 bg-slate-50 p-2 text-2xs leading-relaxed text-slate-700">
            {rec.messages
              .map((msg) => {
                if (msg.role === 'system') return `> **[system]** ${msg.content}`;
                if (msg.role === 'user') return `## 👤 User\n\n${msg.content}`;
                if (msg.role === 'tool') return `> 🔧 tool result: ${msg.content}`;
                const parts: string[] = [];
                if (msg.reasoning_content) parts.push(`### 🧠 Reasoning\n\n${msg.reasoning_content}`);
                if (msg.tool_calls?.length)
                  parts.push(
                    `### 🔧 Tool Calls\n\n${msg.tool_calls.map((t) => `- \`${t.name}\`(${JSON.stringify(t.arguments)})`).join('\n')}`,
                  );
                if (msg.content) parts.push(`## 🤖 Assistant\n\n${msg.content}`);
                return parts.join('\n\n');
              })
              .join('\n\n---\n\n')}
          </pre>
        )}
        {viewTab === 'raw' && (
          <pre className="mono max-h-full overflow-auto whitespace-pre rounded-sm border border-slate-200 bg-slate-50 p-2 text-2xs leading-relaxed text-slate-700">
            {JSON.stringify(rec, null, 2)}
          </pre>
        )}
      </div>
    </section>
  );
}
