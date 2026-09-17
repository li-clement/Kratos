import {
  ArrowDownUp,
  FileJson,
  Grid2x2,
  LayoutList,
  MoreHorizontal,
  PenLine,
  Pencil,
  RefreshCw,
  Search,
  Star,
  Tag,
  Download,
  Layers,
  Columns2,
  CheckCircle2,
} from 'lucide-react';
import clsx from 'clsx';
import { useViewer, useActiveFile } from '../store';

const crumbs = ['/data', 'w00978252', 'QA语料分类归档', 'D8_工程_调试_验证'];

export default function FilePanel() {
  const files = useViewer((s) => s.files);
  const activeFileId = useViewer((s) => s.activeFileId);
  const setActiveFile = useViewer((s) => s.setActiveFile);
  const filesLoading = useViewer((s) => s.filesLoading);
  const filesError = useViewer((s) => s.filesError);
  const refresh = useViewer((s) => s.refresh);
  const starred = useViewer((s) => s.starred);
  const toggleStar = useViewer((s) => s.toggleStar);
  const active = useActiveFile();

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-slate-300 bg-slate-50">
      {/* 面包屑 + 模式切换 */}
      <div className="flex items-center justify-between border-b border-slate-200 px-2 py-1.5">
        <div className="mono flex min-w-0 items-center gap-0.5 text-2xs text-slate-500">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-0.5">
              {i > 0 && <span className="text-slate-400">/</span>}
              <span className={clsx('truncate', i === crumbs.length - 1 && 'font-medium text-slate-700')}>{c}</span>
            </span>
          ))}
        </div>
        <div className="ml-2 flex shrink-0 items-center gap-0.5 text-2xs">
          <button className="rounded-sm bg-white px-1 py-0.5 font-medium text-slate-700 ring-1 ring-slate-300">Full</button>
          <button className="rounded-sm px-1 py-0.5 text-slate-500 hover:bg-slate-200">Name</button>
        </div>
      </div>

      {/* 操作行 1 */}
      <div className="flex items-center gap-1 border-b border-slate-200 px-2 py-1.5 text-2xs">
        <button className="flex items-center gap-1 rounded-sm bg-white px-1.5 py-0.5 font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100">
          <CheckCircle2 size={11} className="text-emerald-600" /> Select
        </button>
        <button
          onClick={() => void refresh()}
          className="flex items-center gap-1 rounded-sm bg-white px-1.5 py-0.5 text-slate-600 ring-1 ring-slate-300 hover:bg-slate-100"
        >
          <RefreshCw size={11} /> Refresh
        </button>
        <button className="flex items-center gap-1 rounded-sm bg-white px-1.5 py-0.5 text-slate-600 ring-1 ring-slate-300 hover:bg-slate-100">
          <Pencil size={11} /> New
        </button>
        <button className="flex items-center gap-1 rounded-sm bg-white px-1.5 py-0.5 text-slate-600 ring-1 ring-slate-300 hover:bg-slate-100">
          <Layers size={11} /> S3
        </button>
        <button className="flex items-center gap-1 rounded-sm bg-amber-50 px-1.5 py-0.5 font-medium text-amber-700 ring-1 ring-amber-300 hover:bg-amber-100">
          <Search size={11} /> Validation
        </button>
      </div>

      {/* 操作行 2：过滤 + 视图控制 */}
      <div className="flex items-center gap-1 border-b border-slate-200 px-2 py-1.5 text-2xs">
        {['I/O', 'Tools', 'Analysis'].map((f) => (
          <button
            key={f}
            className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-slate-600 hover:border-slate-400 hover:text-slate-800"
          >
            {f}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-0.5">
          <button className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-slate-600 hover:bg-slate-200" title="Dual 对比">
            <Columns2 size={11} /> Dual
          </button>
          <button className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-slate-600 hover:bg-slate-200">
            <ArrowDownUp size={11} /> Modified
          </button>
          <button className="rounded-sm p-1 text-slate-600 hover:bg-slate-200" title="List view">
            <LayoutList size={12} />
          </button>
          <button className="rounded-sm p-1 text-slate-400 hover:bg-slate-200" title="Grid view">
            <Grid2x2 size={12} />
          </button>
        </div>
      </div>

      {/* 文件列表 */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {filesError && (
          <div className="m-2 rounded-sm border border-rose-200 bg-rose-50 p-2 text-2xs leading-relaxed text-rose-700">
            <div className="font-medium">Langfuse unavailable</div>
            <div className="mt-0.5 break-words">{filesError}</div>
          </div>
        )}
        {!filesError && filesLoading && (
          <div className="px-2 py-2 text-2xs text-slate-400">Loading datasets...</div>
        )}
        {!filesError && !filesLoading && files.length === 0 && (
          <div className="px-2 py-2 text-2xs text-slate-400">No Langfuse traces found.</div>
        )}
        {files.map((f) => {
          const isActive = f.id === activeFileId;
          return (
            <div
              key={f.id}
              onClick={() => setActiveFile(f.id)}
              className={clsx(
                'group cursor-pointer border-b border-slate-200 px-2 py-1.5',
                isActive ? 'bg-sky-50 ring-1 ring-inset ring-sky-300' : 'hover:bg-slate-100',
              )}
            >
              <div className="flex items-center gap-1.5">
                <FileJson size={14} className={clsx(isActive ? 'text-sky-600' : 'text-amber-500')} />
                <span className={clsx('truncate text-xs', isActive ? 'font-medium text-sky-800' : 'text-slate-700')}>
                  {f.name}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleStar(f.id);
                  }}
                  className={clsx('ml-auto shrink-0', starred[f.id] ? 'text-amber-400' : 'text-slate-300 opacity-0 group-hover:opacity-100')}
                  title="Star"
                >
                  <Star size={12} fill={starred[f.id] ? 'currentColor' : 'none'} />
                </button>
              </div>
              <div className="mt-0.5 flex items-center gap-2 pl-5 text-2xs text-slate-400">
                <span className="mono">{f.size}</span>
                <span>{f.modified}</span>
                <span className="mono">{f.lines.toLocaleString()} ln</span>
                {f.errors > 0 && (
                  <span className="rounded-sm bg-rose-100 px-1 font-medium text-rose-600">{f.errors} err</span>
                )}
                {f.warnings > 0 && (
                  <span className="rounded-sm bg-amber-100 px-1 font-medium text-amber-600">{f.warnings} warn</span>
                )}
                <span className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100">
                  <Tag size={11} className="cursor-pointer text-slate-400 hover:text-sky-500" />
                  <PenLine size={11} className="cursor-pointer text-slate-400 hover:text-sky-500" />
                  <Download size={11} className="cursor-pointer text-slate-400 hover:text-sky-500" />
                  <MoreHorizontal size={11} className="cursor-pointer text-slate-400 hover:text-sky-500" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 底部状态 */}
      <div className="flex items-center justify-between border-t border-slate-200 bg-white px-2 py-1 text-2xs text-slate-400">
        <span>{files.length} datasets</span>
        <span className="mono">{active?.name ?? '—'}</span>
      </div>
    </aside>
  );
}
