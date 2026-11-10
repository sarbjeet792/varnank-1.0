export type CurrencyCode = 'INR' | 'USD';

export type PlanId = 'NONE' | 'FREE' | 'PASS_24H' | 'PRO_MONTHLY' | 'PREMIUM_ANNUAL';

export type EntitlementState =
  | 'NONE'
  | 'PENDING'
  | 'ACTIVE'
  | 'GRACE'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'REVOKED';

export type AdminCategory =
  | 'USER'
  | 'FINANCE'
  | 'SUPPORT'
  | 'CONTENT_PRESETS'
  | 'TOOLS_STUDIOS'
  | 'SECURITY_AUDIT'
  | 'INTEGRATIONS_VAULT'
  | 'OFFERS_PRICING'
  | 'SUPER_USER';

export type StudioId = 'S1' | 'S2' | 'S3' | 'S4';

export type OfferTemplateType =
  | 'PERCENTAGE'
  | 'FLAT_AMOUNT'
  | 'FIRST_PURCHASE'
  | 'SEASONAL'
  | 'FLASH_COUNTDOWN';

export interface CountryCurrencyEntry {
  countryCode: string;
  countryName: string;
  currency: CurrencyCode;
}

export interface PlanDefinition {
  id: PlanId;
  codeLabel: string;
  name: string;
  audienceLabel: string;
  durationHours: number;
  graceHours: number;
  maxDevices: number;
  dailyExportLimit: number; // -1 = unlimited
  batchLimit: number;
  unlocksPaidBundles: boolean;
  unlocksPremiumAutomation: boolean;
  prices: {
    INR: { baseMinor: number; slashedMinor: number; taxInclusive: boolean };
    USD: { baseMinor: number; slashedMinor: number; taxInclusive: boolean };
  };
  features: string[];
}

export interface OfferRule {
  id: string;
  templateType: OfferTemplateType;
  title: string;
  plainExplanation: string;
  badgeText: string;
  targetPlanIds: PlanId[];
  discountType: 'PERCENT' | 'FLAT';
  discountValueInrMinor: number; // if PERCENT, 1..90; if FLAT, minor units (paise)
  discountValueUsdMinor: number; // if PERCENT, 1..90; if FLAT, minor units (cents)
  firstPurchaseOnly: boolean;
  startsAt: string;
  endsAt: string;
  maxUses: number;
  currentUses: number;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'PUBLISHED' | 'PAUSED' | 'REVOKED';
}

export interface PriceQuoteResult {
  planId: PlanId;
  currency: CurrencyCode;
  listedSlashedMinor: number;
  baseMinor: number;
  offerDiscountMinor: number;
  finalMinor: number;
  taxMinor: number;
  netMinor: number;
  appliedOfferId: string | null;
  appliedOfferBadge: string | null;
  appliedOfferTitle: string | null;
  savingsPercent: number;
  honestyVerified: boolean;
}

export interface StudioToolDefinition {
  id: string;
  codeLabel: string;
  studioId: StudioId;
  name: string;
  plainDescription: string;
  tier: 'FREE' | 'PAID' | 'PREMIUM';
  bundleId: string | null;
}

export interface PresetDefinition {
  id: string;
  codeLabel: string;
  studioId: StudioId;
  category: 'SIZE' | 'TEMPLATE' | 'EXPORT_PROFILE';
  name: string;
  dimensionsLabel: string;
  widthPx: number;
  heightPx: number;
  dpi: number;
  bleedMm: number;
  tier: 'FREE' | 'PAID';
  isGlobal: boolean;
}

export const DEFAULT_COUNTRY_CURRENCY_TABLE: CountryCurrencyEntry[] = [
  { countryCode: '+91', countryName: 'India (+91)', currency: 'INR' },
  { countryCode: '+1', countryName: 'United States / Canada (+1)', currency: 'USD' },
  { countryCode: '+44', countryName: 'United Kingdom (+44)', currency: 'USD' },
  { countryCode: '+61', countryName: 'Australia (+61)', currency: 'USD' },
  { countryCode: '+65', countryName: 'Singapore (+65)', currency: 'USD' },
  { countryCode: '+971', countryName: 'United Arab Emirates (+971)', currency: 'USD' },
  { countryCode: '+49', countryName: 'Germany / EU (+49)', currency: 'USD' },
  { countryCode: '+81', countryName: 'Japan (+81)', currency: 'USD' },
  { countryCode: 'DEFAULT', countryName: 'Other International Regions', currency: 'USD' },
];

