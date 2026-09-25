import { expect, test } from 'vitest';
import { normalizeUrl } from './url';
test('normalizes websites and preserves browser protocols', () => { expect(normalizeUrl('example.com')).toBe('https://example.com/'); expect(normalizeUrl('about:blank')).toBe('about:blank'); expect(normalizeUrl('localhost:8080')).toBe('https://localhost:8080/'); });
test('rejects active content and control characters', () => { for (const v of ['javascript:alert(1)', 'data:text/html,x', 'java\nscript:x', '']) expect(() => normalizeUrl(v)).toThrow(); });
