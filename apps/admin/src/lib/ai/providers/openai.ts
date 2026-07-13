import type { GenerateReplyInput, GenerateReplyResult } from './shared';

/** Plain fetch against OpenAI's Chat Completions API — no SDK dependency. */
export async function generateOpenAiReply(input: GenerateReplyInput): Promise<GenerateReplyResult> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      model: input.model,
      messages: [{ role: 'system', content: input.systemPrompt }, ...input.messages],
      max_tokens: 500,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI API error (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  return {
    text: data.choices?.[0]?.message?.content ?? null,
    usage: {
      inputTokens:  data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
    },
  };
}