export const INITIAL_PLANS: Record<PlanId, PlanDefinition> = {
  NONE: {
    id: 'NONE',
    codeLabel: 'L0',
    name: 'Guest Access',
    audienceLabel: 'For quick single-file checks without an account',
    durationHours: 0,
    graceHours: 0,
    maxDevices: 1,
    dailyExportLimit: 5,
    batchLimit: 1,
    unlocksPaidBundles: false,
    unlocksPremiumAutomation: false,
    prices: {
      INR: { baseMinor: 0, slashedMinor: 0, taxInclusive: true },
      USD: { baseMinor: 0, slashedMinor: 0, taxInclusive: true },
    },
    features: [
      'Up to 5 single-file exports per day',
      'Core tools across all 4 Studios on your device',
      'Standard size & format presets',
      'Immediate memory cleanup when closing tab',
    ],
  },
  FREE: {
    id: 'FREE',
    codeLabel: 'L1',
    name: 'Freemium Account',
    audienceLabel: 'For everyday personal tasks with saved preferences',
    durationHours: 0,
    graceHours: 0,
    maxDevices: 2,
    dailyExportLimit: 20,
    batchLimit: 1,
    unlocksPaidBundles: false,
    unlocksPremiumAutomation: false,
    prices: {
      INR: { baseMinor: 0, slashedMinor: 0, taxInclusive: true },
      USD: { baseMinor: 0, slashedMinor: 0, taxInclusive: true },
    },
    features: [
      'Up to 20 single-file exports per day',
      'Save custom local presets on your device',
      'Local-only recent activity log with one-click clear',
      'Multi-language & theme preferences synced to profile',
    ],
  },
  PASS_24H: {
    id: 'PASS_24H',
    codeLabel: 'L2',
    name: 'Paid Per-Day Pass',
    audienceLabel: 'For urgent one-day ID sheets, redaction, or print jobs',
    durationHours: 24,
    graceHours: 0, // Strict zero grace for 24h pass
    maxDevices: 2,
    dailyExportLimit: -1,
    batchLimit: 20,
    unlocksPaidBundles: true,
    unlocksPremiumAutomation: false,
    prices: {
      INR: { baseMinor: 7900, slashedMinor: 9900, taxInclusive: true }, // ₹79 (slashed from ₹99)
      USD: { baseMinor: 249, slashedMinor: 299, taxInclusive: true }, // $2.49 (slashed from $2.99)
    },
    features: [
      '24-hour full access to all Paid Studio tools & presets',
      'Multi-copy ID & Passport print sheets (A4 / 4x6)',
      'Permanent PDF region redaction & metadata cleaner',
      'Batch processing up to 20 files at once on your device',
    ],
  },
  PRO_MONTHLY: {
    id: 'PRO_MONTHLY',
    codeLabel: 'L3',
    name: 'Paid Monthly Plan',
    audienceLabel: 'For regular creators, professionals, and shop operators',
    durationHours: 24 * 30,
    graceHours: 48, // 48h renewal grace
    maxDevices: 2,
    dailyExportLimit: -1,
    batchLimit: 50,
    unlocksPaidBundles: true,
    unlocksPremiumAutomation: false,
    prices: {
      INR: { baseMinor: 39900, slashedMinor: 49900, taxInclusive: true }, // ₹399 (slashed from ₹499)
      USD: { baseMinor: 799, slashedMinor: 999, taxInclusive: true }, // $7.99 (slashed from $9.99)
    },
    features: [
      '30-day unlimited exports across all 4 Studios',
      'All Paid tools: Batch up to 50 files, Redaction, Multi-ID sheets',
      'Print bleed, trim & crop marks for publication layouts',
      'Up to 2 active devices + downloadable tax invoices',
    ],
  },
  PREMIUM_ANNUAL: {
    id: 'PREMIUM_ANNUAL',
    codeLabel: 'L4',
    name: 'Premium Annual Plan',
    audienceLabel: 'For power users, studios, and publication workflows',
    durationHours: 24 * 365,
    graceHours: 48, // 48h renewal grace
    maxDevices: 4,
    dailyExportLimit: -1,
    batchLimit: 100,
    unlocksPaidBundles: true,
    unlocksPremiumAutomation: true,
    prices: {
      INR: { baseMinor: 249900, slashedMinor: 349900, taxInclusive: true }, // ₹2,499 (slashed from ₹3,499)
      USD: { baseMinor: 4999, slashedMinor: 6999, taxInclusive: true }, // $49.99 (slashed from $69.99)
    },
    features: [
      '365-day full access to every Paid & Premium tool bundle',
      'High-capacity batch mode (up to 100 files, device RAM guarded)',
      'Automated multi-slot publication & ID sheet imposition',
      'Up to 4 concurrent devices & priority support queue',
    ],
  },
};

