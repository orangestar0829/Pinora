const allowed = new Set([
  "http:",
  "https:",
  "chrome:",
  "edge:",
  "about:",
  "file:",
  "mailto:",
  "ftp:",
]);
export function normalizeUrl(input: string): string {
  const value = input.trim();
  if (
    !value ||
    [...value].some(
      (char) => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127,
    )
  )
    throw new Error("请输入有效的网址（不能包含空白或控制字符）。");
  const explicit =
    /^[a-z][a-z\d+.-]*:/i.test(value) && !/^[\w.-]+:\d+(\/|$)/.test(value);
  let url: URL;
  try {
    url = new URL(explicit ? value : `https://${value}`);
  } catch {
    throw new Error("网址格式无效。");
  }
  if (!allowed.has(url.protocol))
    throw new Error(`不支持或不安全的网址协议：${url.protocol}`);
  return url.href;
}
export function hostname(url?: string): string {
  try {
    return url ? new URL(url).hostname : "";
  } catch {
    return "";
  }
}
// Keep native link affordances without exposing executable bookmark schemes.
export function safeHref(url?: string): string {
  try {
    return url ? normalizeUrl(url) : "#";
  } catch {
    return "#";
  }
}
