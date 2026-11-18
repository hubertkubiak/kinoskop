import { z } from 'zod';
import { ERA_KEYS, ERA_LABELS, EraKeySchema, type EraKey } from '../eras';

/**
 * Era classification prompt and response validation (SPEC §7.11). Shared so a future server-side
 * mode (SPEC §13) gives identical results. Only public metadata goes into the prompt –
 * never ratings or anything about the user.
 */
export const ERA_BATCH_SIZE = 20;

export const EraPromptItemSchema = z.object({
  filmwebId: z.number().int(),
  title: z.string(),
  originalTitle: z.string().optional(),
  year: z.number().int().optional(),
  overview: z.string().optional(),
  keywords: z.array(z.string()).optional(),
});
export type EraPromptItem = z.infer<typeof EraPromptItemSchema>;

export const ERA_ANSWER_KEYS = [...ERA_KEYS, 'unknown'] as const;

const AnswerSchema = z.object({
  filmwebId: z.number().int(),
  eras: z.array(z.enum(ERA_ANSWER_KEYS)).max(5),
  confidence: z.number().min(0).max(1),
});

/** Below this confidence an answer is treated as "undetermined". */
export const ERA_MIN_CONFIDENCE = 0.5;

export function buildEraPrompt(items: EraPromptItem[]): { system: string; user: string } {
  const legend = ERA_KEYS.map((k) => `- ${k}: ${ERA_LABELS[k]}`).join('\n');
  const system = [
    'You classify films, TV series and video games by the historical period in which their story is set.',
    'Use only these keys (a title may have several, e.g. a story spanning two decades):',
    legend,
    '- unknown: the setting period cannot be determined from your knowledge and the given data',
    'Rules: classify the period of the STORY, not the production year. "ww2" is for stories set during World War II',
    '(you may add "1940s" too). "contemporary" means set from 2000 onwards. "future" is for stories set in the future,',
    '"fictional" for invented worlds without a real-world period. Prefer "unknown" over guessing.',
    'Answer with JSON only: an array of {"filmwebId": number, "eras": string[], "confidence": number between 0 and 1},',
    'one entry per input title, same filmwebId values, no extra text.',
  ].join('\n');
  const user = JSON.stringify(
    items.map((i) => ({
      filmwebId: i.filmwebId,
      title: i.title,
      ...(i.originalTitle ? { originalTitle: i.originalTitle } : {}),
      ...(i.year ? { year: i.year } : {}),
      ...(i.overview ? { overview: i.overview.slice(0, 600) } : {}),
      ...(i.keywords?.length ? { keywords: i.keywords.slice(0, 15) } : {}),
    })),
  );
  return { system, user };
}

export interface EraAnswer {
  filmwebId: number;
  eras: EraKey[];
  confidence: number;
}

export interface EraParseResult {
  answers: EraAnswer[];
  /** Number of invalid or unexpected entries that were dropped. */
  rejected: number;
}

/** Extracts the first JSON array from a model reply (tolerates ```json fences and prose). */
function extractJsonArray(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('[');
  const end = body.lastIndexOf(']');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Validates a model reply. Invalid entries, ids outside the batch, "unknown" and low-confidence
 * answers are dropped – they count as undetermined and are never guessed on the client.
 */
export function parseEraResponse(text: string, expectedIds: number[]): EraParseResult {
  const raw = extractJsonArray(text);
  if (!Array.isArray(raw)) return { answers: [], rejected: expectedIds.length };
  const allowed = new Set(expectedIds);
  const seen = new Set<number>();
  const answers: EraAnswer[] = [];
  let rejected = 0;
  for (const entry of raw) {
    const r = AnswerSchema.safeParse(entry);
    if (!r.success || !allowed.has(r.data.filmwebId) || seen.has(r.data.filmwebId)) {
      rejected++;
      continue;
    }
    seen.add(r.data.filmwebId);
    const eras = [...new Set(r.data.eras.filter((e): e is EraKey => EraKeySchema.safeParse(e).success))];
    if (r.data.confidence >= ERA_MIN_CONFIDENCE && eras.length) {
      answers.push({ filmwebId: r.data.filmwebId, eras, confidence: r.data.confidence });
    }
  }
  return { answers, rejected };
}