export const INITIAL_OFFERS: OfferRule[] = [
  {
    id: 'OFFER-WELCOME-20',
    templateType: 'FIRST_PURCHASE',
    title: 'First-Purchase Welcome Savings',
    plainExplanation: 'Extra 20% off your first Paid Monthly or Premium Annual plan.',
    badgeText: 'Best value · Welcome offer',
    targetPlanIds: ['PRO_MONTHLY', 'PREMIUM_ANNUAL'],
    discountType: 'PERCENT',
    discountValueInrMinor: 20,
    discountValueUsdMinor: 20,
    firstPurchaseOnly: true,
    startsAt: '2026-01-01T00:00:00Z',
    endsAt: '2027-12-31T23:59:59Z',
    maxUses: 5000,
    currentUses: 142,
    status: 'PUBLISHED',
  },
  {
    id: 'OFFER-DAYPASS-FLAT',
    templateType: 'FLAT_AMOUNT',
    title: 'Instant Day-Pass Introductory Offer',
    plainExplanation: 'Save ₹30 (or $0.50) on a 24-Hour All-Studios Pass.',
    badgeText: 'Limited-time pass offer',
    targetPlanIds: ['PASS_24H'],
    discountType: 'FLAT',
    discountValueInrMinor: 3000, // ₹30 off ₹79 -> ₹49
    discountValueUsdMinor: 50, // $0.50 off $2.49 -> $1.99
    firstPurchaseOnly: false,
    startsAt: '2026-01-01T00:00:00Z',
    endsAt: '2027-12-31T23:59:59Z',
    maxUses: 10000,
    currentUses: 318,
    status: 'PUBLISHED',
  },
];

