import clsx from 'clsx';
import { Wrench, User, Bot, MonitorCog } from 'lucide-react';
import { useViewer, useActiveRecord } from '../store';

const ROLE_STYLE: Record<string, { badge: string; icon: React.ReactNode; label: string }> = {
  system: { badge: 'bg-rose-100 text-rose-700 ring-rose-200', icon: <MonitorCog size={11} />, label: 'system' },
  user: { badge: 'bg-blue-100 text-blue-700 ring-blue-200', icon: <User size={11} />, label: 'user' },
  assistant: { badge: 'bg-amber-100 text-amber-700 ring-amber-200', icon: <Bot size={11} />, label: 'assistant' },
  tool: { badge: 'bg-slate-200 text-slate-700 ring-slate-300', icon: <Wrench size={11} />, label: 'tool' },
};

export default function ConversationView() {
  const rec = useActiveRecord();
  const showSteps = useViewer((s) => s.showSteps);

  if (!rec) {
    return <div className="p-2 text-2xs text-slate-400">Loading messages...</div>;
  }

  return (
    <div className="flex flex-col gap-2">
      {rec.messages.map((msg, i) => {
        const style = ROLE_STYLE[msg.role];
        return (
          <div key={i} className="rounded-sm border border-slate-200">
            <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-2 py-1">
              <span className={clsx('flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-2xs font-medium ring-1', style.badge)}>
                {style.icon} {style.label}
              </span>
              <span className="mono text-2xs text-slate-400">#{i + 1}</span>
            </div>
            <div className="px-2 py-1.5">
              {msg.reasoning_content && showSteps && (
                <div className="mb-1.5 rounded-sm border-l-2 border-emerald-400 bg-emerald-50/60 px-2 py-1">
                  <div className="text-2xs font-medium text-emerald-700">reasoning</div>
                  <div className="mt-0.5 text-2xs leading-relaxed text-slate-600">{msg.reasoning_content}</div>
                </div>
              )}
              {msg.tool_calls?.length && showSteps && (
                <div className="mb-1.5 rounded-sm border border-sky-200 bg-sky-50/60 px-2 py-1">
                  <div className="text-2xs font-medium text-sky-700">tool_calls</div>
                  {msg.tool_calls.map((tc) => (
                    <div key={tc.id} className="mono mt-0.5 text-2xs text-slate-600">
                      <span className="rounded-sm bg-sky-100 px-1 text-sky-700">{tc.name}</span>({JSON.stringify(tc.arguments)})
                    </div>
                  ))}
                </div>
              )}
              {msg.content && (
                <div className="text-xs leading-relaxed text-slate-700">{msg.content}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
