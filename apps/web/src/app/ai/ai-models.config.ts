/**
 * Recommended AI providers and models for era classification (SPEC §7.11).
 * Model names and limits change often – keep them in this single file and re-check the
 * provider docs before each release. Last checked: 2026-11-18.
 *
 * Endpoints (verified in provider docs on 2026-11-18):
 *  - Anthropic Messages API via the official SDK with `dangerouslyAllowBrowser: true`
 *    (sends `anthropic-dangerous-direct-browser-access: true`).
 *  - OpenRouter: POST https://openrouter.ai/api/v1/chat/completions, `Authorization: Bearer`.
 *  - Gemini OpenAI-compatible: POST https://generativelanguage.googleapis.com/v1beta/openai/chat/completions,
 *    `Authorization: Bearer`.
 * TODO(author): the OpenRouter and Gemini docs do not state CORS support for browser calls –
 * confirm with a real key in the browser before relying on them.
 */
export type ProviderId = 'anthropic' | 'openrouter' | 'gemini';

export interface ModelOption {
  id: string;
  label: string;
  /** USD per 1M tokens (input, output); undefined for free tiers. */
  price?: { input: number; output: number };
}

export interface ProviderInfo {
  id: ProviderId;
  name: string;
  keyUrl: string;
  keyHowTo: string[];
  note: string;
  models: ModelOption[];
  /** Domain for the CSP connect-src allowlist. */
  origin: string;
}

export const AI_PROVIDERS: ProviderInfo[] = [
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    keyHowTo: ['Załóż konto w Anthropic Console.', 'Doładuj saldo (usługa płatna).', 'Utwórz klucz API w Settings → API Keys.'],
    note: 'Płatny, najlepsza jakość klasyfikacji.',
    origin: 'https://api.anthropic.com',
    models: [
      { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (zalecany)', price: { input: 4, output: 20 } },
      { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', price: { input: 2, output: 10 } },
      { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (najtańszy)', price: { input: 0.1, output: 0.5 } },
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter (darmowe modele)',
    keyUrl: 'https://openrouter.ai/settings/keys',
    keyHowTo: ['Załóż konto na openrouter.ai.', 'Utwórz klucz w Settings → Keys.', 'Wybierz model z sufiksem „:free”.'],
    note: 'Darmowe modele: wspólny limit konta 20 zapytań/min i 50 dziennie (do 1000 dziennie po jednorazowym doładowaniu 10 USD).',
    origin: 'https://openrouter.ai',
    // TODO(author): free model ids rotate – pick current ones from https://openrouter.ai/models?q=free
    models: [{ id: 'openrouter/free', label: 'Automatyczny wybór darmowego modelu' }],
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    keyUrl: 'https://aistudio.google.com/apikey',
    keyHowTo: ['Zaloguj się do Google AI Studio.', 'Kliknij „Get API key” i utwórz klucz.'],
    note: 'Darmowy tier dla wybranych modeli. Zapytania z darmowego tieru mogą być używane przez Google do ulepszania produktów – wysyłamy tylko publiczne tytuły i opisy, bez Twoich danych.',
    origin: 'https://generativelanguage.googleapis.com',
    // Model ids seen in the Gemini OpenAI-compatibility docs on 2026-11-18; verify availability.
    models: [{ id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' }],
  },
];

/** Rough token estimate per title (prompt + answer), used only for the cost preview. */
export const TOKENS_PER_TITLE = { input: 180, output: 35 };
export const SYSTEM_PROMPT_TOKENS = 450;