export const STUDIO_TOOLS: StudioToolDefinition[] = [
  // Studio S1: Photo/Image Studio
  {
    id: 'T1',
    codeLabel: 'T1',
    studioId: 'S1',
    name: 'Crop, Resize & Aspect Frame',
    plainDescription: 'Trim edges, set exact pixel or millimeter dimensions, and lock aspect ratios.',
    tier: 'FREE',
    bundleId: null,
  },
  {
    id: 'T2',
    codeLabel: 'T2',
    studioId: 'S1',
    name: 'Format Convert & Compress',
    plainDescription: 'Convert between PNG, JPEG, and WebP while controlling target file size.',
    tier: 'FREE',
    bundleId: null,
  },
  {
    id: 'T3',
    codeLabel: 'T3',
    studioId: 'S1',
    name: 'Tone, Contrast & Warmth Balance',
    plainDescription: 'Adjust brightness, contrast, saturation, and clean studio background lighting.',
    tier: 'FREE',
    bundleId: null,
  },
  {
    id: 'T4',
    codeLabel: 'T4',
    studioId: 'S1',
    name: 'Batch Image Processor & Watermark',
    plainDescription: 'Apply resizing, compression, and protective text marks across up to 100 files at once.',
    tier: 'PAID',
    bundleId: 'BUNDLE_S1_PRO_BATCH',
  },

  // Studio S2: PDF Studio
  {
    id: 'T5',
    codeLabel: 'T5',
    studioId: 'S2',
    name: 'Page Merge, Split & Reorder',
    plainDescription: 'Combine documents, extract specific page ranges, or rotate individual pages.',
    tier: 'FREE',
    bundleId: null,
  },
  {
    id: 'T6',
    codeLabel: 'T6',
    studioId: 'S2',
    name: 'Images to Clean Document',
    plainDescription: 'Place scanned pages or photos into a clean, standardized multi-page PDF.',
    tier: 'FREE',
    bundleId: null,
  },
  {
    id: 'T7',
    codeLabel: 'T7',
    studioId: 'S2',
    name: 'Permanent Region Redaction & Metadata Wipe',
    plainDescription: 'Black out confidential text/numbers permanently and strip hidden author metadata.',
    tier: 'PAID',
    bundleId: 'BUNDLE_S2_PRO_REDACT',
  },
  {
    id: 'T8',
    codeLabel: 'T8',
    studioId: 'S2',
    name: 'Batch Document Numbering & Stamping',
    plainDescription: 'Add sequential page numbers, date stamps, or approval labels across multiple PDFs.',
    tier: 'PAID',
    bundleId: 'BUNDLE_S2_PRO_STAMP',
  },

  // Studio S3: ID/Govt. ID Studio
  {
    id: 'T9',
    codeLabel: 'T9',
    studioId: 'S3',
    name: 'Standard ID & Passport Dimension Formatter',
    plainDescription: 'Align and crop to exact official size presets (35×45mm, 50×50mm, 25×35mm) with guide grid.',
    tier: 'FREE',
    bundleId: null,
  },
  {
    id: 'T10',
    codeLabel: 'T10',
    studioId: 'S3',
    name: 'Signature Strip & Contrast Cleaner',
    plainDescription: 'Format signature boxes (e.g. 60×20mm) with crisp ink contrast on a clean white backing.',
    tier: 'FREE',
    bundleId: null,
  },
  {
    id: 'T11',
    codeLabel: 'T11',
    studioId: 'S3',
    name: 'Multi-Copy ID Print Sheet (A4 & 4×6)',
    plainDescription: 'Generate ready-to-print 4-up, 8-up, or 16-up photo & signature sheets with scissor cut lines.',
    tier: 'PAID',
    bundleId: 'BUNDLE_S3_PRO_IDSHEET',
  },
  {
    id: 'T12',
    codeLabel: 'T12',
    studioId: 'S3',
    name: 'ID Document Privacy Masker (Selective Blur/Block)',
    plainDescription: 'Mask partial reference characters on ID scans before sharing copies, with auto-wipe on close.',
    tier: 'PAID',
    bundleId: 'BUNDLE_S3_PRO_MASK',
  },

  // Studio S4: Print & Publication Studio
  {
    id: 'T13',
    codeLabel: 'T13',
    studioId: 'S4',
    name: 'Publication Card & Notice Composer',
    plainDescription: 'Lay out structured cards, certificates, and flyers using clean typographic grids.',
    tier: 'FREE',
    bundleId: null,
  },
  {
    id: 'T14',
    codeLabel: 'T14',
    studioId: 'S4',
    name: 'Vector Emblem & Label Generator',
    plainDescription: 'Create geometric vector seals, monograms, and reference labels in crisp SVG or PNG.',
    tier: 'FREE',
    bundleId: null,
  },
  {
    id: 'T15',
    codeLabel: 'T15',
    studioId: 'S4',
    name: 'Print Bleed, Trim & Registration Marks',
    plainDescription: 'Export press-ready sheets with 3mm/5mm bleed margins, corner crop marks, and registration targets.',
    tier: 'PAID',
    bundleId: 'BUNDLE_S4_PRO_PRESS',
  },
  {
    id: 'T16',
    codeLabel: 'T16',
    studioId: 'S4',
    name: 'Multi-Slot Data Merge & Imposition Automation',
    plainDescription: 'Populate local CSV/table rows into multi-up print layouts in a single browser-side batch.',
    tier: 'PREMIUM',
    bundleId: 'BUNDLE_S4_PREMIUM_IMPOSE',
  },
];

