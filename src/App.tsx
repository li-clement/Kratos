import { useEffect } from 'react';
import TopBar from './components/TopBar';
import FilePanel from './components/FilePanel';
import RowListPanel from './components/RowListPanel';
import InspectorPanel from './components/InspectorPanel';
import { useViewer } from './store';

export default function App() {
  const activeFileId = useViewer((s) => s.activeFileId);
  const activeLine = useViewer((s) => s.activeLine);
  const loadFiles = useViewer((s) => s.loadFiles);
  const loadRows = useViewer((s) => s.loadRows);
  const loadRecord = useViewer((s) => s.loadRecord);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  useEffect(() => {
    void loadRows();
  }, [activeFileId, loadRows]);

  useEffect(() => {
    void loadRecord();
  }, [activeFileId, activeLine, loadRecord]);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#eef1f5]">
      <TopBar />
      <div className="flex min-h-0 flex-1 gap-px bg-slate-300">
        <FilePanel />
        <RowListPanel />
        <InspectorPanel />
      </div>
    </div>
  );
}
