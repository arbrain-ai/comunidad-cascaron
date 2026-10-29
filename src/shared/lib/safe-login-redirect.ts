/** A login destination is a local page, never executable text or an authority. */
export function safeLoginRedirect(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2048 || !value.startsWith('/') ||
      value.startsWith('//') || /[\\\u0000-\u0020\u007f]/.test(value)) return '/community';
  try {
    const url = new URL(value, 'https://login.invalid');
    let path = url.pathname;
    for (let i = 0; i < 3; i++) path = decodeURIComponent(path);
    if (url.origin !== 'https://login.invalid' || path.startsWith('//') ||
        /[\\\u0000-\u0020\u007f%]/.test(path) ||
        /^\/(?:api|login|go)(?:\/|$)/i.test(path) ||
        (/^\/auth(?:\/|$)/i.test(path) && path !== '/auth/mfa')) return '/community';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return '/community'; }
}
