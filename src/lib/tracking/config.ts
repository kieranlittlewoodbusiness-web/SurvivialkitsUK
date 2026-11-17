/**
 * WEB-ADS-1..4: the one place that reads the tracking IDs.
 *
 * The IDs come from build-time env (Cloudflare Pages project variables):
 *   PUBLIC_GA4_ID          Google Analytics 4 measurement ID, e.g. G-ABC123DEF4
 *   PUBLIC_GOOGLE_ADS_ID   Google Ads tag ID, e.g. AW-123456789
 *   PUBLIC_META_PIXEL_ID   Meta Pixel ID (digits only)
 *
 * Tracking is enabled only when at least one ID is set AND the build is a production build that is
 * not a preview (see isPreviewBuild). With no IDs, nothing renders: no consent banner, no
 * "Cookie settings" link, no tag code, and the footer/privacy/contact copy stays as it is today, so
 * the default build is byte-identical to the pre-tracking site. A malformed ID fails the build
 * rather than shipping a broken tag. The runtime adds a second gate: *.pages.dev never loads tags.
 *
 * Notes (CR nits):
 * - IDs are read from process.env only, so a local .env file does NOT enable tracking; set them as
 *   Cloudflare Pages build variables (or export them in the shell).
 * - "Production" means `astro build` (import.meta.env.PROD), not SITE_ENV=production: a local
 *   `npm run build` with IDs exported does enable tags. SITE_ENV=production is not required, so
 *   adding IDs to the Pages project cannot silently do nothing if SITE_ENV is unset there.
 */
import { isPreviewBuild } from '../../data/site';

type Env = Record<string, string | undefined>;

export interface TrackingConfig {
  enabled: boolean;
  ga4Id: string | null;
  adsId: string | null;
  pixelId: string | null;
  /** Analytics category offered (GA4 configured). */
  analytics: boolean;
  /** Advertising category offered (Google Ads or Meta Pixel configured). */
  advertising: boolean;
}

const FORMATS = {
  PUBLIC_GA4_ID: /^G-[A-Z0-9]{4,16}$/,
  PUBLIC_GOOGLE_ADS_ID: /^AW-\d{6,14}$/,
  PUBLIC_META_PIXEL_ID: /^\d{10,20}$/,
} as const;

type IdVar = keyof typeof FORMATS;

function readId(env: Env, name: IdVar): string | null {
  const raw = (env[name] ?? '').trim();
  if (raw === '') return null;
  if (!FORMATS[name].test(raw)) {
    throw new Error(`${name} has an unexpected format. Check the value in the Cloudflare Pages settings or leave it unset.`);
  }
  return raw;
}

const OFF: TrackingConfig = { enabled: false, ga4Id: null, adsId: null, pixelId: null, analytics: false, advertising: false };

/**
 * @param env build env (defaults to process.env)
 * @param opts.production true for `astro build` (import.meta.env.PROD); dev servers never load tags.
 */
export function trackingConfig(env: Env = process.env, opts: { production?: boolean } = {}): TrackingConfig {
  // Validate every ID first so a typo fails the build even on preview branches.
  const ga4Id = readId(env, 'PUBLIC_GA4_ID');
  const adsId = readId(env, 'PUBLIC_GOOGLE_ADS_ID');
  const pixelId = readId(env, 'PUBLIC_META_PIXEL_ID');
  if (!ga4Id && !adsId && !pixelId) return OFF;
  if (opts.production === false || isPreviewBuild(env)) return OFF;
  return { enabled: true, ga4Id, adsId, pixelId, analytics: !!ga4Id, advertising: !!(adsId || pixelId) };
}

/** Values handed to the inline runtime (src/lib/tracking/runtime.js). */
export function runtimeConfig(cfg: TrackingConfig) {
  return { ga4: cfg.ga4Id, ads: cfg.adsId, pixel: cfg.pixelId };
}

let cached: TrackingConfig | undefined;
/** Config for the current build (memoised; process.env is fixed for one build). */
export function siteTracking(): TrackingConfig {
  cached ??= trackingConfig(process.env, { production: import.meta.env.PROD });
  return cached;
}
