import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveCurrencyFromCountryCode,
  computeServerPriceQuote,
  evaluateBundleEntitlement,
  evaluateOutputCapEntitlement,
  evaluateDeviceMemoryGuard,
  authorizeAdminAction,
  INITIAL_PLANS,
  INITIAL_OFFERS,
} from './engine';

test('Section C: Country code +91 locks to INR and others lock to USD fallback with plain explanation', () => {
  const inResult = resolveCurrencyFromCountryCode('+91');
  assert.equal(inResult.currency, 'INR');
  assert.match(inResult.explanation, /Prices will be shown in INR because you selected \+91/);

  const usResult = resolveCurrencyFromCountryCode('+1');
  assert.equal(usResult.currency, 'USD');
  assert.match(usResult.explanation, /Prices will be shown in USD because you selected \+1/);

  const fallbackResult = resolveCurrencyFromCountryCode('+33');
  assert.equal(fallbackResult.currency, 'USD');
});

test('Section O: Server-side pricing computes discounts accurately and enforces first-purchase eligibility', () => {
  // First-time buyer gets 20% welcome offer on PRO_MONTHLY
  const firstBuyerQuote = computeServerPriceQuote({
    plan: INITIAL_PLANS.PRO_MONTHLY,
    currency: 'INR',
    offers: INITIAL_OFFERS,
    hasPriorPaidPurchase: false,
    nowIso: '2026-06-01T12:00:00Z',
  });
  assert.equal(firstBuyerQuote.baseMinor, 39900);
  assert.equal(firstBuyerQuote.offerDiscountMinor, 7980); // 20% of 39900
  assert.equal(firstBuyerQuote.finalMinor, 31920);
  assert.equal(firstBuyerQuote.honestyVerified, true);

  // Repeat buyer is not eligible for first-purchase welcome offer
  const repeatBuyerQuote = computeServerPriceQuote({
    plan: INITIAL_PLANS.PRO_MONTHLY,
    currency: 'INR',
    offers: INITIAL_OFFERS,
    hasPriorPaidPurchase: true,
    nowIso: '2026-06-01T12:00:00Z',
  });
  assert.equal(repeatBuyerQuote.offerDiscountMinor, 0);
  assert.equal(repeatBuyerQuote.finalMinor, 39900);
});

test('Section E: Free, PENDING, EXPIRED, and REFUNDED states NEVER unlock gated paid bundles', () => {
  const pendingCheck = evaluateBundleEntitlement({
    planId: 'PRO_MONTHLY',
    state: 'PENDING',
    expiresAtIso: '2026-12-31T00:00:00Z',
    graceEndsAtIso: null,
    requestedTier: 'PAID',
    nowIso: '2026-06-01T00:00:00Z',
  });
  assert.equal(pendingCheck.allowed, false);

  const freeCheck = evaluateBundleEntitlement({
    planId: 'FREE',
    state: 'ACTIVE',
    expiresAtIso: null,
    graceEndsAtIso: null,
    requestedTier: 'PAID',
    nowIso: '2026-06-01T00:00:00Z',
  });
  assert.equal(freeCheck.allowed, false);

  const refundedCheck = evaluateBundleEntitlement({
    planId: 'PREMIUM_ANNUAL',
    state: 'REFUNDED',
    expiresAtIso: '2027-06-01T00:00:00Z',
    graceEndsAtIso: null,
    requestedTier: 'PAID',
    nowIso: '2026-06-01T00:00:00Z',
  });
  assert.equal(refundedCheck.allowed, false);

  const activePaidCheck = evaluateBundleEntitlement({
    planId: 'PASS_24H',
    state: 'ACTIVE',
    expiresAtIso: '2026-06-02T00:00:00Z',
    graceEndsAtIso: null,
    requestedTier: 'PAID',
    nowIso: '2026-06-01T12:00:00Z',
  });
  assert.equal(activePaidCheck.allowed, true);

  // Per-Day pass has 0h grace period
  const dayPassGraceCheck = evaluateBundleEntitlement({
    planId: 'PASS_24H',
    state: 'GRACE',
    expiresAtIso: '2026-06-01T00:00:00Z',
    graceEndsAtIso: '2026-06-03T00:00:00Z',
    requestedTier: 'PAID',
    nowIso: '2026-06-01T12:00:00Z',
  });
  assert.equal(dayPassGraceCheck.allowed, false);
});

