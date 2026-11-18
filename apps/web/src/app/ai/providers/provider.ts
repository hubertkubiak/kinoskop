import type { ProviderId } from '../ai-models.config';

export interface ClassifyRequest {
  system: string;
  user: string;
  model: string;
  apiKey: string;
  signal?: AbortSignal;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly kind: 'auth' | 'rate-limit' | 'refusal' | 'network' | 'other',
  ) {
    super(message);
  }
}

/** A provider returns the raw text of the model reply; validation happens in libs/shared. */
export type ProviderAdapter = (req: ClassifyRequest) => Promise<string>;

/** Adapters are loaded lazily so the AI code (and the Anthropic SDK) stays out of other views. */
export async function loadAdapter(id: ProviderId): Promise<ProviderAdapter> {
  switch (id) {
    case 'anthropic':
      return (await import('./anthropic')).classifyWithAnthropic;
    case 'openrouter':
      return (await import('./openai-compatible')).classifyWithOpenRouter;
    case 'gemini':
      return (await import('./openai-compatible')).classifyWithGemini;
  }
}