export const INITIAL_PRESETS: PresetDefinition[] = [
  {
    id: 'P1',
    codeLabel: 'ID-P1',
    studioId: 'S3',
    category: 'SIZE',
    name: 'Standard Passport Size (35 × 45 mm)',
    dimensionsLabel: '35 × 45 mm · 300 DPI',
    widthPx: 413,
    heightPx: 531,
    dpi: 300,
    bleedMm: 0,
    tier: 'FREE',
    isGlobal: true,
  },
  {
    id: 'P2',
    codeLabel: 'ID-P2',
    studioId: 'S3',
    category: 'SIZE',
    name: 'Square Visa / Application Size (50 × 50 mm)',
    dimensionsLabel: '50 × 50 mm · 300 DPI',
    widthPx: 591,
    heightPx: 591,
    dpi: 300,
    bleedMm: 0,
    tier: 'FREE',
    isGlobal: true,
  },
  {
    id: 'P3',
    codeLabel: 'ID-P3',
    studioId: 'S3',
    category: 'SIZE',
    name: 'Official Signature Strip (60 × 20 mm)',
    dimensionsLabel: '60 × 20 mm · 300 DPI',
    widthPx: 709,
    heightPx: 236,
    dpi: 300,
    bleedMm: 0,
    tier: 'FREE',
    isGlobal: true,
  },
  {
    id: 'P4',
    codeLabel: 'ID-P4',
    studioId: 'S3',
    category: 'TEMPLATE',
    name: '4×6 Inch 8-Copy ID Print Sheet',
    dimensionsLabel: '102 × 152 mm · Cut Marks',
    widthPx: 1200,
    heightPx: 1800,
    dpi: 300,
    bleedMm: 2,
    tier: 'PAID',
    isGlobal: true,
  },
  {
    id: 'P5',
    codeLabel: 'Preset P5',
    studioId: 'S1',
    category: 'SIZE',
    name: 'Square Product & Catalog Frame (1200 × 1200 px)',
    dimensionsLabel: '1200 × 1200 px · 1:1',
    widthPx: 1200,
    heightPx: 1200,
    dpi: 150,
    bleedMm: 0,
    tier: 'FREE',
    isGlobal: true,
  },
  {
    id: 'P6',
    codeLabel: 'Preset P6',
    studioId: 'S2',
    category: 'EXPORT_PROFILE',
    name: 'Standard A4 Document Sheet (210 × 297 mm)',
    dimensionsLabel: '210 × 297 mm · Archival PDF',
    widthPx: 1240,
    heightPx: 1754,
    dpi: 150,
    bleedMm: 0,
    tier: 'FREE',
    isGlobal: true,
  },
  {
    id: 'P7',
    codeLabel: 'Preset P7',
    studioId: 'S4',
    category: 'TEMPLATE',
    name: 'A4 Publication Layout with 3mm Press Bleed',
    dimensionsLabel: '216 × 303 mm · 300 DPI + Crop Marks',
    widthPx: 1276,
    heightPx: 1790,
    dpi: 300,
    bleedMm: 3,
    tier: 'PAID',
    isGlobal: true,
  },
  {
    id: 'P8',
    codeLabel: 'Preset P8',
    studioId: 'S4',
    category: 'TEMPLATE',
    name: 'Two-Column Notice & Specification Broadsheet',
    dimensionsLabel: '1200 × 800 px · Editorial Grid',
    widthPx: 1200,
    heightPx: 800,
    dpi: 150,
    bleedMm: 0,
    tier: 'FREE',
    isGlobal: true,
  },
];

/**
 * Maps a selected country code to a locked currency (Section C).
 * Never detects IP, geolocation, or browser locale.
 */
