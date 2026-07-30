export interface StepResult {
  label: string;
  narration: string;
  request?: unknown;
  response?: unknown;
  blocked?: boolean;
}

export interface Step<TState> {
  label: string;
  run: (state: TState) => Promise<{ result: StepResult; newState: TState }>;
}

export interface AttackDefinition<TState = any> {
  id: string;
  title: string;
  initialState: TState;
  steps: Step<TState>[];
}