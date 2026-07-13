import type { GenerateReplyInput, GenerateReplyResult } from './shared';

/** Plain fetch against Anthropic's Messages API — no SDK dependency. */
export async function generateAnthropicReply(input: GenerateReplyInput): Promise<GenerateReplyResult> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': input.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: input.model,
      system: input.systemPrompt,
      messages: input.messages,
      max_tokens: 500,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API error (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const block = data.content?.[0];
  return {
    text: block?.type === 'text' ? (block.text as string) : null,
    usage: {
      inputTokens:  data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
    },
  };
}
