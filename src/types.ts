export interface TokenSlice {
  count: number;
  pct: number;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface TrajectoryMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  reasoning_content?: string;
  tool_calls?: ToolCall[];
}

export interface DistributionStep {
  step_index: number;
  reasoning: number;
  content: number;
  system?: number;
  user?: number;
}

export interface TrajectoryRecord {
  id: string;
  metadata: {
    analyzer_version: string;
    backend: string;
    dataset_name: string;
    line_number: number;
    file_size_kb: number;
    status: 'clean' | 'warning' | 'error';
  };
  metrics: {
    turns: number;
    valid_steps: number;
    reasoning_steps: number;
    reasoning_steps_pct: number;
    rounds: number;
    messages: number;
    tool_calls: number;
    tool_results: number;
    distinct_tools: number;
    train_tokens: number;
    analysis_tokens: number;
    trained_pct: number;
    tok_per_step_avg: number;
    row_size_kb: number;
  };
  token_composition: {
    system: TokenSlice;
    user: TokenSlice;
    reasoning: TokenSlice;
    content: TokenSlice;
  };
  distribution: DistributionStep[];
  messages: TrajectoryMessage[];
}

export interface RowPreview {
  line: number;
  tokens: number;
  snippet: string;
  hasError?: boolean;
  hasWarning?: boolean;
}

export interface DataFile {
  id: string;
  name: string;
  size: string;
  modified: string;
  lines: number;
  errors: number;
  warnings: number;
  starred?: boolean;
}

export type ViewTab = 'scan' | 'conversation' | 'markdown' | 'raw' | 'trajectory';
