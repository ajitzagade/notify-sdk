export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface GenerateReplyInput {
  apiKey: string;
  model: string;
  systemPrompt: string;
  messages: ChatMessage[];
}

export interface GenerateReplyResult {
  /** Null when the model returned no usable text (caller treats this as a handoff signal). */
  text: string | null;
  usage: { inputTokens: number; outputTokens: number };
}