export function resolveCurrencyFromCountryCode(
  countryCode: string,
  table: CountryCurrencyEntry[] = DEFAULT_COUNTRY_CURRENCY_TABLE
): { currency: CurrencyCode; countryName: string; explanation: string } {
  const normalized = countryCode.trim();
  const match =
    table.find((row) => row.countryCode === normalized) ||
    table.find((row) => row.countryCode === 'DEFAULT') || {
      countryCode: 'DEFAULT',
      countryName: 'International',
      currency: 'USD' as CurrencyCode,
    };

  const explanation = `Prices will be shown in ${match.currency} because you selected ${normalized || match.countryCode}. This is set for your account.`;
  return {
    currency: match.currency,
    countryName: match.countryName,
    explanation,
  };
}

/**
 * Formats minor units (paise or cents) into human-readable currency string.
 */
export function formatMinorCurrency(minorUnits: number, currency: CurrencyCode): string {
  const major = minorUnits / 100;
  if (currency === 'INR') {
    return major % 1 === 0 ? `₹${major.toLocaleString('en-IN')}` : `₹${major.toFixed(2)}`;
  }
  return `$${major.toFixed(2)}`;
}

/**
 * Computes authoritative server-side price for a plan in the user's locked currency,
 * validating offer eligibility and consumer-protection slashed-price honesty (Section O).
 */
export function computeServerPriceQuote(params: {
  plan: PlanDefinition;
  currency: CurrencyCode;
  offers: OfferRule[];
  selectedOfferId?: string | null;
  hasPriorPaidPurchase: boolean;
  nowIso?: string;
}): PriceQuoteResult {
  const { plan, currency, offers, selectedOfferId, hasPriorPaidPurchase } = params;
  const now = params.nowIso ? new Date(params.nowIso).getTime() : Date.now();

  const priceRow = plan.prices[currency];
  const baseMinor = priceRow.baseMinor;
  const listedSlashedMinor = Math.max(priceRow.slashedMinor, baseMinor);
  // Honesty check: slashed price must be >= base price and cannot be artificially inflated > 3x base
  const honestyVerified = listedSlashedMinor >= baseMinor && listedSlashedMinor <= baseMinor * 3;

  // Find eligible published offers for this plan
  const eligibleOffers = offers.filter((offer) => {
    if (offer.status !== 'PUBLISHED') return false;
    if (!offer.targetPlanIds.includes(plan.id)) return false;
    if (offer.firstPurchaseOnly && hasPriorPaidPurchase) return false;
    if (offer.maxUses > 0 && offer.currentUses >= offer.maxUses) return false;
    const start = new Date(offer.startsAt).getTime();
    const end = new Date(offer.endsAt).getTime();
    if (now < start || now > end) return false;
    return true;
  });

  const chosenOffer =
    (selectedOfferId
      ? eligibleOffers.find((o) => o.id === selectedOfferId)
      : eligibleOffers[0]) || null;

  let offerDiscountMinor = 0;
  if (chosenOffer && baseMinor > 0) {
    if (chosenOffer.discountType === 'PERCENT') {
      const pct =
        currency === 'INR' ? chosenOffer.discountValueInrMinor : chosenOffer.discountValueUsdMinor;
      const clampedPct = Math.min(Math.max(pct, 0), 90);
      offerDiscountMinor = Math.round((baseMinor * clampedPct) / 100);
    } else {
      const flat =
        currency === 'INR' ? chosenOffer.discountValueInrMinor : chosenOffer.discountValueUsdMinor;
      offerDiscountMinor = Math.min(Math.max(flat, 0), Math.max(0, baseMinor - 100));
    }
  }

  const finalMinor = Math.max(0, baseMinor - offerDiscountMinor);
  // Tax-inclusive calculation (18% GST for INR, standard inclusive tax breakdown)
  const taxRate = currency === 'INR' ? 0.18 : 0.0;
  const netMinor = taxRate > 0 ? Math.round(finalMinor / (1 + taxRate)) : finalMinor;
  const taxMinor = Math.max(0, finalMinor - netMinor);

  const totalReference = listedSlashedMinor > 0 ? listedSlashedMinor : baseMinor;
  const savingsPercent =
    totalReference > finalMinor
      ? Math.round(((totalReference - finalMinor) / totalReference) * 100)
      : 0;

  return {
    planId: plan.id,
    currency,
    listedSlashedMinor,
    baseMinor,
    offerDiscountMinor,
    finalMinor,
    taxMinor,
    netMinor,
    appliedOfferId: chosenOffer ? chosenOffer.id : null,
    appliedOfferBadge: chosenOffer ? chosenOffer.badgeText : null,
    appliedOfferTitle: chosenOffer ? chosenOffer.title : null,
    savingsPercent,
    honestyVerified,
  };
}