test('Section R: Admin RBAC blocks unauthenticated/non-MFA and enforces strict category boundaries', () => {
  // Regular user gets 404
  assert.deepEqual(
    authorizeAdminAction({
      actorRole: 'USER',
      sessionMfaVerified: true,
      action: 'MANAGE_OFFERS_PRICING',
    }),
    { authorized: false, status: 404 }
  );

  // Admin without MFA gets 403
  assert.deepEqual(
    authorizeAdminAction({
      actorRole: 'OFFERS_PRICING',
      sessionMfaVerified: false,
      action: 'MANAGE_OFFERS_PRICING',
    }),
    { authorized: false, status: 403 }
  );

  // Offers admin can manage offers, but cannot manage secrets vault
  assert.equal(
    authorizeAdminAction({
      actorRole: 'OFFERS_PRICING',
      sessionMfaVerified: true,
      action: 'MANAGE_OFFERS_PRICING',
    }).authorized,
    true
  );
  assert.equal(
    authorizeAdminAction({
      actorRole: 'OFFERS_PRICING',
      sessionMfaVerified: true,
      action: 'MANAGE_SECRETS_VAULT',
    }).authorized,
    false
  );

  // Support admin can verify recovery checklist step 1, but only Super User can approve final step 2
  assert.equal(
    authorizeAdminAction({
      actorRole: 'SUPPORT',
      sessionMfaVerified: true,
      action: 'VERIFY_RECOVERY_CHECKLIST',
    }).authorized,
    true
  );
  assert.equal(
    authorizeAdminAction({
      actorRole: 'SUPPORT',
      sessionMfaVerified: true,
      action: 'APPROVE_RECOVERY_FINAL',
    }).authorized,
    false
  );
  assert.equal(
    authorizeAdminAction({
      actorRole: 'SUPER_USER',
      sessionMfaVerified: true,
      action: 'APPROVE_RECOVERY_FINAL',
    }).authorized,
    true
  );
});

test('Category I: Adaptive device-RAM guard protects low-memory mobile viewports', () => {
  const mobileOverload = evaluateDeviceMemoryGuard({
    fileSizeBytes: 65 * 1024 * 1024, // 65 MB
    pageOrBatchCount: 1,
    isMobileViewport: true,
  });
  assert.equal(mobileOverload.safe, false);
  assert.ok(mobileOverload.plainWarning);

  const desktopOk = evaluateDeviceMemoryGuard({
    fileSizeBytes: 65 * 1024 * 1024,
    pageOrBatchCount: 10,
    deviceMemoryGb: 8,
    isMobileViewport: false,
  });
  assert.equal(desktopOk.safe, true);
});

