import { generateOpenAiReply } from './providers/openai';
import { generateAnthropicReply } from './providers/anthropic';
import type { ChatMessage, GenerateReplyResult } from './providers/shared';

export type { ChatMessage, GenerateReplyResult };
export type AiProvider = 'openai' | 'anthropic';

export async function generateReply(args: {
  provider: AiProvider;
  apiKey: string;
  model: string;
  systemPrompt: string;
  messages: ChatMessage[];
}): Promise<GenerateReplyResult> {
  const input = { apiKey: args.apiKey, model: args.model, systemPrompt: args.systemPrompt, messages: args.messages };
  return args.provider === 'openai' ? generateOpenAiReply(input) : generateAnthropicReply(input);
}
