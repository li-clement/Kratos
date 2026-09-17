import { useEffect, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { AlertTriangle, ChevronLeft, ChevronRight, CircleAlert, Regex, Highlighter, Search } from 'lucide-react';
import clsx from 'clsx';
import { useViewer, useActiveFile, useFilteredRows } from '../store';

function fmtTokens(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k tt` : `${n} tt`;
}

export default function RowListPanel() {
  const file = useActiveFile();
  const rows = useFilteredRows();
  const activeLine = useViewer((s) => s.activeLine);
  const setActiveLine = useViewer((s) => s.setActiveLine);
  const rowsLoading = useViewer((s) => s.rowsLoading);
  const rowsError = useViewer((s) => s.rowsError);
  const query = useViewer((s) => s.query);
  const setQuery = useViewer((s) => s.setQuery);
  const useRegex = useViewer((s) => s.useRegex);
  const setUseRegex = useViewer((s) => s.setUseRegex);
  const highlight = useViewer((s) => s.highlight);
  const setHighlight = useViewer((s) => s.setHighlight);
  const page = useViewer((s) => s.page);
  const setPage = useViewer((s) => s.setPage);
  const pageSize = useViewer((s) => s.pageSize);
  const setPageSize = useViewer((s) => s.setPageSize);

  const parentRef = useRef<HTMLDivElement>(null);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageItems = useMemo(() => rows.slice((page - 1) * pageSize, page * pageSize), [rows, page, pageSize]);
  const virtualizer = useVirtualizer({
    count: pageItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 28,
    overscan: 10,
  });

  useEffect(() => {
    parentRef.current?.scrollTo({ top: 0 });
  }, [page, pageSize, rows.length]);

  const pageNums = useMemo(() => {
    const nums: (number | string)[] = [];
    const push = (n: number | string) => nums.push(n);
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) push(i);
    } else {
      push(1);
      if (page > 3) push('…');
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) push(i);
      if (page < totalPages - 2) push('…');
      push(totalPages);
    }
    return nums;
  }, [page, totalPages]);

  const renderSnippet = (snippet: string) => {
    if (!highlight || !query) return snippet;
    let re: RegExp | null = null;
    try {
      re = useRegex ? new RegExp(query, 'gi') : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    } catch {
      return snippet;
    }
    const parts = snippet.split(re);
    const matches = snippet.match(re);
    if (!matches) return snippet;
    return (
      <>
        {parts.map((p, i) => (
          <span key={i}>
            {p}
            {i < matches.length && <mark className="rounded-sm bg-amber-200 px-0.5">{matches[i]}</mark>}
          </span>
        ))}
      </>
    );
  };

  const jumpToPage = () => {
    const v = window.prompt('Go to page:');
    const n = Number(v);
    if (Number.isFinite(n) && n >= 1 && n <= totalPages) setPage(Math.floor(n));
  };

  return (
    <section className="flex w-80 shrink-0 flex-col border-r border-slate-300 bg-white">
      {/* 文件元信息 */}
      <div className="flex items-center justify-between border-b border-slate-200 px-2 py-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-xs font-medium text-slate-700">{file?.name ?? '—'}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1 text-2xs">
          {file && (
            <span className="mono rounded-sm bg-slate-100 px-1 py-0.5 text-slate-600">{file.lines.toLocaleString()} lines</span>
          )}
          {!!file?.errors && (
            <span className="flex items-center gap-0.5 rounded-sm bg-rose-100 px-1 py-0.5 font-medium text-rose-600">
              <CircleAlert size={10} /> {file.errors}
            </span>
          )}
          {!!file?.warnings && (
            <span className="flex items-center gap-0.5 rounded-sm bg-amber-100 px-1 py-0.5 font-medium text-amber-600">
              <AlertTriangle size={10} /> {file.warnings}
            </span>
          )}
        </div>
      </div>

      {/* 工具栏 */}
      <div className="flex items-center gap-1 border-b border-slate-200 px-2 py-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-1 rounded-sm border border-slate-300 bg-slate-50 px-1.5 py-0.5">
          <Search size={11} className="shrink-0 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter rows..."
            className="mono w-full bg-transparent text-2xs text-slate-700 outline-none placeholder:text-slate-400"
          />
        </div>
        <button
          onClick={() => setUseRegex(!useRegex)}
          className={clsx(
            'flex items-center gap-0.5 rounded-sm px-1.5 py-0.5 text-2xs ring-1',
            useRegex ? 'bg-sky-50 text-sky-700 ring-sky-300' : 'bg-white text-slate-500 ring-slate-300 hover:bg-slate-100',
          )}
          title="Regex"
        >
          <Regex size={11} /> .*
        </button>
        <button
          onClick={() => setHighlight(!highlight)}
          className={clsx(
            'flex items-center gap-0.5 rounded-sm px-1.5 py-0.5 text-2xs ring-1',
            highlight ? 'bg-sky-50 text-sky-700 ring-sky-300' : 'bg-white text-slate-500 ring-slate-300 hover:bg-slate-100',
          )}
          title="Highlight"
        >
          <Highlighter size={11} />
        </button>
      </div>

      {/* 列头 */}
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-2 py-1 text-2xs font-medium text-slate-500">
        <span className="w-10 text-right">#</span>
        <span className="w-14 text-right">tokens</span>
        <span className="flex-1">content preview</span>
      </div>

      {/* 虚拟滚动行列表 */}
      <div ref={parentRef} className="min-h-0 flex-1 overflow-y-auto">
        {rowsError && (
          <div className="m-2 rounded-sm border border-rose-200 bg-rose-50 p-2 text-2xs leading-relaxed text-rose-700">
            {rowsError}
          </div>
        )}
        {!rowsError && rowsLoading && (
          <div className="px-2 py-2 text-2xs text-slate-400">Loading rows...</div>
        )}
        {!rowsError && !rowsLoading && rows.length === 0 && (
          <div className="px-2 py-2 text-2xs text-slate-400">No rows available.</div>
        )}
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((vi) => {
            const row = pageItems[vi.index];
            const isActive = row.line === activeLine;
            return (
              <div
                key={vi.key}
                onClick={() => setActiveLine(row.line)}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vi.start}px)`, height: vi.size }}
                className={clsx(
                  'flex cursor-pointer items-center gap-2 border-b border-slate-100 px-2 text-2xs hover:bg-slate-50',
                  isActive && 'bg-sky-50 ring-1 ring-inset ring-sky-300',
                )}
              >
                <span className={clsx('mono w-10 shrink-0 text-right', isActive ? 'text-sky-700' : 'text-slate-400')}>
                  #{row.line}
                </span>
                <span
                  className={clsx(
                    'mono w-14 shrink-0 rounded-sm px-1 text-right',
                    row.hasError
                      ? 'bg-rose-100 text-rose-600'
                      : row.hasWarning
                        ? 'bg-amber-100 text-amber-600'
                        : 'bg-slate-100 text-slate-500',
                  )}
                >
                  {fmtTokens(row.tokens)}
                </span>
                <span className="truncate text-slate-600">{renderSnippet(row.snippet)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 分页栏 */}
      <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-2 py-1.5 text-2xs text-slate-500">
        <span className="mono">
          {rows.length === 0
            ? `0 of 0 lines`
            : `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, rows.length)} of ${rows.length.toLocaleString()} lines`}
        </span>
        <div className="flex items-center gap-0.5">
          <button onClick={() => setPage(page - 1)} disabled={page <= 1} className="rounded-sm p-0.5 hover:bg-slate-200 disabled:opacity-30">
            <ChevronLeft size={12} />
          </button>
          {pageNums.map((n, i) =>
            typeof n === 'number' ? (
              <button
                key={i}
                onClick={() => setPage(n)}
                className={clsx(
                  'mono min-w-5 rounded-sm px-1 py-0.5',
                  n === page ? 'bg-ink text-white' : 'hover:bg-slate-200',
                )}
              >
                {n}
              </button>
            ) : (
              <span key={i} className="px-0.5">…</span>
            ),
          )}
          <button onClick={() => setPage(page + 1)} disabled={page >= totalPages} className="rounded-sm p-0.5 hover:bg-slate-200 disabled:opacity-30">
            <ChevronRight size={12} />
          </button>
          <button onClick={jumpToPage} className="ml-1 rounded-sm border border-slate-300 bg-white px-1.5 py-0.5 hover:bg-slate-100">
            Go to...
          </button>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="ml-1 rounded-sm border border-slate-300 bg-white px-1 py-0.5 outline-none"
          >
            {[25, 50, 100].map((n) => (
              <option key={n} value={n}>{n}/page</option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
}