/**
 * Determines whether a user's current plan and state allow access to a gated bundle (Section E).
 * CRITICAL RULE: PENDING, NONE, EXPIRED, CANCELLED, REFUNDED, REVOKED NEVER unlock paid features.
 */
export function evaluateBundleEntitlement(params: {
  planId: PlanId;
  state: EntitlementState;
  expiresAtIso: string | null;
  graceEndsAtIso: string | null;
  requestedTier: 'FREE' | 'PAID' | 'PREMIUM';
  nowIso?: string;
}): { allowed: boolean; reason: string } {
  const { planId, state, expiresAtIso, graceEndsAtIso, requestedTier } = params;
  if (requestedTier === 'FREE') {
    return { allowed: true, reason: 'Free tool available in public bundle' };
  }

  // Only ACTIVE or approved GRACE can ever unlock paid/premium bundles
  if (state === 'PENDING') {
    return {
      allowed: false,
      reason: 'Payment verification is still in progress. Paid tools unlock only after confirmation.',
    };
  }

  if (state !== 'ACTIVE' && state !== 'GRACE') {
    return {
      allowed: false,
      reason: 'An active paid plan is required to open this tool.',
    };
  }

  const plan = INITIAL_PLANS[planId];
  if (!plan || !plan.unlocksPaidBundles) {
    return {
      allowed: false,
      reason: 'Your current plan does not include paid studio bundles.',
    };
  }

  if (requestedTier === 'PREMIUM' && !plan.unlocksPremiumAutomation) {
    return {
      allowed: false,
      reason: 'The Premium Annual Plan is required for this automation tool.',
    };
  }

  const now = params.nowIso ? new Date(params.nowIso).getTime() : Date.now();

  if (state === 'ACTIVE') {
    if (expiresAtIso && new Date(expiresAtIso).getTime() <= now) {
      return {
        allowed: false,
        reason: 'Your plan validity window has ended.',
      };
    }
    return { allowed: true, reason: 'Verified active plan entitlement' };
  }

  // GRACE state check: Paid Per-Day (PASS_24H) has 0 grace hours
  if (planId === 'PASS_24H' || plan.graceHours <= 0) {
    return {
      allowed: false,
      reason: 'Per-Day passes do not have a grace period after 24-hour expiry.',
    };
  }

  if (!graceEndsAtIso || new Date(graceEndsAtIso).getTime() <= now) {
    return {
      allowed: false,
      reason: 'Your renewal grace window has ended.',
    };
  }

  return { allowed: true, reason: 'Active within 48-hour renewal grace window' };
}

/**
 * Evaluates adaptive device memory limits (Category I).
 */
export function evaluateDeviceMemoryGuard(params: {
  fileSizeBytes: number;
  pageOrBatchCount: number;
  deviceMemoryGb?: number;
  isMobileViewport?: boolean;
}): { safe: boolean; maxRecommendedMb: number; plainWarning: string | null } {
  const isLowMem =
    (params.deviceMemoryGb !== undefined && params.deviceMemoryGb <= 4) ||
    Boolean(params.isMobileViewport);
  const maxRecommendedMb = isLowMem ? 50 : 250;
  const maxPages = isLowMem ? 100 : 500;
  const sizeMb = params.fileSizeBytes / (1024 * 1024);

  if (sizeMb > maxRecommendedMb) {
    return {
      safe: false,
      maxRecommendedMb,
      plainWarning: `This file (${sizeMb.toFixed(1)} MB) exceeds the safe memory limit (${maxRecommendedMb} MB) for your current device. Please pick a smaller file so your browser stays responsive.`,
    };
  }

  if (params.pageOrBatchCount > maxPages) {
    return {
      safe: false,
      maxRecommendedMb,
      plainWarning: `Processing ${params.pageOrBatchCount} items at once exceeds the recommended limit (${maxPages}) for your device memory.`,
    };
  }

  return {
    safe: true,
    maxRecommendedMb,
    plainWarning: null,
  };
}

