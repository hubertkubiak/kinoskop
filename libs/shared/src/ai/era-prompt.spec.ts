import { describe, expect, it } from 'vitest';
import { buildEraPrompt, parseEraResponse } from './era-prompt';

describe('era prompt', () => {
  it('builds a prompt with the closed list of keys and only public data', () => {
    const p = buildEraPrompt([{ filmwebId: 1, title: 'Pianista', year: 2002, overview: 'Warszawa 1939' }]);
    expect(p.system).toContain('ww2');
    expect(p.system).toContain('unknown');
    expect(JSON.parse(p.user)).toEqual([{ filmwebId: 1, title: 'Pianista', year: 2002, overview: 'Warszawa 1939' }]);
  });

  it('parses fenced JSON and keeps only valid, confident answers for requested ids', () => {
    const reply = 'Here you go:\n```json\n[' +
      '{"filmwebId":1,"eras":["ww2","1940s"],"confidence":0.9},' +
      '{"filmwebId":2,"eras":["unknown"],"confidence":0.9},' +
      '{"filmwebId":3,"eras":["future"],"confidence":0.3},' +
      '{"filmwebId":4,"eras":["jurassic"],"confidence":0.9},' +
      '{"filmwebId":99,"eras":["future"],"confidence":0.9},' +
      '{"filmwebId":1,"eras":["future"],"confidence":0.9}' +
      ']\n```';
    const r = parseEraResponse(reply, [1, 2, 3, 4]);
    expect(r.answers).toEqual([{ filmwebId: 1, eras: ['ww2', '1940s'], confidence: 0.9 }]);
    expect(r.rejected).toBe(3);
  });

  it('treats garbage as fully rejected without throwing', () => {
    expect(parseEraResponse('Sorry, I cannot help.', [1, 2])).toEqual({ answers: [], rejected: 2 });
    expect(parseEraResponse('[{"broken": ', [1])).toEqual({ answers: [], rejected: 1 });
  });
});
