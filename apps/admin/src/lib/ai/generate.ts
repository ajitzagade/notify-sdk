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

/** Used by the "Test key" button — a cheap real call to confirm the key/model actually work. */
export async function testProviderKey(
  provider: AiProvider,
  apiKey: string,
  model: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    await generateReply({
      provider,
      apiKey,
      model,
      systemPrompt: 'You are a connectivity test. Reply with only the word: ok',
      messages: [{ role: 'user', content: 'ping' }],
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