/**
 * Category-isolated Admin RBAC authorization matrix (Section R).
 */
export const ADMIN_PORTAL_SLUGS: Record<Exclude<AdminCategory, 'USER'>, string> = {
  FINANCE: 'finance-ledger-v9',
  SUPPORT: 'support-desk-v9',
  CONTENT_PRESETS: 'content-presets-v9',
  TOOLS_STUDIOS: 'tools-studios-v9',
  SECURITY_AUDIT: 'security-audit-v9',
  INTEGRATIONS_VAULT: 'integrations-vault-v9',
  OFFERS_PRICING: 'offers-pricing-v9',
  SUPER_USER: 'super-authority-v9',
};

export type AdminPermissionAction =
  | 'VIEW_FINANCE_ORDERS'
  | 'ISSUE_REFUND'
  | 'MANAGE_SUPPORT_TICKETS'
  | 'VERIFY_RECOVERY_CHECKLIST'
  | 'APPROVE_RECOVERY_FINAL'
  | 'MANAGE_PRESETS_CONTENT'
  | 'MANAGE_STUDIOS_LIMITS'
  | 'VIEW_AUDIT_LOGS'
  | 'LOOKUP_ERROR_REF'
  | 'MANAGE_SECRETS_VAULT'
  | 'MANAGE_OFFERS_PRICING'
  | 'MANAGE_COUNTRY_CURRENCY'
  | 'GRANT_ADMIN_ROLES'
  | 'TRIGGER_KILL_SWITCH';

const ROLE_PERMISSIONS: Record<AdminCategory, AdminPermissionAction[]> = {
  USER: [],
  FINANCE: ['VIEW_FINANCE_ORDERS', 'ISSUE_REFUND'],
  SUPPORT: ['MANAGE_SUPPORT_TICKETS', 'VERIFY_RECOVERY_CHECKLIST', 'LOOKUP_ERROR_REF'],
  CONTENT_PRESETS: ['MANAGE_PRESETS_CONTENT'],
  TOOLS_STUDIOS: ['MANAGE_STUDIOS_LIMITS'],
  SECURITY_AUDIT: ['VIEW_AUDIT_LOGS', 'LOOKUP_ERROR_REF'],
  INTEGRATIONS_VAULT: ['MANAGE_SECRETS_VAULT'],
  OFFERS_PRICING: ['MANAGE_OFFERS_PRICING', 'MANAGE_COUNTRY_CURRENCY'],
  SUPER_USER: [
    'VIEW_FINANCE_ORDERS',
    'ISSUE_REFUND',
    'MANAGE_SUPPORT_TICKETS',
    'VERIFY_RECOVERY_CHECKLIST',
    'APPROVE_RECOVERY_FINAL',
    'MANAGE_PRESETS_CONTENT',
    'MANAGE_STUDIOS_LIMITS',
    'VIEW_AUDIT_LOGS',
    'LOOKUP_ERROR_REF',
    'MANAGE_SECRETS_VAULT',
    'MANAGE_OFFERS_PRICING',
    'MANAGE_COUNTRY_CURRENCY',
    'GRANT_ADMIN_ROLES',
    'TRIGGER_KILL_SWITCH',
  ],
};

export function authorizeAdminAction(params: {
  actorRole: AdminCategory;
  sessionMfaVerified: boolean;
  action: AdminPermissionAction;
}): { authorized: boolean; status: 200 | 403 | 404 } {
  if (params.actorRole === 'USER') {
    return { authorized: false, status: 404 }; // Hide admin existence from regular users
  }
  if (!params.sessionMfaVerified) {
    return { authorized: false, status: 403 }; // Mandatory Passkey + MFA for all admins
  }
  const allowed = ROLE_PERMISSIONS[params.actorRole]?.includes(params.action) ?? false;
  return {
    authorized: allowed,
    status: allowed ? 200 : 403,
  };
}
