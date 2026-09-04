export interface AiDecisionDraft {
  decision: string;
  context: string;
  options: string;
  rationale: string;
  impact: string;
}

export interface AiChoice {
  id: string;
  label: string;
  detail?: string;
}

export interface AiStageResponse {
  assistant_message: string;
  output: Record<string, unknown>;
  decisions: AiDecisionDraft[];
  ready_to_advance: boolean;
  choices: AiChoice[];
}

export interface AiConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}
