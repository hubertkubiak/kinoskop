import { z } from 'zod';
import { type ClassifyRequest, ProviderError } from './provider';

const ReplySchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }) })).min(1),
});

/** Minimal OpenAI-compatible Chat Completions call (OpenRouter, Gemini). */
async function chatCompletions(url: string, req: ClassifyRequest, extraHeaders: Record<string, string> = {}): Promise<string> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      signal: req.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${req.apiKey}`, ...extraHeaders },
      body: JSON.stringify({
        model: req.model,
        temperature: 0,
        messages: [
          { role: 'system', content: req.system },
          { role: 'user', content: req.user },
        ],
      }),
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ProviderError('Brak połączenia z dostawcą AI (sieć lub CORS).', 'network');
  }
  if (res.status === 401 || res.status === 403) throw new ProviderError('Nieprawidłowy klucz API.', 'auth');
  if (res.status === 429) throw new ProviderError('Przekroczono limit zapytań (np. dzienny limit darmowego tieru).', 'rate-limit');
  if (!res.ok) throw new ProviderError(`Błąd dostawcy AI (${res.status}).`, 'other');
  const parsed = ReplySchema.safeParse(await res.json());
  if (!parsed.success) throw new ProviderError('Nieoczekiwany format odpowiedzi dostawcy.', 'other');
  return parsed.data.choices[0].message.content ?? '';
}

export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
export const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

export const classifyWithOpenRouter = (req: ClassifyRequest) =>
  chatCompletions(OPENROUTER_URL, req, { 'X-Title': 'Kinoskop' });

export const classifyWithGemini = (req: ClassifyRequest) => chatCompletions(GEMINI_URL, req);
