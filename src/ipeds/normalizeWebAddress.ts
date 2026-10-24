/**
 * Turn an IPEDS WEBADDR value into a usable URL for world-universities.csv.
 *
 * - trims whitespace
 * - drops a `#fragment` (IPEDS has values such as `www.example.edu/tampa#location=Tampa, FL`)
 * - adds `http://` when no scheme is present, matching the file's existing convention
 *   (an `https://` value from IPEDS is kept as reported)
 *
 * @returns the URL, or `undefined` when the value is empty or is not a parseable http(s) URL.
 */
export function normalizeWebAddress(raw: string | undefined): string | undefined {
  if (!raw) return undefined;

  const withoutFragment = raw.split('#')[0].trim();
  if (!withoutFragment || /\s/.test(withoutFragment)) return undefined;

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(withoutFragment) ? withoutFragment : `http://${withoutFragment}`;

  try {
    const parsed = new URL(withScheme);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
    if (!parsed.hostname.includes('.')) return undefined;
  } catch {
    return undefined;
  }

  return withScheme;
}
