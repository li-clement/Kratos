import type { TrajectoryRecord, TrajectoryMessage, DistributionStep } from '../types';

/** 确定性伪随机（mulberry32），保证每次刷新数据一致 */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TOOL_POOL = [
  'read_file',
  'write_file',
  'edit_file',
  'bash',
  'grep',
  'glob',
  'lsp_definition',
  'web_search',
  'run_tests',
  'git_commit',
];

const TASK_TEMPLATES = [
  {
    task: '为 Kratos 项目接入 DataViewer 面板，要求支持虚拟滚动与 1 万行以上数据。',
    steps: ['查看现有目录结构', '阅读 tailwind 配置', '实现虚拟滚动列表', '接入 zustand 状态', '运行构建验证'],
  },
  {
    task: '排查线上接口偶发 500：从网关日志定位到后端空指针。',
    steps: ['拉取网关日志', '过滤 5xx 记录', '定位堆栈', '修复空指针', '补充回归测试'],
  },
  {
    task: '将内部工具库从 webpack 迁移到 vite，并保持产物 hash 稳定。',
    steps: ['梳理构建入口', '替换配置文件', '处理别名与插件', '对比构建产物', '修复 hash 差异'],
  },
  {
    task: '为对话数据集编写质检脚本，统计 reasoning 占比与 tool call 覆盖率。',
    steps: ['定义质检指标', '解析 JSONL', '聚合统计', '输出报表', '接入 CI'],
  },
  {
    task: '优化大文件分页接口：DuckDB 流式读取 + 缓存索引。',
    steps: ['压测现状', '引入 DuckDB', '建立分页索引', '缓存热点页', '复测延迟'],
  },
  {
    task: '重构 Agent 轨迹导出模块，统一 messages 与 tool_calls 的序列化格式。',
    steps: ['盘点旧格式', '设计新 schema', '编写转换器', '双写灰度', '下线旧路径'],
  },
];

const REASONING_SNIPPETS = [
  '用户需要一个可视化管理面板。我先查看项目结构，确认技术栈是 React + TypeScript + Tailwind。',
  '日志里 500 集中在 order 服务。怀疑是空指针，接下来 grep 堆栈里的关键类名。',
  '迁移风险主要在插件兼容性。先跑一次 dry-run 构建，对比产物体积是否异常。',
  '质检指标要能区分 reasoning 与 content，否则统计口径会和报表对不上。',
  '分页接口的瓶颈在磁盘随机读。DuckDB 列式扫描应该能显著降低延迟。',
  '序列化格式不统一会导致下游解析失败。设计 schema 时必须向后兼容一个版本。',
];

const CONTENT_SNIPPETS = [
  '已读取目录结构：src/ 下有 main.tsx、App.tsx 与 components/，尚未安装依赖。',
  '在网关日志中定位到 3 条 500 记录，堆栈指向 OrderService.calculate() 的第 42 行。',
  'dry-run 构建通过，产物体积从 1.8MB 降至 1.2MB，hash 策略保持不变。',
  'reasoning 占比 38.4%，tool call 覆盖率 91.2%，共发现 2 条格式异常记录。',
  'DuckDB 流式读取后 P99 从 840ms 降至 96ms，缓存命中率 97%。',
  '新 schema 已双写灰度 20% 流量，一周内无解析错误，可以推进全量。',
];

function buildMessages(rand: () => number, taskId: number): TrajectoryMessage[] {
  const tpl = TASK_TEMPLATES[taskId % TASK_TEMPLATES.length];
  const msgs: TrajectoryMessage[] = [
    {
      role: 'system',
      content:
        '你是一个严谨的编程智能体。使用工具前先说明理由；修改代码后必须运行测试；不确定时向用户提问。',
    },
    { role: 'user', content: tpl.task },
  ];
  const stepCount = Math.max(3, Math.round(3 + rand() * 4));
  let toolSeq = 0;
  for (let i = 0; i < stepCount; i++) {
    const ri = Math.floor(rand() * REASONING_SNIPPETS.length);
    msgs.push({
      role: 'assistant',
      content: '',
      reasoning_content: REASONING_SNIPPETS[(ri + i) % REASONING_SNIPPETS.length],
      tool_calls:
        rand() > 0.25
          ? [
              {
                id: `call_${taskId}_${toolSeq++}`,
                name: TOOL_POOL[Math.floor(rand() * TOOL_POOL.length)],
                arguments: { path: `src/step_${i}.ts`, line: Math.floor(rand() * 300) },
              },
            ]
          : undefined,
    });
    if (rand() > 0.25) {
      msgs.push({
        role: 'tool',
        content: `工具执行完成：exit 0，耗时 ${Math.round(rand() * 900 + 60)}ms，输出 ${(rand() * 4 + 0.2).toFixed(1)}KB。`,
      });
    }
    if (i === stepCount - 1) {
      msgs.push({
        role: 'assistant',
        content: CONTENT_SNIPPETS[taskId % CONTENT_SNIPPETS.length],
      });
    }
  }
  return msgs;
}

