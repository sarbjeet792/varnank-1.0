import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveCurrencyFromCountryCode,
  computeServerPriceQuote,
  evaluateBundleEntitlement,
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
