/**
 * Guards against open-redirect: only allow navigation to a same-app relative
 * path. Rejects absolute URLs, protocol-relative ("//evil.com"), and
 * anything else that could send a user off-site.
 */
export function safeInternalPath(path, fallback = '/home') {
  if (typeof path !== 'string' || path === '') return fallback
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return fallback
  if (path.includes('://')) return fallback
  return path
}
