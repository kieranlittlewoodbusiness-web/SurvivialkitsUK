/**
 * S1-13b: PRICE_DISPLAY_ENABLED feature flag. Default OFF, fail-closed.
 *
 * Prices may render only when ALL of these hold:
 * - PRICE_DISPLAY_ENABLED is exactly 'true' (unset, 'false', 'TRUE', '1', ' true' => off);
 * - the build is a production link build (SITE_ENV=production and not a preview, the same rule
 *   as affiliate links: isProductionLinkBuild in src/lib/offers/affiliate.ts).
 * Dev, preview and Cloudflare branch builds are therefore always off.
 */
import { isProductionLinkBuild } from '../offers/affiliate';
import type { BuildEnv } from '../offers/types';

export const PRICE_DISPLAY_FLAG_ENV = 'PRICE_DISPLAY_ENABLED' as const;

export function isPriceDisplayEnabled(env: BuildEnv = defaultEnv()): boolean {
  if (env[PRICE_DISPLAY_FLAG_ENV] !== 'true') return false;
  try {
    return isProductionLinkBuild(env);
  } catch {
    // e.g. an unknown SITE_ENV: never enable prices on a misconfigured build.
    return false;
  }
}

function defaultEnv(): BuildEnv {
  const p = (globalThis as { process?: { env?: BuildEnv } }).process;
  return p?.env ?? {};
}
