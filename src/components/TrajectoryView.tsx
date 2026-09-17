import { useViewer, useActiveRecord } from '../store';
import { Wrench, BrainCircuit, MessageSquare, ArrowRight } from 'lucide-react';

export default function TrajectoryView() {
  const rec = useActiveRecord();
  const showSteps = useViewer((s) => s.showSteps);

  if (!rec) {
    return <div className="p-2 text-2xs text-slate-400">Loading trajectory...</div>;
  }

  const nodes: { kind: 'msg' | 'reasoning' | 'tool'; label: string; detail: string }[] = [];
  rec.messages.forEach((m) => {
    if (m.role === 'user') nodes.push({ kind: 'msg', label: 'user', detail: m.content });
    else if (m.role === 'system') nodes.push({ kind: 'msg', label: 'system', detail: m.content });
    else if (m.role === 'tool') nodes.push({ kind: 'tool', label: 'tool result', detail: m.content });
    else {
      if (m.reasoning_content && showSteps)
        nodes.push({ kind: 'reasoning', label: 'reasoning', detail: m.reasoning_content });
      m.tool_calls?.forEach((tc) =>
        nodes.push({ kind: 'tool', label: tc.name, detail: JSON.stringify(tc.arguments) }),
      );
      if (m.content) nodes.push({ kind: 'msg', label: 'assistant', detail: m.content });
    }
  });

  return (
    <div className="flex flex-col items-stretch gap-0">
      {nodes.map((n, i) => (
        <div key={i} className="flex flex-col items-center">
          <div
            className={
              n.kind === 'reasoning'
                ? 'flex w-full items-start gap-2 rounded-sm border border-emerald-200 bg-emerald-50/60 px-2 py-1.5'
                : n.kind === 'tool'
                  ? 'flex w-full items-start gap-2 rounded-sm border border-sky-200 bg-sky-50/60 px-2 py-1.5'
                  : 'flex w-full items-start gap-2 rounded-sm border border-slate-200 bg-white px-2 py-1.5'
            }
          >
            <span
              className={
                n.kind === 'reasoning'
                  ? 'mt-0.5 text-emerald-600'
                  : n.kind === 'tool'
                    ? 'mt-0.5 text-sky-600'
                    : 'mt-0.5 text-slate-500'
              }
            >
              {n.kind === 'reasoning' ? <BrainCircuit size={13} /> : n.kind === 'tool' ? <Wrench size={13} /> : <MessageSquare size={13} />}
            </span>
            <div className="min-w-0">
              <div
                className={
                  n.kind === 'reasoning'
                    ? 'text-2xs font-medium text-emerald-700'
                    : n.kind === 'tool'
                      ? 'mono text-2xs font-medium text-sky-700'
                      : 'text-2xs font-medium text-slate-600'
                }
              >
                {n.label}
              </div>
              <div className="mt-0.5 line-clamp-2 text-2xs leading-relaxed text-slate-600">{n.detail}</div>
            </div>
          </div>
          {i < nodes.length - 1 && (
            <div className="flex h-3 items-center text-slate-300">
              <ArrowRight size={10} className="rotate-90" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
