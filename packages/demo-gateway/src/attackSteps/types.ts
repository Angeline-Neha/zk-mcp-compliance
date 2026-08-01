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

/**
 * Describes one user-editable input for an exhibit's "configure" panel.
 * Purely descriptive — the frontend renders a control per ParamDef and
 * sends the chosen values back as the JSON body of POST /attack/:id/start.
 */
export interface ParamDef {
  key: string;
  label: string;
  type: "orderRef" | "number" | "text";
  default: string | number;
  help?: string;
  min?: number;
  max?: number;
  /** For type "orderRef": restrict the dropdown to only "pass" or "fail" seeded orders. Omit for no restriction. */
  category?: "pass" | "fail";
}

export interface AttackDefinition<TState = any, TConfig = any> {
  id: string;
  title: string;
  /** Editable inputs shown in the exhibit's configure panel before "Run". */
  params?: ParamDef[];
  /**
   * Either a fixed initial state (legacy, no configurability) or a builder
   * function that turns the user's submitted config (raw JSON body from
   * POST /attack/:id/start, defaults already applied by the frontend) into
   * the attack's starting state.
   */
  initialState: TState | ((config: TConfig) => TState);
  steps: Step<TState>[];
}

export function buildInitialState<TState, TConfig>(
  attack: AttackDefinition<TState, TConfig>,
  config: TConfig
): TState {
  return typeof attack.initialState === "function"
    ? (attack.initialState as (c: TConfig) => TState)(config)
    : attack.initialState;
}
