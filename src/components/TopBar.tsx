import { useEffect, useState } from 'react';
import {
  Activity,
  Boxes,
  Cpu,
  HardDrive,
  HelpCircle,
  Layers,
  MemoryStick,
  Settings,
  SquareTerminal,
  UserRound,
  Power,
} from 'lucide-react';

function Pill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-1 rounded-sm border border-slate-300 bg-white px-1.5 py-0.5 text-2xs text-slate-600">
      {icon}
      {label}
    </span>
  );
}

export default function TopBar() {
  const [cpu, setCpu] = useState(0);
  const [mem, setMem] = useState(2);
  const [up, setUp] = useState(10.2);
  const [down, setDown] = useState(12.7);

  useEffect(() => {
    const t = setInterval(() => {
      setCpu(Math.random() * 8);
      setMem(2 + Math.random() * 3);
      setUp(8 + Math.random() * 6);
      setDown(10 + Math.random() * 8);
    }, 2000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="flex h-9 shrink-0 items-center justify-between border-b border-slate-300 bg-slate-100 px-2">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-sm bg-ink text-white">
            <Boxes size={13} />
          </span>
          <span className="text-xs font-semibold tracking-wide text-slate-800">DataViewer</span>
        </div>
        <nav className="flex items-center gap-0.5 text-xs">
          <button className="flex items-center gap-1 rounded-sm bg-white px-2 py-0.5 font-medium text-slate-800 shadow-sm ring-1 ring-slate-300">
            <Layers size={12} /> Aggregation
          </button>
          <button className="flex items-center gap-1 rounded-sm px-2 py-0.5 text-slate-500 hover:bg-slate-200">
            <Activity size={12} /> Tools
          </button>
        </nav>
      </div>
      <div className="flex items-center gap-1.5">
        <Pill icon={<Cpu size={11} className="text-emerald-600" />} label={`CPU ${cpu.toFixed(0)}%`} />
        <Pill icon={<MemoryStick size={11} className="text-sky-600" />} label={`MEM ${mem.toFixed(0)}%`} />
        <Pill icon={<Activity size={11} className="text-amber-600" />} label={`↑ ${up.toFixed(1)} KB/s ↓ ${down.toFixed(1)} KB/s`} />
        <Pill icon={<HardDrive size={11} className="text-violet-600" />} label="Storage 45%" />
        <div className="mx-1 h-4 w-px bg-slate-300" />
        <button className="rounded-sm p-1 text-slate-500 hover:bg-slate-200" title="Console">
          <SquareTerminal size={13} />
        </button>
        <button className="rounded-sm p-1 text-slate-500 hover:bg-slate-200" title="Settings">
          <Settings size={13} />
        </button>
        <button className="rounded-sm p-1 text-slate-500 hover:bg-slate-200" title="Help">
          <HelpCircle size={13} />
        </button>
        <span className="flex items-center gap-1 rounded-sm border border-slate-300 bg-white px-1.5 py-0.5 text-2xs text-slate-600">
          <UserRound size={11} /> Viewer
        </span>
        <button className="rounded-sm p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-500" title="Exit">
          <Power size={13} />
        </button>
      </div>
    </header>
  );
}
