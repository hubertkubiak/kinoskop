import Anthropic from '@anthropic-ai/sdk';
import { type ClassifyRequest, ProviderError } from './provider';

/**
 * Anthropic adapter (official SDK, called directly from the browser with the user's own key).
 * `dangerouslyAllowBrowser` makes the SDK send `anthropic-dangerous-direct-browser-access: true`;
 * the key never touches the Kinoskop backend.
 *
 * Notes vs SPEC §7.11: current Claude models reject sampling parameters, so `temperature: 0` is not
 * sent; determinism comes from the closed key list and validation. Thinking cannot be disabled on
 * Claude Opus 5.5 – effort `low` keeps this simple classification cheap. Server-side refusal
 * fallbacks are enabled (`fallbacks: "default"`).
 */
export async function classifyWithAnthropic(req: ClassifyRequest): Promise<string> {
  const client = new Anthropic({ apiKey: req.apiKey, dangerouslyAllowBrowser: true, maxRetries: 2 });
  try {
    const response = await client.beta.messages.create(
      {
        model: req.model,
        max_tokens: 4000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low' },
        system: req.system,
        messages: [{ role: 'user', content: req.user }],
      },
      { signal: req.signal },
    );
    if (response.stop_reason === 'refusal') throw new ProviderError('Model odmówił odpowiedzi.', 'refusal');
    return response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
      throw new ProviderError('Nieprawidłowy klucz API Anthropic.', 'auth');
    }
    if (e instanceof Anthropic.RateLimitError) throw new ProviderError('Przekroczono limit zapytań u dostawcy.', 'rate-limit');
    if (e instanceof Anthropic.APIConnectionError) throw new ProviderError('Brak połączenia z Anthropic.', 'network');
    if (e instanceof Anthropic.APIError) throw new ProviderError(`Błąd API Anthropic (${e.status}).`, 'other');
    throw e;
  }
}
