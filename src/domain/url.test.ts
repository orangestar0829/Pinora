import { expect, test } from "vitest";
import { normalizeUrl, safeHref } from "./url";
test("normalizes websites and preserves browser protocols", () => {
  expect(normalizeUrl("example.com")).toBe("https://example.com/");
  expect(normalizeUrl("about:blank")).toBe("about:blank");
  expect(normalizeUrl("localhost:8080")).toBe("https://localhost:8080/");
});
test.each([
  ["example.com:8080?x=1", "https://example.com:8080/?x=1"],
  ["example.com:8080#frag", "https://example.com:8080/#frag"],
  ["localhost:8080?x=1#frag", "https://localhost:8080/?x=1#frag"],
  ["[::1]:8080?x=1", "https://[::1]:8080/?x=1"],
  [
    "https://user:pass@example.com:8080?x=1",
    "https://user:pass@example.com:8080/?x=1",
  ],
])("normalizes host-port boundaries: %s", (input, expected) => {
  expect(normalizeUrl(input)).toBe(expected);
});
test("host-port handling preserves scheme validation and rejects malformed ports", () => {
  for (const input of [
    "javascript:alert(1)#x",
    "data:text/html,x",
    "vbscript:msgbox(1)",
    "example.com:99999?x=1",
    "example.com:8080x?x=1",
  ]) {
    expect(() => normalizeUrl(input)).toThrow();
    expect(safeHref(input)).toBe("#");
  }
});
test("rejects active content and control characters", () => {
  for (const v of [
    "javascript:alert(1)",
    "data:text/html,x",
    "java\nscript:x",
    "",
  ])
    expect(() => normalizeUrl(v)).toThrow();
});