test('Output Caps: Free, Guest, and PENDING states enforce quality/DPI/quantity/format caps while ACTIVE Paid/Premium unlock higher caps', () => {
  // Guest (NONE) blocked from ZIP or >80% quality
  const guestZip = evaluateOutputCapEntitlement({
    planId: 'NONE',
    state: 'NONE',
    requestedFormat: 'ZIP',
    requestedQualityPct: 80,
    requestedDpi: 150,
    requestedBatchCount: 2,
  });
  assert.equal(guestZip.allowed, false);

  // Freemium (FREE) allowed 85% PNG/PDF at 150 DPI, blocked from 100% quality or 300 DPI
  const freeOk = evaluateOutputCapEntitlement({
    planId: 'FREE',
    state: 'ACTIVE',
    requestedFormat: 'PDF',
    requestedQualityPct: 85,
    requestedDpi: 150,
    requestedBatchCount: 1,
  });
  assert.equal(freeOk.allowed, true);

  const freeOverQuality = evaluateOutputCapEntitlement({
    planId: 'FREE',
    state: 'ACTIVE',
    requestedFormat: 'PNG',
    requestedQualityPct: 100,
    requestedDpi: 300,
    requestedBatchCount: 1,
  });
  assert.equal(freeOverQuality.allowed, false);

  // PENDING order on PRO_MONTHLY still falls back to FREE caps until webhook sets ACTIVE
  const pendingPro = evaluateOutputCapEntitlement({
    planId: 'PRO_MONTHLY',
    state: 'PENDING',
    requestedFormat: 'ZIP',
    requestedQualityPct: 100,
    requestedDpi: 300,
    requestedBatchCount: 10,
  });
  assert.equal(pendingPro.allowed, false);

  // ACTIVE PRO_MONTHLY unlocks 100% quality, 300 DPI, SVG/ZIP, up to 50 batch files
  const activePro = evaluateOutputCapEntitlement({
    planId: 'PRO_MONTHLY',
    state: 'ACTIVE',
    requestedFormat: 'ZIP',
    requestedQualityPct: 100,
    requestedDpi: 300,
    requestedBatchCount: 25,
  });
  assert.equal(activePro.allowed, true);

  // ACTIVE PREMIUM_ANNUAL unlocks 600 DPI archival master and up to 100 batch files
  const activePremium = evaluateOutputCapEntitlement({
    planId: 'PREMIUM_ANNUAL',
    state: 'ACTIVE',
    requestedFormat: 'SVG',
    requestedQualityPct: 100,
    requestedDpi: 600,
    requestedBatchCount: 100,
  });
  assert.equal(activePremium.allowed, true);
});

test('validatePlanCapabilities: enforces DPI, quality, batch size (1 vs 25+), canvas dimensions, ID sheet copies, and professional feature access', async () => {
  const { validatePlanCapabilities } = await import('./engine');

  // 0. Evaluating plan capabilities directly for Free vs Paid returns structured constraints
  const freeCaps = validatePlanCapabilities({ planId: 'FREE', state: 'ACTIVE' });
  assert.equal(freeCaps.isPaidTierActive, false);
  assert.equal(freeCaps.batchFileLimit, 1);
  assert.equal(freeCaps.maxExportDpi, 150);
  assert.deepEqual(freeCaps.availableDpiOptions, [72, 150]);
  assert.equal(freeCaps.professionalFeatures.highDpiPrintAccess, false);
  assert.equal(freeCaps.professionalFeatures.batchProcessingAccess, false);
  assert.equal(freeCaps.requiresUpgradeForPro, true);
  assert.match(freeCaps.upgradePromptMessage, /Subscribe to a Paid Plan/);

  const dayPassCaps = validatePlanCapabilities({ planId: 'PASS_24H', state: 'ACTIVE' });
  assert.equal(dayPassCaps.isPaidTierActive, true);
  assert.ok(dayPassCaps.batchFileLimit >= 25);
  assert.equal(dayPassCaps.maxExportDpi, 300);
  assert.deepEqual(dayPassCaps.availableDpiOptions, [72, 150, 300]);
  assert.equal(dayPassCaps.professionalFeatures.highDpiPrintAccess, true);
  assert.equal(dayPassCaps.professionalFeatures.batchProcessingAccess, true);
  assert.equal(dayPassCaps.requiresUpgradeForPro, false);

  // 1. Free user attempting to export from a locked PAID tool or with 8-up ID sheet + 300 DPI is blocked with all violations listed
  const freeBlocked = validatePlanCapabilities({
    planId: 'FREE',
    state: 'ACTIVE',
    requestedFormat: 'PDF',
    requestedQualityPct: 95,
    requestedDpi: 300,
    requestedBatchCount: 5,
    requestedWidthPx: 2400,
    requestedHeightPx: 1800,
    requestedIdSheetCopies: 8,
    requestedToolTier: 'PAID',
    isSelectedToolUnlocked: false,
  });
  assert.equal(freeBlocked.allowed, false);
  assert.equal(freeBlocked.isPaidTierActive, false);
  assert.equal(freeBlocked.clampedQualityPct, 85);
  assert.equal(freeBlocked.clampedDpi, 150);
  assert.equal(freeBlocked.clampedWidthPx, 1600);
  assert.ok(freeBlocked.violations.length >= 5);

  // 2. Active PRO_MONTHLY user with unlocked PAID tool, 300 DPI, 100% quality, 16-up ID sheet, and batch size 25 succeeds
  const proAllowed = validatePlanCapabilities({
    planId: 'PRO_MONTHLY',
    state: 'ACTIVE',
    requestedFormat: 'PDF',
    requestedQualityPct: 100,
    requestedDpi: 300,
    requestedBatchCount: 25,
    requestedWidthPx: 2400,
    requestedHeightPx: 1800,
    requestedIdSheetCopies: 16,
    requestedToolTier: 'PAID',
    isSelectedToolUnlocked: true,
  });
  assert.equal(proAllowed.allowed, true);
  assert.equal(proAllowed.isPaidTierActive, true);
  assert.equal(proAllowed.professionalFeatures.paidToolsAccess, true);
  assert.equal(proAllowed.violations.length, 0);

  // 3. Positional signature validatePlanCapabilities(planId, studioId, actionType)
  const positionalFree = validatePlanCapabilities('FREE', 'S1', 'EXPORT');
  assert.equal(positionalFree.dpi, 72);
  assert.equal(positionalFree.quality, 80);
  assert.equal(positionalFree.batchLimit, 1);
  assert.equal(positionalFree.dailyFreeLimit, 3);
  assert.equal(positionalFree.featureAccess.paidTools, false);
  assert.equal(positionalFree.featureAccess.sampleExplorationAllowed, true);
  assert.equal(positionalFree.featureAccess.watermarkSampleOutput, true);

  const positionalPaid = validatePlanCapabilities('PASS_24H', 'S3', 'BATCH_EXPORT');
  assert.equal(positionalPaid.dpi, 300);
  assert.equal(positionalPaid.quality, 100);
  assert.equal(positionalPaid.batchLimit, 25);
  assert.equal(positionalPaid.featureAccess.paidTools, true);
  assert.equal(positionalPaid.featureAccess.multiCopyIdSheet, true);
  assert.equal(positionalPaid.featureAccess.watermarkSampleOutput, false);

  // 4. Strict 3 files per day Free limit enforcement
  const freeOverDailyLimit = validatePlanCapabilities('FREE', 'S2', 'EXPORT', {
    dailyExportsUsed: 3,
  });
  assert.equal(freeOverDailyLimit.allowed, false);
  assert.match(
    freeOverDailyLimit.reason,
    /Daily Free export limit reached \(3\/3 files used today\)/
  );
});

