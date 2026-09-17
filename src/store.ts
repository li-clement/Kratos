import { create } from 'zustand';
import type { DataFile, RowPreview, TrajectoryRecord, ViewTab } from './types';

interface ViewerState {
  files: DataFile[];
  activeFileId: string;
  activeLine: number;
  rows: RowPreview[];
  record: TrajectoryRecord | null;
  source: 'langfuse' | 'mock' | null;
  filesLoading: boolean;
  filesError: string | null;
  rowsLoading: boolean;
  rowsError: string | null;
  recordLoading: boolean;
  recordError: string | null;
  _recordKey: string | null;
  viewTab: ViewTab;
  showSteps: boolean;
  showAllRoles: boolean;
  query: string;
  useRegex: boolean;
  highlight: boolean;
  page: number;
  pageSize: number;
  starred: Record<string, boolean>;

  loadFiles: () => Promise<void>;
  loadRows: () => Promise<void>;
  loadRecord: () => Promise<void>;
  reloadRecord: () => Promise<void>;
  refresh: () => Promise<void>;
  setActiveFile: (id: string) => void;
  setActiveLine: (line: number) => void;
  setViewTab: (tab: ViewTab) => void;
  toggleSteps: () => void;
  toggleAllRoles: () => void;
  setQuery: (q: string) => void;
  setUseRegex: (v: boolean) => void;
  setHighlight: (v: boolean) => void;
  setPage: (p: number) => void;
  setPageSize: (n: number) => void;
  toggleStar: (id: string) => void;
}

const API_BASE = '/api/langfuse';

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`);
  const payload = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? `Request failed (${response.status})`);
  return payload;
}

export const useViewer = create<ViewerState>((set, get) => ({
  files: [],
  activeFileId: '',
  activeLine: 1,
  rows: [],
  record: null,
  source: null,
  filesLoading: true,
  filesError: null,
  rowsLoading: false,
  rowsError: null,
  recordLoading: false,
  recordError: null,
  _recordKey: null,
  viewTab: 'scan',
  showSteps: true,
  showAllRoles: false,
  query: '',
  useRegex: false,
  highlight: true,
  page: 1,
  pageSize: 25,
  starred: { f1: true },

  loadFiles: async () => {
    set({ filesLoading: true, filesError: null });
    try {
      const config = await fetchJson<{ source: 'langfuse' | 'mock' }>('/config');
      const payload = await fetchJson<{ source: 'langfuse' | 'mock'; files: DataFile[] }>('/files');
      const activeFileId = payload.files.some((file) => file.id === get().activeFileId)
        ? get().activeFileId
        : payload.files[0]?.id ?? '';
      set({
        source: payload.source ?? config.source,
        files: payload.files,
        activeFileId,
        activeLine: 1,
        page: 1,
        filesLoading: false,
        filesError: null,
      });
    } catch (error) {
      set({
        filesLoading: false,
        filesError: error instanceof Error ? error.message : 'Unable to load Langfuse files',
      });
    }
  },

  loadRows: async () => {
    const fileId = get().activeFileId;
    if (!fileId) {
      set({ rows: [], rowsLoading: false, rowsError: null });
      return;
    }

    set({ rowsLoading: true, rowsError: null });
    try {
      const payload = await fetchJson<{ rows: RowPreview[] }>(`/rows?fileId=${encodeURIComponent(fileId)}`);
      if (get().activeFileId !== fileId) return;
      set({ rows: payload.rows, rowsLoading: false, rowsError: null });
    } catch (error) {
      if (get().activeFileId !== fileId) return;
      set({
        rows: [],
        rowsLoading: false,
        rowsError: error instanceof Error ? error.message : 'Unable to load rows',
      });
    }
  },

  loadRecord: async () => {
    const { activeFileId, activeLine } = get();
    const key = `${activeFileId}:${activeLine}`;
    if (!activeFileId || get()._recordKey === key) return;

    set({ record: null, recordLoading: true, recordError: null, _recordKey: key });
    try {
      const payload = await fetchJson<{ record: TrajectoryRecord | null }>(
        `/record?fileId=${encodeURIComponent(activeFileId)}&line=${activeLine}`,
      );
      if (get()._recordKey !== key) return;
      if (!payload.record) throw new Error('Trajectory not found');
      set({ record: payload.record, recordLoading: false, recordError: null });
    } catch (error) {
      if (get()._recordKey !== key) return;
      set({
        recordLoading: false,
        recordError: error instanceof Error ? error.message : 'Unable to load trajectory',
      });
    }
  },

  reloadRecord: async () => {
    set({ record: null, _recordKey: null });
    await get().loadRecord();
  },

  refresh: async () => {
    set({ rows: [], record: null, _recordKey: null });
    await get().loadFiles();
    await get().loadRows();
  },

  setActiveFile: (id) => set({
    activeFileId: id,
    activeLine: 1,
    page: 1,
    query: '',
    rows: [],
    record: null,
    _recordKey: null,
    rowsError: null,
    recordError: null,
  }),
  setActiveLine: (line) => set({ activeLine: line }),
  setViewTab: (tab) => set({ viewTab: tab }),
  toggleSteps: () => set((s) => ({ showSteps: !s.showSteps })),
  toggleAllRoles: () => set((s) => ({ showAllRoles: !s.showAllRoles })),
  setQuery: (q) => set({ query: q, page: 1 }),
  setUseRegex: (v) => set({ useRegex: v, page: 1 }),
  setHighlight: (v) => set({ highlight: v }),
  setPage: (p) => set({ page: Math.max(1, p) }),
  setPageSize: (n) => set({ pageSize: n, page: 1 }),
  toggleStar: (id) => set((s) => ({ starred: { ...s.starred, [id]: !s.starred[id] } })),
}));

/** 选择器：当前文件 */
export function useActiveFile(): DataFile | null {
  return useViewer((s) => s.files.find((f) => f.id === s.activeFileId) ?? null);
}

/** 选择器：过滤后的行预览（虚拟列表直接渲染全部过滤结果，分页只控制跳转范围） */
export function useFilteredRows(): RowPreview[] {
  const rows = useViewer((s) => s.rows);
  const query = useViewer((s) => s.query);
  const useRegex = useViewer((s) => s.useRegex);

  if (!query) return rows;

  let re: RegExp | null = null;
  if (useRegex) {
    try {
      re = new RegExp(query, 'i');
    } catch {
      re = null;
    }
  }

  return rows.filter((row) => {
    const hit = useRegex
      ? re?.test(row.snippet) ?? false
      : row.snippet.toLowerCase().includes(query.toLowerCase());
    return hit;
  });
}

/** 选择器：当前行的完整记录 */
export function useActiveRecord(): TrajectoryRecord | null {
  return useViewer((s) => s.record);
}
