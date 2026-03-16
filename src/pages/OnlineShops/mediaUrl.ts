export function toAbsoluteMediaUrl(input?: string | null): string | null {
  if (!input) return null
  const url = String(input).trim()
  if (!url) return null
  if (/^(https?:|data:|blob:)/i.test(url)) return url
  if (url.startsWith('//')) return `https:${url}`
  if (url.startsWith('/')) return url
  return `/${url}`
}