test('Schema v2.4 Compliance: UNIFIED_SCHEMA_ROLES defines all 10 Admin, Web Developer & QA Tester categories and RBAC permissions', async () => {
  const { UNIFIED_SCHEMA_ROLES } = await import('./engine');
  assert.equal(UNIFIED_SCHEMA_ROLES.length, 10);
  const devRole = UNIFIED_SCHEMA_ROLES.find((r) => r.roleCategory === 'DEVELOPER');
  assert.ok(devRole);
  assert.equal(devRole?.defaultIdentifier, 'developer@varnank.studio');

  const testerRole = UNIFIED_SCHEMA_ROLES.find((r) => r.roleCategory === 'QA_TESTER');
  assert.ok(testerRole);
  assert.equal(testerRole?.defaultIdentifier, 'tester@varnank.studio');

  // DEVELOPER and QA_TESTER roles have MFA-verified access to tools, presets, user/subscriber testing, and audit diagnostics, but cannot approve final recovery step
  assert.equal(
    authorizeAdminAction({
      actorRole: 'DEVELOPER',
      sessionMfaVerified: true,
      action: 'MANAGE_STUDIOS_LIMITS',
    }).authorized,
    true
  );
  assert.equal(
    authorizeAdminAction({
      actorRole: 'QA_TESTER',
      sessionMfaVerified: true,
      action: 'MANAGE_USERS_SUBSCRIBERS',
    }).authorized,
    true
  );
  assert.equal(
    authorizeAdminAction({
      actorRole: 'DEVELOPER',
      sessionMfaVerified: true,
      action: 'APPROVE_RECOVERY_FINAL',
    }).authorized,
    false
  );
});

