/**
 * Version string baked at build time. Vite will inline this from package.json.
 *
 * We avoid importing JSON directly so this works in both `tsc` (no resolveJson
 * import path), in tests, and in Vite. The value is replaced via Vite's
 * `define` config at build time; tests just see the literal default.
 */

declare const __APP_VERSION__: string;

export function getAppVersion(): string {
  try {
    return typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.1.0';
  } catch {
    return '0.1.0';
  }
}