export function makeRecord(line: number, fileIdSeed: number): TrajectoryRecord {
  const rand = rng(fileIdSeed * 7919 + line * 104729);
  const taskId = Math.floor(rand() * TASK_TEMPLATES.length);
  const messages = buildMessages(rand, taskId);

  const toolCalls = messages.filter((m) => m.tool_calls?.length).length;
  const toolResults = messages.filter((m) => m.role === 'tool').length;
  const rounds = messages.filter((m) => m.role === 'user').length;
  const reasoningSteps = messages.filter((m) => !!m.reasoning_content).length;
  const steps = toolCalls + reasoningSteps;

  const systemTokens = 180 + Math.floor(rand() * 60);
  const userTokens = 60 + Math.floor(rand() * 220);
  const reasoningTokens = 240 + Math.floor(rand() * 900);
  const contentTokens = 120 + Math.floor(rand() * 600);
  const total = systemTokens + userTokens + reasoningTokens + contentTokens;
  const pct = (n: number) => Math.round((n / total) * 1000) / 10;

  const distribution: DistributionStep[] = [];
  let remainR = reasoningTokens;
  let remainC = contentTokens;
  const dSteps = Math.max(3, Math.min(9, steps));
  for (let i = 0; i < dSteps; i++) {
    const last = i === dSteps - 1;
    const r = last ? remainR : Math.floor((remainR / (dSteps - i)) * (0.6 + rand() * 0.8));
    const c = last ? remainC : Math.floor((remainC / (dSteps - i)) * (0.6 + rand() * 0.8));
    remainR -= r;
    remainC -= c;
    distribution.push({
      step_index: i + 1,
      reasoning: Math.max(0, r),
      content: Math.max(0, c),
      system: i === 0 ? systemTokens : undefined,
      user: i === 0 ? userTokens : undefined,
    });
  }

  const analysisTokens = systemTokens + userTokens;
  const trainTokens = reasoningTokens + contentTokens;
  const status: TrajectoryRecord['metadata']['status'] =
    line % 977 === 0 ? 'error' : line % 463 === 0 ? 'warning' : 'clean';

  return {
    id: `traj_${fileIdSeed}_${String(line).padStart(5, '0')}`,
    metadata: {
      analyzer_version: 'trajreport@1.5.7',
      backend: 'pangu_hf',
      dataset_name: 'D8.7_注册、集成与调用链',
      line_number: line,
      file_size_kb: 29538,
      status,
    },
    metrics: {
      turns: rounds + Math.floor(rand() * 3),
      valid_steps: steps,
      reasoning_steps: reasoningSteps,
      reasoning_steps_pct: steps ? Math.round((reasoningSteps / steps) * 1000) / 10 : 0,
      rounds,
      messages: messages.length,
      tool_calls: toolCalls,
      tool_results: toolResults,
      distinct_tools: 2 + Math.floor(rand() * 6),
      train_tokens: trainTokens,
      analysis_tokens: analysisTokens,
      trained_pct: pct(trainTokens),
      tok_per_step_avg: steps ? Math.round(total / steps) : 0,
      row_size_kb: Math.round((total / 3.6 + rand() * 40) * 10) / 10,
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

/** 行级预览（轻量，不做完整解析） */
export function makeRowPreview(line: number, fileIdSeed: number) {
  const rec = makeRecord(line, fileIdSeed);
  const firstUser = rec.messages.find((m) => m.role === 'user');
  return {
    line,
    tokens: rec.metrics.train_tokens + rec.metrics.analysis_tokens,
    snippet: firstUser?.content ?? '',
    hasError: rec.metadata.status === 'error',
    hasWarning: rec.metadata.status === 'warning',
  };
}

import type { DataFile } from '../types';

export const MOCK_FILES: DataFile[] = [
  {
    id: 'f1',
    name: 'D8.7_注册、集成与调用链.jsonl',
    size: '28.84 MB',
    modified: '1d ago',
    lines: 7451,
    errors: 1,
    warnings: 1,
    starred: true,
  },
  { id: 'f2', name: 'D8.3_报文解析与编解码.jsonl', size: '12.41 MB', modified: '2d ago', lines: 3120, errors: 0, warnings: 2 },
  { id: 'f3', name: 'D8.1_启动配置加载.jsonl', size: '5.06 MB', modified: '3d ago', lines: 984, errors: 0, warnings: 0 },
  { id: 'f4', name: 'D9.2_鉴权与令牌刷新.jsonl', size: '41.2 MB', modified: '5d ago', lines: 10233, errors: 3, warnings: 1 },
  { id: 'f5', name: 'D9.5_日志采集与检索.jsonl', size: '18.9 MB', modified: '1w ago', lines: 4620, errors: 0, warnings: 0 },
  { id: 'f6', name: 'D7.0_依赖注入与装配.jsonl', size: '9.7 MB', modified: '2w ago', lines: 2287, errors: 1, warnings: 0 },
];
