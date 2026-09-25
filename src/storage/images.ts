export function sanitizeSvg(source: string): string {
  const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
  if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'svg') throw new Error('SVG 格式无效。');
  const elements = new Set(['svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'defs', 'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask', 'title', 'desc']);
  const attrs = new Set(['xmlns', 'viewBox', 'width', 'height', 'x', 'y', 'x1', 'x2', 'y1', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'fill-rule', 'clip-rule', 'opacity', 'fill-opacity', 'stroke-opacity', 'transform', 'id', 'offset', 'stop-color', 'stop-opacity', 'gradientUnits', 'gradientTransform', 'clip-path', 'mask']);
  for (const element of Array.from(doc.querySelectorAll('*'))) { if (!elements.has(element.localName)) { element.remove(); continue; } for (const attr of Array.from(element.attributes)) { if (!attrs.has(attr.name) || /(?:https?:|data:|javascript:|@import|expression|\\)/i.test(attr.value) || (/url\(/i.test(attr.value) && !/^url\(#[\w-]+\)$/.test(attr.value))) element.removeAttribute(attr.name); } }
  return new XMLSerializer().serializeToString(doc.documentElement);
}
export interface IconCrop { x: number; y: number; size: number }
export async function prepareImage(file: File, kind: 'icon' | 'wallpaper', crop?: IconCrop): Promise<Blob> {
  if (file.size > (kind === 'icon' ? 5 : 30) * 1024 * 1024) throw new Error(kind === 'icon' ? '图标不能超过 5 MB。' : '壁纸不能超过 30 MB。');
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type)) throw new Error('请选择 PNG、JPEG、WebP 或 SVG 图片。');
  const source = file.type === 'image/svg+xml' ? new Blob([sanitizeSvg(await file.text())], { type: 'image/svg+xml' }) : file;
  const url = URL.createObjectURL(source);
  try {
    const img = new Image(); img.src = url; await img.decode();
    const w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h || w * h > 80_000_000) throw new Error('图片尺寸无效或过大，请先缩小图片。');
    const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('浏览器无法处理图片。');
    if (kind === 'icon') { const size = crop?.size ?? Math.min(w, h); const x = crop?.x ?? (w - size) / 2; const y = crop?.y ?? (h - size) / 2; if (![size, x, y].every(Number.isFinite) || size <= 0 || x < 0 || y < 0 || x + size > w || y + size > h) throw new Error('裁剪区域无效。'); canvas.width = canvas.height = 128; ctx.drawImage(img, x, y, size, size, 0, 0, 128, 128); }
    else { const ratio = Math.min(1, 3840 / w, 2160 / h); canvas.width = Math.max(1, Math.round(w * ratio)); canvas.height = Math.max(1, Math.round(h * ratio)); ctx.drawImage(img, 0, 0, canvas.width, canvas.height); }
    return await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('图片编码失败。')), 'image/webp', 0.88));
  } catch (error) { throw new Error(`图片处理失败：${error instanceof Error ? error.message : String(error)}`); } finally { URL.revokeObjectURL(url); }
}
