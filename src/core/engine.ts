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
  | 'DEVELOPER'
  | 'QA_TESTER'
  | 'SUPER_USER';

export type StudioId = 'S1' | 'S2' | 'S3' | 'S4';

export type ExportFormatCode = 'PNG' | 'JPEG' | 'WEBP' | 'SVG' | 'PDF' | 'ZIP';

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
  batchLimit: number; // max files in batch/ZIP
  maxExportQualityPct: number; // 80..100
  maxExportDpi: number; // 150, 300, 600
  maxResolutionPx: number; // max canvas width/height px
  maxIdSheetCopies: 1 | 4 | 8 | 16;
  allowedFormats: ExportFormatCode[];
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
  enabled?: boolean;
}

export interface PresetDefinition {
  id: string;
  codeLabel: string;
  studioId: StudioId;
  applicableToolIds?: string[];
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
    codeLabel: 'Guest',
    name: 'Guest Access',
    audienceLabel: 'For quick single-file checks without an account',
    durationHours: 0,
    graceHours: 0,
    maxDevices: 1,
    dailyExportLimit: 3, // Strictly 3 files per day for Free/Guest
    batchLimit: 1,
    maxExportQualityPct: 80,
    maxExportDpi: 150,
    maxResolutionPx: 1200,
    maxIdSheetCopies: 1,
    allowedFormats: ['PNG', 'JPEG'],
    unlocksPaidBundles: false,
    unlocksPremiumAutomation: false,
    prices: {
      INR: { baseMinor: 0, slashedMinor: 0, taxInclusive: true },
      USD: { baseMinor: 0, slashedMinor: 0, taxInclusive: true },
    },
    features: [
      'Strictly 3 single-file exports per day (PNG / JPEG)',
      'Explore paid/premium studio features with sample watermark (80% · 72 DPI)',
      'Core free tools across all 4 Studios on your device',
      'Immediate memory cleanup when closing tab',
    ],
  },
  FREE: {
    id: 'FREE',
    codeLabel: 'Free',
    name: 'Freemium Account',
    audienceLabel: 'For everyday personal tasks with saved preferences',
    durationHours: 0,
    graceHours: 0,
    maxDevices: 2,
    dailyExportLimit: 3, // Strictly 3 files per day for Free/Freemium
    batchLimit: 1,
    maxExportQualityPct: 85,
    maxExportDpi: 150,
    maxResolutionPx: 1600,
    maxIdSheetCopies: 1,
    allowedFormats: ['PNG', 'JPEG', 'WEBP', 'PDF'],
    unlocksPaidBundles: false,
    unlocksPremiumAutomation: false,
    prices: {
      INR: { baseMinor: 0, slashedMinor: 0, taxInclusive: true },
      USD: { baseMinor: 0, slashedMinor: 0, taxInclusive: true },
    },
    features: [
      'Strictly 3 single-file exports per day (PNG, JPEG, WebP, PDF)',
      'Check & analyze watermarked paid samples capped at 80% quality · 72 DPI',
      'Save custom local presets on your device',
      'Multi-language & theme preferences synced to profile',
    ],
  },
  PASS_24H: {
    id: 'PASS_24H',
    codeLabel: 'Day Pass',
    name: 'Paid Per-Day Pass',
    audienceLabel: 'For urgent one-day ID sheets, redaction, or print jobs',
    durationHours: 24,
    graceHours: 0, // Strict zero grace for 24h pass
    maxDevices: 2,
    dailyExportLimit: -1,
    batchLimit: 25,
    maxExportQualityPct: 95,
    maxExportDpi: 300,
    maxResolutionPx: 2400,
    maxIdSheetCopies: 8,
    allowedFormats: ['PNG', 'JPEG', 'WEBP', 'SVG', 'PDF', 'ZIP'],
    unlocksPaidBundles: true,
    unlocksPremiumAutomation: false,
    prices: {
      INR: { baseMinor: 7900, slashedMinor: 9900, taxInclusive: true }, // ₹79 (slashed from ₹99)
      USD: { baseMinor: 249, slashedMinor: 299, taxInclusive: true }, // $2.49 (slashed from $2.99)
    },
    features: [
      '24-hour unlimited exports across PNG, JPEG, WebP, SVG, PDF & ZIP',
      'High-definition 95% quality · 300 DPI print output · 2400px max',
      'Multi-copy ID & Passport print sheets (up to 8-up on A4 / 4×6)',
      'Permanent PDF redaction + Batch ZIP up to 25 files at once',
    ],
  },
  PRO_MONTHLY: {
    id: 'PRO_MONTHLY',
    codeLabel: 'Monthly',
    name: 'Paid Monthly Plan',
    audienceLabel: 'For regular creators, professionals, and shop operators',
    durationHours: 24 * 30,
    graceHours: 48, // 48h renewal grace
    maxDevices: 2,
    dailyExportLimit: -1,
    batchLimit: 50,
    maxExportQualityPct: 100,
    maxExportDpi: 300,
    maxResolutionPx: 3600,
    maxIdSheetCopies: 16,
    allowedFormats: ['PNG', 'JPEG', 'WEBP', 'SVG', 'PDF', 'ZIP'],
    unlocksPaidBundles: true,
    unlocksPremiumAutomation: false,
    prices: {
      INR: { baseMinor: 39900, slashedMinor: 49900, taxInclusive: true }, // ₹399 (slashed from ₹499)
      USD: { baseMinor: 799, slashedMinor: 999, taxInclusive: true }, // $7.99 (slashed from $9.99)
    },
    features: [
      '30-day unlimited lossless 100% quality · 300 DPI · 3600px max',
      'All Paid tools: Batch ZIP up to 50 files, Redaction, 16-up ID sheets',
      'Print bleed (3mm/5mm), trim & crop marks for publication layouts',
      'Up to 2 active devices + downloadable GST/Tax invoices',
    ],
  },
  PREMIUM_ANNUAL: {
    id: 'PREMIUM_ANNUAL',
    codeLabel: 'Annual',
    name: 'Premium Annual Plan',
    audienceLabel: 'For power users, studios, and publication workflows',
    durationHours: 24 * 365,
    graceHours: 48, // 48h renewal grace
    maxDevices: 4,
    dailyExportLimit: -1,
    batchLimit: 100,
    maxExportQualityPct: 100,
    maxExportDpi: 600,
    maxResolutionPx: 4800,
    maxIdSheetCopies: 16,
    allowedFormats: ['PNG', 'JPEG', 'WEBP', 'SVG', 'PDF', 'ZIP'],
    unlocksPaidBundles: true,
    unlocksPremiumAutomation: true,
    prices: {
      INR: { baseMinor: 249900, slashedMinor: 349900, taxInclusive: true }, // ₹2,499 (slashed from ₹3,499)
      USD: { baseMinor: 4999, slashedMinor: 6999, taxInclusive: true }, // $49.99 (slashed from $69.99)
    },
    features: [
      '365-day full access to every Paid & Premium tool bundle',
      'Archival 100% lossless master · up to 600 DPI · 4800px max',
      'High-capacity batch mode (up to 100 files) & 16-up imposition',
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
  // Photo / Image Studio (6 Tools)
  {
    id: 'T1',
    codeLabel: 'Photo Tool',
    studioId: 'S1',
    name: 'Crop, Resize & Aspect Frame',
    plainDescription: 'Trim edges, set exact pixel or millimeter dimensions, and lock aspect ratios.',
    tier: 'FREE',
    bundleId: null,
    enabled: true,
  },
  {
    id: 'T2',
    codeLabel: 'Photo Tool',
    studioId: 'S1',
    name: 'Format Convert & Smart Compress',
    plainDescription: 'Convert between PNG, JPEG, and WebP while controlling target file size.',
    tier: 'FREE',
    bundleId: null,
    enabled: true,
  },
  {
    id: 'T3',
    codeLabel: 'Photo Tool',
    studioId: 'S1',
    name: 'Tone, Contrast & Warmth Balance',
    plainDescription: 'Adjust brightness, contrast, saturation, and clean studio background lighting.',
    tier: 'FREE',
    bundleId: null,
    enabled: true,
  },
  {
    id: 'T4',
    codeLabel: 'Photo Tool',
    studioId: 'S1',
    name: 'Batch Image Processor & Watermark',
    plainDescription: 'Apply resizing, compression, and protective text marks across up to 100 files at once.',
    tier: 'PAID',
    bundleId: 'BUNDLE_S1_PRO_BATCH',
    enabled: true,
  },
  {
    id: 'T17',
    codeLabel: 'Photo Tool',
    studioId: 'S1',
    name: 'EXIF & GPS Privacy Scrubber',
    plainDescription: 'Strip hidden camera serials, timestamps, and GPS coordinates locally before export.',
    tier: 'FREE',
    bundleId: null,
    enabled: true,
  },
  {
    id: 'T18',
    codeLabel: 'Photo Tool',
    studioId: 'S1',
    name: '600 DPI Archival Upscale & Border Frame',
    plainDescription: 'Render gallery-grade bordered frames with 300–600 DPI metadata and custom matte margins.',
    tier: 'PAID',
    bundleId: 'BUNDLE_S1_PRO_ARCHIVAL',
    enabled: true,
  },

  // PDF Studio (6 Tools)
  {
    id: 'T5',
    codeLabel: 'PDF Tool',
    studioId: 'S2',
    name: 'Page Merge, Split & Reorder',
    plainDescription: 'Combine documents, extract specific page ranges, or rotate individual pages.',
    tier: 'FREE',
    bundleId: null,
    enabled: true,
  },
  {
    id: 'T6',
    codeLabel: 'PDF Tool',
    studioId: 'S2',
    name: 'Images to Clean Document',
    plainDescription: 'Place scanned pages or photos into a clean, standardized multi-page PDF.',
    tier: 'FREE',
    bundleId: null,
    enabled: true,
  },
  {
    id: 'T19',
    codeLabel: 'PDF Tool',
    studioId: 'S2',
    name: 'Document Margin & Page Size Standardizer',
    plainDescription: 'Normalize mixed page sizes into uniform A4, US Letter, or Legal margins.',
    tier: 'FREE',
    bundleId: null,
    enabled: true,
  },
  {
    id: 'T7',
    codeLabel: 'PDF Tool',
    studioId: 'S2',
    name: 'Permanent Region Redaction & Metadata Wipe',
    plainDescription: 'Black out confidential text/numbers permanently and strip hidden author metadata.',
    tier: 'PAID',
    bundleId: 'BUNDLE_S2_PRO_REDACT',
    enabled: true,
  },
  {
    id: 'T8',
    codeLabel: 'PDF Tool',
    studioId: 'S2',
    name: 'Batch Document Numbering & Stamping',
    plainDescription: 'Add sequential page numbers, date stamps, or approval labels across multiple PDFs.',
    tier: 'PAID',
    bundleId: 'BUNDLE_S2_PRO_STAMP',
    enabled: true,
  },
  {
    id: 'T20',
    codeLabel: 'PDF Tool',
    studioId: 'S2',
    name: 'Archival Flatten & Tamper-Seal Stamp',
    plainDescription: 'Flatten interactive layers into a single locked rasterized archival PDF sheet.',
    tier: 'PREMIUM',
    bundleId: 'BUNDLE_S2_PREMIUM_FLATTEN',
    enabled: true,
  },

  // ID / Govt. ID Studio (6 Tools)
  {
    id: 'T9',
    codeLabel: 'ID Tool',
    studioId: 'S3',
    name: 'Standard ID & Passport Dimension Formatter',
    plainDescription: 'Align and crop to exact official size presets (35×45mm, 50×50mm, 25×35mm) with guide grid.',
    tier: 'FREE',
    bundleId: null,
    enabled: true,
  },
  {
    id: 'T10',
    codeLabel: 'ID Tool',
    studioId: 'S3',
    name: 'Signature Strip & Contrast Cleaner',
    plainDescription: 'Format signature boxes (e.g. 60×20mm) with crisp ink contrast on a clean white backing.',
    tier: 'FREE',
    bundleId: null,
    enabled: true,
  },
  {
    id: 'T21',
    codeLabel: 'ID Tool',
    studioId: 'S3',
    name: 'Strict KB Target Size Compressor (20KB–50KB)',
    plainDescription: 'Target exact portal upload file-size rules (e.g. 20KB–50KB JPEG) locally on your device.',
    tier: 'FREE',
    bundleId: null,
    enabled: true,
  },
  {
    id: 'T11',
    codeLabel: 'ID Tool',
    studioId: 'S3',
    name: 'Multi-Copy ID Print Sheet (A4 & 4×6)',
    plainDescription: 'Generate ready-to-print 4-up, 8-up, or 16-up photo & signature sheets with scissor cut lines.',
    tier: 'PAID',
    bundleId: 'BUNDLE_S3_PRO_IDSHEET',
    enabled: true,
  },
  {
    id: 'T12',
    codeLabel: 'ID Tool',
    studioId: 'S3',
    name: 'ID Document Privacy Masker (Selective Blur/Block)',
    plainDescription: 'Mask partial reference characters on ID scans before sharing copies, with auto-wipe on close.',
    tier: 'PAID',
    bundleId: 'BUNDLE_S3_PRO_MASK',
    enabled: true,
  },
  {
    id: 'T22',
    codeLabel: 'ID Tool',
    studioId: 'S3',
    name: 'Combo Photo + Signature Portal Sheet Builder',
    plainDescription: 'Combine aligned ID portrait frame and signature strip into a single compliant submission card.',
    tier: 'PAID',
    bundleId: 'BUNDLE_S3_PRO_COMBO',
    enabled: true,
  },

  // Print & Publication Studio (6 Tools)
  {
    id: 'T13',
    codeLabel: 'Print Tool',
    studioId: 'S4',
    name: 'Publication Card & Notice Composer',
    plainDescription: 'Lay out structured cards, certificates, and flyers using clean typographic grids.',
    tier: 'FREE',
    bundleId: null,
    enabled: true,
  },
  {
    id: 'T14',
    codeLabel: 'Print Tool',
    studioId: 'S4',
    name: 'Vector Emblem & Label Generator',
    plainDescription: 'Create geometric vector seals, monograms, and reference labels in crisp SVG or PNG.',
    tier: 'FREE',
    bundleId: null,
    enabled: true,
  },
  {
    id: 'T23',
    codeLabel: 'Print Tool',
    studioId: 'S4',
    name: 'Spine, Fold & Gutter Margin Calculator',
    plainDescription: 'Preview booklet fold lines, spine width, and safe inner gutter margins on canvas.',
    tier: 'FREE',
    bundleId: null,
    enabled: true,
  },
  {
    id: 'T15',
    codeLabel: 'Print Tool',
    studioId: 'S4',
    name: 'Print Bleed, Trim & Registration Marks',
    plainDescription: 'Export press-ready sheets with 3mm/5mm bleed margins, corner crop marks, and registration targets.',
    tier: 'PAID',
    bundleId: 'BUNDLE_S4_PRO_PRESS',
    enabled: true,
  },
  {
    id: 'T24',
    codeLabel: 'Print Tool',
    studioId: 'S4',
    name: 'High-DPI Vector SVG & CMYK Proof Sheet',
    plainDescription: 'Export scalable vector SVG layouts and 300/600 DPI press proof sheets with color bars.',
    tier: 'PAID',
    bundleId: 'BUNDLE_S4_PRO_SVG',
    enabled: true,
  },
  {
    id: 'T16',
    codeLabel: 'Print Tool',
    studioId: 'S4',
    name: 'Multi-Slot Data Merge & Imposition Automation',
    plainDescription: 'Populate local CSV/table rows into multi-up print layouts in a single browser-side batch.',
    tier: 'PREMIUM',
    bundleId: 'BUNDLE_S4_PREMIUM_IMPOSE',
    enabled: true,
  },
];

export const INITIAL_PRESETS: PresetDefinition[] = [
  // ID / Govt. ID Studio Presets (Contextually linked to specific ID tools)
  {
    id: 'P1',
    codeLabel: 'Passport Size',
    studioId: 'S3',
    applicableToolIds: ['T9', 'T22'],
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
    codeLabel: 'Visa Size',
    studioId: 'S3',
    applicableToolIds: ['T9'],
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
    codeLabel: 'Signature Strip',
    studioId: 'S3',
    applicableToolIds: ['T10', 'T22'],
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
    codeLabel: '8-Copy Sheet',
    studioId: 'S3',
    applicableToolIds: ['T11', 'T22'],
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
    id: 'P9',
    codeLabel: 'Stamp Size',
    studioId: 'S3',
    applicableToolIds: ['T9'],
    category: 'SIZE',
    name: 'PAN / Exam Portal Stamp Size (25 × 35 mm)',
    dimensionsLabel: '25 × 35 mm · 300 DPI',
    widthPx: 295,
    heightPx: 413,
    dpi: 300,
    bleedMm: 0,
    tier: 'FREE',
    isGlobal: true,
  },
  {
    id: 'P10',
    codeLabel: '16-Copy Sheet',
    studioId: 'S3',
    applicableToolIds: ['T11'],
    category: 'TEMPLATE',
    name: 'A4 16-Copy Studio ID Master Sheet',
    dimensionsLabel: '210 × 297 mm · 16-Up Cut Grid',
    widthPx: 1600,
    heightPx: 2260,
    dpi: 300,
    bleedMm: 3,
    tier: 'PAID',
    isGlobal: true,
  },

  // Photo / Image Studio Presets (Contextually linked to framing, batch, and archival tools)
  {
    id: 'P5',
    codeLabel: 'Square Frame',
    studioId: 'S1',
    applicableToolIds: ['T1', 'T4'],
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
    id: 'P11',
    codeLabel: 'Widescreen',
    studioId: 'S1',
    applicableToolIds: ['T1', 'T4'],
    category: 'SIZE',
    name: 'Widescreen Editorial Cover (1600 × 900 px)',
    dimensionsLabel: '1600 × 900 px · 16:9',
    widthPx: 1600,
    heightPx: 900,
    dpi: 150,
    bleedMm: 0,
    tier: 'FREE',
    isGlobal: true,
  },
  {
    id: 'P12',
    codeLabel: 'Archival Print',
    studioId: 'S1',
    applicableToolIds: ['T18'],
    category: 'EXPORT_PROFILE',
    name: 'High-Resolution Archival Print Master (2400 × 1800 px)',
    dimensionsLabel: '2400 × 1800 px · 300 DPI Lossless',
    widthPx: 2400,
    heightPx: 1800,
    dpi: 300,
    bleedMm: 2,
    tier: 'PAID',
    isGlobal: true,
  },

  // PDF Studio Presets (Contextually linked to document page setup, redaction, and archival tools)
  {
    id: 'P6',
    codeLabel: 'A4 Document',
    studioId: 'S2',
    applicableToolIds: ['T6', 'T19'],
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
    id: 'P13',
    codeLabel: 'US Letter',
    studioId: 'S2',
    applicableToolIds: ['T6', 'T19'],
    category: 'SIZE',
    name: 'US Letter Compliance Sheet (8.5 × 11 in)',
    dimensionsLabel: '216 × 279 mm · 150 DPI',
    widthPx: 1275,
    heightPx: 1650,
    dpi: 150,
    bleedMm: 0,
    tier: 'FREE',
    isGlobal: true,
  },
  {
    id: 'P14',
    codeLabel: 'Legal Brief',
    studioId: 'S2',
    applicableToolIds: ['T7', 'T20'],
    category: 'EXPORT_PROFILE',
    name: 'Redacted Legal Filing Brief (300 DPI Flattened)',
    dimensionsLabel: '210 × 356 mm · 300 DPI Redaction Ready',
    widthPx: 1400,
    heightPx: 2100,
    dpi: 300,
    bleedMm: 0,
    tier: 'PAID',
    isGlobal: true,
  },

  // Print & Publication Studio Presets (Contextually linked to composer, bleed, SVG proof, and imposition tools)
  {
    id: 'P7',
    codeLabel: 'A4 Press Bleed',
    studioId: 'S4',
    applicableToolIds: ['T15', 'T16'],
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
    codeLabel: 'Broadsheet Grid',
    studioId: 'S4',
    applicableToolIds: ['T13'],
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
  {
    id: 'P15',
    codeLabel: 'Business Card',
    studioId: 'S4',
    applicableToolIds: ['T13'],
    category: 'SIZE',
    name: 'Standard Business & Membership Card (90 × 55 mm)',
    dimensionsLabel: '90 × 55 mm · 300 DPI',
    widthPx: 1063,
    heightPx: 650,
    dpi: 300,
    bleedMm: 0,
    tier: 'FREE',
    isGlobal: true,
  },
  {
    id: 'P16',
    codeLabel: 'Certificate',
    studioId: 'S4',
    applicableToolIds: ['T15', 'T24'],
    category: 'EXPORT_PROFILE',
    name: 'Press-Ready Certificate with 5mm Bleed & Trim Marks',
    dimensionsLabel: '297 × 210 mm · 600 DPI Vector/Print',
    widthPx: 1800,
    heightPx: 1270,
    dpi: 600,
    bleedMm: 5,
    tier: 'PAID',
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
  plansMap?: Record<PlanId, PlanDefinition>;
  nowIso?: string;
}): { allowed: boolean; reason: string } {
  const { planId, state, expiresAtIso, graceEndsAtIso, requestedTier } = params;
  const catalog = params.plansMap || INITIAL_PLANS;

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

  const plan = catalog[planId];
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

export type StudioActionType =
  | 'PREVIEW'
  | 'SAMPLE_EXPLORE'
  | 'EXPORT'
  | 'BATCH_EXPORT'
  | 'PRINT'
  | 'SHARE'
  | string;

export interface PlanProfessionalFeatureAccess {
  paidToolsAccess: boolean;
  premiumAutomationAccess: boolean;
  highDpiPrintAccess: boolean; // 300+ DPI print/press output
  archival600DpiAccess: boolean; // 600 DPI archival master
  losslessQualityAccess: boolean; // 95–100% quality
  batchProcessingAccess: boolean; // 25+ batch file limit
  vectorSvgAndZipAccess: boolean; // SVG & ZIP archive export
  multiCopyIdSheetAccess: boolean; // 4-up, 8-up, 16-up ID print sheets
  permanentRedactionAccess: boolean; // Permanent PDF/ID redaction mask
  pressBleedAndCropMarksAccess: boolean; // 3mm/5mm print bleed & crop marks
  customWatermarkStampAccess: boolean; // Batch watermark/stamp label
}

export interface PlanFeatureAccessFlags {
  paidTools: boolean;
  premiumAutomation: boolean;
  sampleExplorationAllowed: boolean; // Free/Freemium users can check/analyze/explore samples & paid features
  watermarkSampleOutput: boolean; // True when Free/Freemium users preview/export paid/sample features
  highDpiPrint: boolean; // 300 DPI vs 72 DPI
  losslessQuality: boolean; // 100% vs 80%
  batchProcessing: boolean; // 25+ vs 1
  vectorSvgAndZip: boolean;
  multiCopyIdSheet: boolean;
  permanentRedaction: boolean;
  pressBleedAndCropMarks: boolean;
  customWatermarkStamp: boolean;
  studioProFeaturesUnlocked: boolean;
}

export interface PlanCapabilityValidationInput {
  planId: PlanId;
  studioId?: StudioId;
  actionType?: StudioActionType;
  state?: EntitlementState | string;
  requestedFormat?: ExportFormatCode;
  requestedQualityPct?: number;
  requestedDpi?: number;
  requestedBatchCount?: number;
  requestedWidthPx?: number;
  requestedHeightPx?: number;
  requestedIdSheetCopies?: 1 | 4 | 8 | 16;
  requestedToolTier?: 'FREE' | 'PAID' | 'PREMIUM';
  isSelectedToolUnlocked?: boolean;
  dailyExportsUsed?: number;
  allowWatermarkedSampleExport?: boolean;
  plansMap?: Record<PlanId, PlanDefinition>;
}

export interface PlanCapabilityValidationResult {
  allowed: boolean;
  effectivePlanId: PlanId;
  effectivePlanName: string;
  studioId: StudioId;
  actionType: StudioActionType;
  isPaidTierActive: boolean;
  tierCategory: 'FREE' | 'PAID' | 'PREMIUM';
  // Explicit requested configuration keys: dpi (72 vs 300), quality (80 vs 100), batchLimit (1 vs 25), featureAccess
  dpi: number;
  quality: number;
  batchLimit: number;
  dailyFreeLimit: number;
  featureAccess: PlanFeatureAccessFlags;
  // Detailed studio capability constraints
  maxExportQualityPct: number;
  maxExportDpi: number;
  defaultDpi: number;
  availableDpiOptions: number[];
  maxResolutionPx: number;
  batchFileLimit: number;
  maxBatchAllowed: number;
  maxIdSheetCopiesAllowed: 1 | 4 | 8 | 16;
  dailyExportLimit: number;
  allowedFormats: ExportFormatCode[];
  professionalFeatures: PlanProfessionalFeatureAccess;
  requiresUpgradeForPro: boolean;
  upgradePromptMessage: string;
  clampedQualityPct: number;
  clampedDpi: number;
  clampedWidthPx: number;
  clampedHeightPx: number;
  violations: string[];
  reason: string;
}

/**
 * Evaluates a user's plan (`planId`), target studio (`studioId`), and action (`actionType`)
 * and returns a configuration object specifying constraints for `dpi` (72 vs 300),
 * `quality` (80 vs 100), `batchLimit` (1 vs 25+), strict 3-files/day free limit, and `featureAccess` boolean flags.
 * Supports both positional `(planId, studioId, actionType, options?)` and object `({ planId, ... })` signatures.
 */
export function validatePlanCapabilities(
  planIdOrParams: PlanId | PlanCapabilityValidationInput,
  studioIdArg?: StudioId,
  actionTypeArg?: StudioActionType,
  extraOptions?: Partial<PlanCapabilityValidationInput>
): PlanCapabilityValidationResult {
  const params: PlanCapabilityValidationInput =
    typeof planIdOrParams === 'string'
      ? {
          planId: planIdOrParams,
          studioId: studioIdArg ?? 'S1',
          actionType: actionTypeArg ?? 'EXPORT',
          ...extraOptions,
        }
      : planIdOrParams;

  const catalog = params.plansMap || INITIAL_PLANS;
  const effectiveState = params.state ?? 'ACTIVE';
  const studioId: StudioId = params.studioId ?? 'S1';
  const actionType: StudioActionType = params.actionType ?? 'EXPORT';

  // Only ACTIVE or GRACE states allow paid/premium plans; PENDING, REFUNDED, EXPIRED, or NONE fall back to FREE/NONE
  const effectivePlanId: PlanId =
    effectiveState === 'ACTIVE' || effectiveState === 'GRACE'
      ? params.planId
      : params.planId === 'NONE' || effectiveState === 'NONE'
      ? 'NONE'
      : 'FREE';

  const plan = catalog[effectivePlanId] || catalog.NONE;
  const isPaidTierActive = Boolean(plan.unlocksPaidBundles);
  const tierCategory: 'FREE' | 'PAID' | 'PREMIUM' = plan.unlocksPremiumAutomation
    ? 'PREMIUM'
    : plan.unlocksPaidBundles
    ? 'PAID'
    : 'FREE';

  // Canonical constraints: dpi (72 vs 300), quality (80 vs 100), batchLimit (1 vs 25+)
  const dpi = isPaidTierActive ? 300 : 72;
  const quality = isPaidTierActive ? 100 : 80;
  const batchLimit = isPaidTierActive ? Math.max(25, plan.batchLimit) : 1;
  const dailyFreeLimit = 3;

  const maxExportQualityPct = plan.maxExportQualityPct;
  const maxExportDpi = plan.maxExportDpi;
  const defaultDpi = dpi;
  const availableDpiOptions = [72, 150, 300, 600].filter((d) => d <= maxExportDpi);
  const maxResolutionPx = plan.maxResolutionPx;
  const batchFileLimit = plan.batchLimit;
  const maxBatchAllowed = plan.batchLimit;
  const maxIdSheetCopiesAllowed = plan.maxIdSheetCopies;
  const dailyExportLimit = isPaidTierActive ? plan.dailyExportLimit : dailyFreeLimit;
  const allowedFormats = plan.allowedFormats;

  const studioProFeaturesUnlocked =
    studioId === 'S3'
      ? maxIdSheetCopiesAllowed > 1
      : studioId === 'S2' || studioId === 'S4' || studioId === 'S1'
      ? Boolean(plan.unlocksPaidBundles)
      : false;

  const featureAccess: PlanFeatureAccessFlags = {
    paidTools: Boolean(plan.unlocksPaidBundles),
    premiumAutomation: Boolean(plan.unlocksPremiumAutomation),
    sampleExplorationAllowed: true, // Free & Freemium users can explore/analyze paid features with sample caps
    watermarkSampleOutput: !isPaidTierActive,
    highDpiPrint: maxExportDpi >= 300,
    losslessQuality: maxExportQualityPct >= 95,
    batchProcessing: batchFileLimit >= 25,
    vectorSvgAndZip: allowedFormats.includes('SVG') && allowedFormats.includes('ZIP'),
    multiCopyIdSheet: maxIdSheetCopiesAllowed > 1,
    permanentRedaction: Boolean(plan.unlocksPaidBundles),
    pressBleedAndCropMarks: Boolean(plan.unlocksPaidBundles),
    customWatermarkStamp: Boolean(plan.unlocksPaidBundles),
    studioProFeaturesUnlocked,
  };

  const professionalFeatures: PlanProfessionalFeatureAccess = {
    paidToolsAccess: featureAccess.paidTools,
    premiumAutomationAccess: featureAccess.premiumAutomation,
    highDpiPrintAccess: featureAccess.highDpiPrint,
    archival600DpiAccess: maxExportDpi >= 600,
    losslessQualityAccess: featureAccess.losslessQuality,
    batchProcessingAccess: featureAccess.batchProcessing,
    vectorSvgAndZipAccess: featureAccess.vectorSvgAndZip,
    multiCopyIdSheetAccess: featureAccess.multiCopyIdSheet,
    permanentRedactionAccess: featureAccess.permanentRedaction,
    pressBleedAndCropMarksAccess: featureAccess.pressBleedAndCropMarks,
    customWatermarkStampAccess: featureAccess.customWatermarkStamp,
  };

  const reqFormat = params.requestedFormat ?? (allowedFormats[0] || 'PNG');
  const reqQuality = params.requestedQualityPct ?? maxExportQualityPct;
  const reqDpi = params.requestedDpi ?? maxExportDpi;
  const reqBatch = params.requestedBatchCount ?? 1;

  const clampedQualityPct = Math.min(Math.max(reqQuality, 50), maxExportQualityPct);
  const clampedDpi = Math.min(Math.max(reqDpi, 72), maxExportDpi);
  const clampedWidthPx = Math.min(
    Math.max(params.requestedWidthPx ?? 800, 100),
    maxResolutionPx
  );
  const clampedHeightPx = Math.min(
    Math.max(params.requestedHeightPx ?? 600, 100),
    maxResolutionPx
  );

  const violations: string[] = [];

  // 0. Check strict 3-files/day Free limit if dailyExportsUsed is provided
  if (
    !isPaidTierActive &&
    params.dailyExportsUsed !== undefined &&
    params.dailyExportsUsed >= dailyFreeLimit
  ) {
    violations.push(
      `Daily Free export limit reached (${dailyFreeLimit}/${dailyFreeLimit} files used today). Subscribe to a Paid Plan to unlock unlimited daily exports, 300 DPI print quality, and 25+ batch processing.`
    );
  }

  // 1. Check gated tool tier entitlement if specified (unless sample watermarked export is enabled)
  if (
    params.requestedToolTier &&
    params.requestedToolTier !== 'FREE' &&
    !params.allowWatermarkedSampleExport
  ) {
    const toolUnlocked =
      params.isSelectedToolUnlocked !== undefined
        ? params.isSelectedToolUnlocked
        : params.requestedToolTier === 'PREMIUM'
        ? plan.unlocksPremiumAutomation
        : plan.unlocksPaidBundles;
    if (!toolUnlocked) {
      violations.push(
        `Selected ${params.requestedToolTier.toLowerCase()} studio tool requires an active ${
          params.requestedToolTier === 'PREMIUM' ? 'Premium Annual' : 'Paid'
        } plan.`
      );
    }
  }

  // 2. Check allowed export format
  if (!allowedFormats.includes(reqFormat)) {
    violations.push(
      `${reqFormat} output requires an upgraded plan (${plan.name} supports ${allowedFormats.join(', ')}).`
    );
  }

  // 3. Check batch size limit (1 for Free vs 25+ for Paid)
  if (reqBatch > batchFileLimit) {
    violations.push(
      `Batch quantity (${reqBatch}) exceeds the limit (${batchFileLimit}) for ${plan.name}. Upgrade to process 25–100+ files at once.`
    );
  }

  // 4. Check export quality percentage cap
  if (reqQuality > maxExportQualityPct) {
    violations.push(
      `${reqQuality}% export quality exceeds the ${maxExportQualityPct}% cap on ${plan.name}. Upgrade for 95%–100% lossless output.`
    );
  }

  // 5. Check print density DPI cap (72/150 DPI on Free vs 300/600 DPI on Paid)
  if (reqDpi > maxExportDpi) {
    violations.push(
      `${reqDpi} DPI exceeds the ${maxExportDpi} DPI cap on ${plan.name}. Upgrade for 300–600 DPI press output.`
    );
  }

  // 6. Check canvas resolution cap (width / height)
  if (
    (params.requestedWidthPx !== undefined && params.requestedWidthPx > maxResolutionPx) ||
    (params.requestedHeightPx !== undefined && params.requestedHeightPx > maxResolutionPx)
  ) {
    violations.push(
      `Canvas dimensions (${params.requestedWidthPx ?? clampedWidthPx}×${
        params.requestedHeightPx ?? clampedHeightPx
      } px) exceed the ${maxResolutionPx}px resolution cap on ${plan.name}.`
    );
  }

  // 7. Check multi-copy ID sheet layout cap (unless exploring watermarked sample)
  if (
    params.requestedIdSheetCopies !== undefined &&
    params.requestedIdSheetCopies > maxIdSheetCopiesAllowed &&
    !params.allowWatermarkedSampleExport
  ) {
    violations.push(
      `${params.requestedIdSheetCopies}-up ID print sheet exceeds the ${maxIdSheetCopiesAllowed}-up limit on ${plan.name}.`
    );
  }

  const allowed = violations.length === 0;
  const upgradePromptMessage = isPaidTierActive
    ? `${plan.name} active: 300+ DPI, ${maxExportQualityPct}% quality, and up to ${batchFileLimit} batch files unlocked.`
    : `You are on ${plan.name} (capped at ${quality}% sample quality, ${dpi} DPI, ${batchLimit} file batch limit, and strictly ${dailyFreeLimit} free files/day). Subscribe to a Paid Plan for unwatermarked 300–600 DPI masters, 100% lossless quality, and 25+ batch processing.`;

  return {
    allowed,
    effectivePlanId,
    effectivePlanName: plan.name,
    studioId,
    actionType,
    isPaidTierActive,
    tierCategory,
    dpi,
    quality,
    batchLimit,
    dailyFreeLimit,
    featureAccess,
    maxExportQualityPct,
    maxExportDpi,
    defaultDpi,
    availableDpiOptions,
    maxResolutionPx,
    batchFileLimit,
    maxBatchAllowed,
    maxIdSheetCopiesAllowed,
    dailyExportLimit,
    allowedFormats,
    professionalFeatures,
    requiresUpgradeForPro: !isPaidTierActive,
    upgradePromptMessage,
    clampedQualityPct,
    clampedDpi,
    clampedWidthPx,
    clampedHeightPx,
    violations,
    reason: allowed
      ? `Output verified within ${plan.name} quality & quantity caps.`
      : violations[0],
  };
}

/**
 * Evaluates whether a requested export format, quality %, DPI, resolution, and batch quantity
 * are permitted under the user's effective active plan (delegates to validatePlanCapabilities).
 */
export function evaluateOutputCapEntitlement(
  params: PlanCapabilityValidationInput
): PlanCapabilityValidationResult {
  return validatePlanCapabilities(params);
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
  DEVELOPER: 'developer-architect-v9',
  QA_TESTER: 'qa-tester-sandbox-v9',
  SUPER_USER: 'super-authority-v9',
};

export interface SchemaRoleMetadata {
  roleCategory: AdminCategory;
  schemaRoleId: string;
  title: string;
  personaGroup: 'USER' | 'SUBSCRIBER' | 'ADMIN' | 'DEVELOPER' | 'TESTER';
  defaultIdentifier: string;
  scopeSummary: string;
}

export const UNIFIED_SCHEMA_ROLES: SchemaRoleMetadata[] = [
  {
    roleCategory: 'SUPER_USER',
    schemaRoleId: 'ROLE-V24-SUPER-01',
    title: 'Owner / Super Admin',
    personaGroup: 'ADMIN',
    defaultIdentifier: 'super.admin@varnank.studio',
    scopeSummary: 'All 8 Admin Modules, 2-Person Recovery Final Approval, Vault & Kill Switch',
  },
  {
    roleCategory: 'OFFERS_PRICING',
    schemaRoleId: 'ROLE-V24-PRICE-02',
    title: 'Offers, Pricing & Output Caps Admin',
    personaGroup: 'ADMIN',
    defaultIdentifier: 'pricing.admin@varnank.studio',
    scopeSummary: 'Modify Plan Prices, Free/Paid Output Caps (DPI/Quality/Batch), & Promotional Offers',
  },
  {
    roleCategory: 'TOOLS_STUDIOS',
    schemaRoleId: 'ROLE-V24-TOOLS-03',
    title: 'Tools & Studios Admin',
    personaGroup: 'ADMIN',
    defaultIdentifier: 'studios.admin@varnank.studio',
    scopeSummary: 'Configure 24 Studio Tools, Free/Paid/Premium Tiers & Tool Availability',
  },
  {
    roleCategory: 'CONTENT_PRESETS',
    schemaRoleId: 'ROLE-V24-PRESET-04',
    title: 'Content & Global Presets Admin',
    personaGroup: 'ADMIN',
    defaultIdentifier: 'presets.admin@varnank.studio',
    scopeSummary: 'Create & Modify Contextual Tool Sizes, Print Templates & Free/Paid Preset Tiers',
  },
  {
    roleCategory: 'FINANCE',
    schemaRoleId: 'ROLE-V24-FIN-05',
    title: 'Finance, Orders & Tax Ledger Admin',
    personaGroup: 'ADMIN',
    defaultIdentifier: 'finance.admin@varnank.studio',
    scopeSummary: 'Inspect Orders, GST/Tax Ledger & Issue Refunds with Immediate Revocation',
  },
  {
    roleCategory: 'SUPPORT',
    schemaRoleId: 'ROLE-V24-SUPP-06',
    title: 'Support & Step-1 Recovery Admin',
    personaGroup: 'ADMIN',
    defaultIdentifier: 'support.admin@varnank.studio',
    scopeSummary: 'Manage User Support Tickets & Verify Step-1 Two-Person Recovery Checklist',
  },
  {
    roleCategory: 'SECURITY_AUDIT',
    schemaRoleId: 'ROLE-V24-SEC-07',
    title: 'Security, Audit & DPDP Compliance Admin',
    personaGroup: 'ADMIN',
    defaultIdentifier: 'audit.admin@varnank.studio',
    scopeSummary: 'Verify SHA-256 Hash-Chained Audit Logs, Error Registry & Cloudflare Quotas',
  },
  {
    roleCategory: 'INTEGRATIONS_VAULT',
    schemaRoleId: 'ROLE-V24-VAULT-08',
    title: 'Integrations & Secrets Vault Admin',
    personaGroup: 'ADMIN',
    defaultIdentifier: 'vault.admin@varnank.studio',
    scopeSummary: 'Rotate & Toggle Write-Only AES-256-GCM Payment, OAuth & OTP Provider Keys',
  },
  {
    roleCategory: 'DEVELOPER',
    schemaRoleId: 'ROLE-V24-DEV-09',
    title: 'Web Developer & Webhook Schema Architect',
    personaGroup: 'DEVELOPER',
    defaultIdentifier: 'developer@varnank.studio',
    scopeSummary: 'Inspect Webhooks, Studio Tools, Vault Adapters, Audit Logs & Schema v2.4 Diagnostics',
  },
  {
    roleCategory: 'QA_TESTER',
    schemaRoleId: 'ROLE-V24-TST-10',
    title: 'QA Verification & Entitlement Tester',
    personaGroup: 'TESTER',
    defaultIdentifier: 'tester@varnank.studio',
    scopeSummary: 'Verify Studio Tools, Presets, Plans, User Quotas & End-to-End Entitlement Flows',
  },
];

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
  | 'MANAGE_USERS_SUBSCRIBERS'
  | 'GRANT_ADMIN_ROLES'
  | 'TRIGGER_KILL_SWITCH';

const ROLE_PERMISSIONS: Record<AdminCategory, AdminPermissionAction[]> = {
  USER: [],
  FINANCE: ['VIEW_FINANCE_ORDERS', 'ISSUE_REFUND', 'MANAGE_USERS_SUBSCRIBERS'],
  SUPPORT: [
    'MANAGE_SUPPORT_TICKETS',
    'VERIFY_RECOVERY_CHECKLIST',
    'LOOKUP_ERROR_REF',
    'MANAGE_USERS_SUBSCRIBERS',
  ],
  CONTENT_PRESETS: ['MANAGE_PRESETS_CONTENT'],
  TOOLS_STUDIOS: ['MANAGE_STUDIOS_LIMITS'],
  SECURITY_AUDIT: ['VIEW_AUDIT_LOGS', 'LOOKUP_ERROR_REF'],
  INTEGRATIONS_VAULT: ['MANAGE_SECRETS_VAULT'],
  OFFERS_PRICING: [
    'MANAGE_OFFERS_PRICING',
    'MANAGE_COUNTRY_CURRENCY',
    'MANAGE_USERS_SUBSCRIBERS',
  ],
  DEVELOPER: [
    'MANAGE_STUDIOS_LIMITS',
    'MANAGE_PRESETS_CONTENT',
    'VIEW_AUDIT_LOGS',
    'LOOKUP_ERROR_REF',
    'MANAGE_SECRETS_VAULT',
    'MANAGE_USERS_SUBSCRIBERS',
  ],
  QA_TESTER: [
    'MANAGE_STUDIOS_LIMITS',
    'MANAGE_PRESETS_CONTENT',
    'VIEW_AUDIT_LOGS',
    'LOOKUP_ERROR_REF',
    'MANAGE_USERS_SUBSCRIBERS',
  ],
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
    'MANAGE_USERS_SUBSCRIBERS',
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
