import React, { useState, useEffect } from 'react';
import {
  PlanDefinition,
  PriceQuoteResult,
  PlanId,
  CurrencyCode,
  formatMinorCurrency,
} from '../core/engine';
import { Check, Shield, Clock, AlertCircle } from 'lucide-react';

interface IndicativePlan extends PlanDefinition {
  indicativeQuotes?: {
    INR: PriceQuoteResult;
    USD: PriceQuoteResult;
  };
  quote?: PriceQuoteResult;
}

interface PlansAndPaymentViewProps {
  plans: IndicativePlan[];
  isSignedIn: boolean;
  lockedCurrency?: CurrencyCode;
  currencyExplanation?: string;
  currentPlanId?: PlanId;
  currentEntitlementState?: string;
  sessionToken: string | null;
  onRequireSignIn: () => void;
  onOrderActivated: () => Promise<void>;
}

export const PlansAndPaymentView: React.FC<PlansAndPaymentViewProps> = ({
  plans,
  isSignedIn,
  lockedCurrency,
  currencyExplanation,
  currentPlanId = 'NONE',
  currentEntitlementState = 'NONE',
  sessionToken,
  onRequireSignIn,
  onOrderActivated,
}) => {
  const [buyerGstin, setBuyerGstin] = useState<string>('');
  const [pendingOrder, setPendingOrder] = useState<{
    id: string;
    planId: PlanId;
    currency: CurrencyCode;
    finalMinor: number;
    state: string;
  } | null>(null);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [creatingPlanId, setCreatingPlanId] = useState<PlanId | null>(null);

  // Poll order status when on the "Payment verification in progress" screen (Chart 3)
  useEffect(() => {
    if (!pendingOrder || pendingOrder.state !== 'PENDING' || !sessionToken) return;
    const timer = setInterval(async () => {
      try {
        const resp = await fetch(`/api/orders/${pendingOrder.id}/status`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        if (!resp.ok) return;
        const data = await resp.json();
        if (data.order && data.order.state !== 'PENDING') {
          setPendingOrder(data.order);
          await onOrderActivated();
        }
      } catch {
        // Ignore transient poll errors
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [pendingOrder, sessionToken, onOrderActivated]);

  const handleProceedToPayment = async (planId: PlanId) => {
    setErrorMsg(null);
    if (!isSignedIn || !sessionToken) {
      onRequireSignIn();
      return;
    }

    setCreatingPlanId(planId);
    try {
      const resp = await fetch('/api/orders/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          planId,
          buyerGstin,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setErrorMsg(`${data.error || 'Could not create order.'} (${data.refId || 'ERR-P400'})`);
        setCreatingPlanId(null);
        return;
      }

      setPendingOrder(data.order);
      setVerificationMessage(
        'Payment verification in progress. Your plan will unlock only after server webhook confirmation.'
      );
      await onOrderActivated();
    } catch {
      setErrorMsg('Unable to start checkout right now. (ERR-P500)');
    } finally {
      setCreatingPlanId(null);
    }
  };

  const triggerSimulatedWebhook = async (
    eventType: 'PAYMENT_CAPTURED' | 'PAYMENT_FAILED' | 'PAYMENT_REFUNDED'
  ) => {
    if (!pendingOrder || !sessionToken) return;
    setVerificationMessage('Processing server-to-server payment confirmation...');
    try {
      const resp = await fetch('/api/webhooks/simulate-gateway', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          orderId: pendingOrder.id,
          eventType,
        }),
      });
      const data = await resp.json();
      if (resp.ok && data.order) {
        setPendingOrder(data.order);
        if (eventType === 'PAYMENT_CAPTURED') {
          setVerificationMessage(
            `Payment confirmed! Plan is now ACTIVE and Invoice ${data.order.invoiceNumber} has been issued.`
          );
        } else if (eventType === 'PAYMENT_FAILED') {
          setVerificationMessage(
            'Payment did not complete. Your plan remains unchanged and no paid tools were unlocked.'
          );
        } else {
          setVerificationMessage(
            'Order refunded. Paid studio bundle access has been immediately revoked.'
          );
        }
        await onOrderActivated();
      }
    } catch {
      setErrorMsg('Webhook verification check failed.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 pb-24">
      <div className="pb-6 border-b border-[#E7E2DA] dark:border-[#2E2B28] flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#57534E] dark:text-[#A8A29E] mb-1">
            Transparent Server-Computed Pricing · Tax-Inclusive Display
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#181615] dark:text-[#F5F2EB]">
            Studio Plans &amp; Access Tiers
          </h1>
          <p className="text-xs sm:text-sm text-[#57534E] dark:text-[#A8A29E] mt-1">
            {isSignedIn && lockedCurrency ? (
              <span>
                {currencyExplanation ||
                  `Your account currency is permanently set to ${lockedCurrency}. All prices include applicable taxes.`}
              </span>
            ) : (
              <span>
                Indicative launch pricing shown below (INR ₹ / USD $). Your permanent billing
                currency is locked once when you select your country code at sign-up (+91 India →
                INR ₹; all other country codes → USD $).
              </span>
            )}
          </p>
        </div>

        {/* Optional Buyer GSTIN for Indian B2B Invoices (Decision Log C1 / N1) */}
        {isSignedIn && lockedCurrency === 'INR' && (
          <div className="w-full lg:w-72">
            <label
              htmlFor="input-buyer-gstin"
              className="block text-xs font-medium text-[#57534E] dark:text-[#A8A29E] mb-1"
            >
              Optional Business GSTIN (For Tax Invoice)
            </label>
            <input
              id="input-buyer-gstin"
              type="text"
              placeholder="e.g. 27AAAAA0000A1Z5"
              value={buyerGstin}
              onChange={(e) => setBuyerGstin(e.target.value)}
              className="w-full min-h-[40px] px-3 py-1.5 text-xs font-mono rounded-lg bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28]"
            />
          </div>
        )}
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="mt-4 p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-300 text-xs text-red-900 dark:text-red-200"
        >
          {errorMsg}
        </div>
      )}

      {/* Payment Verification Polling Banner (Section P & Chart 3: Redirect NEVER unlocks anything) */}
      {pendingOrder && (
        <section
          aria-label="Payment Verification Status"
          className="mt-6 p-6 rounded-2xl bg-white dark:bg-[#1C1A18] border-2 border-[#B44C32] space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#B44C32]" />
              <h2 className="text-base font-bold text-[#181615] dark:text-[#F5F2EB]">
                Order {pendingOrder.id} · State: {pendingOrder.state}
              </h2>
            </div>
            <span className="text-xs font-mono text-[#57534E] dark:text-[#A8A29E]">
              Amount: {formatMinorCurrency(pendingOrder.finalMinor, pendingOrder.currency)} (
              {pendingOrder.currency})
            </span>
          </div>

          <p className="text-xs sm:text-sm text-[#181615] dark:text-[#F5F2EB]">
            {verificationMessage}
          </p>

          <div className="p-3.5 rounded-xl bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA] dark:border-[#2E2B28] space-y-2">
            <div className="text-xs font-semibold text-[#57534E] dark:text-[#A8A29E]">
              Development Payment Verification Controls (Simulates Server-to-Server Webhook)
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => triggerSimulatedWebhook('PAYMENT_CAPTURED')}
                className="min-h-[40px] px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#15803D] text-white"
              >
                Confirm Payment Webhook (Set ACTIVE)
              </button>
              <button
                type="button"
                onClick={() => triggerSimulatedWebhook('PAYMENT_FAILED')}
                className="min-h-[40px] px-3.5 py-1.5 text-xs font-medium rounded-lg border border-[#E7E2DA] dark:border-[#2E2B28]"
              >
                Simulate Failed Payment
              </button>
              <button
                type="button"
                onClick={() => triggerSimulatedWebhook('PAYMENT_REFUNDED')}
                className="min-h-[40px] px-3.5 py-1.5 text-xs font-medium rounded-lg text-[#B91C1C] border border-red-300"
              >
                Simulate Refund Webhook (Immediate Revoke)
              </button>
            </div>
          </div>
        </section>
      )}

      {/* 5 User Plans Comparison Grid (Section M & O) */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {plans
          .filter((p) => p.id !== 'NONE')
          .map((plan) => {
            const isCurrent =
              isSignedIn && currentPlanId === plan.id && currentEntitlementState === 'ACTIVE';

            const activeQuote =
              isSignedIn && lockedCurrency
                ? plan.quote || plan.indicativeQuotes?.[lockedCurrency]
                : plan.indicativeQuotes?.INR;

            const secondaryUsdQuote =
              !isSignedIn && plan.indicativeQuotes?.USD ? plan.indicativeQuotes.USD : null;

            return (
              <div
                key={plan.id}
                className={`p-5 rounded-2xl bg-white dark:bg-[#1C1A18] border flex flex-col justify-between ${
                  plan.id === 'PRO_MONTHLY'
                    ? 'border-[#B44C32]'
                    : 'border-[#E7E2DA] dark:border-[#2E2B28]'
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-[#57534E] dark:text-[#A8A29E] font-mono">
                    <span>Plan {plan.codeLabel}</span>
                    {activeQuote?.appliedOfferBadge && (
                      <span className="text-[#B44C32] dark:text-[#E06D53] font-sans font-medium">
                        {activeQuote.appliedOfferBadge}
                      </span>
                    )}
                  </div>

                  <div>
                    <h2 className="text-lg font-bold text-[#181615] dark:text-[#F5F2EB]">
                      {plan.name}
                    </h2>
                    <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mt-1">
                      {plan.audienceLabel}
                    </p>
                  </div>

                  {/* Price Block with Honest Slashed Base Price & Offer Savings (Section O) */}
                  <div className="pt-2 border-t border-[#E7E2DA] dark:border-[#2E2B28]">
                    {plan.id === 'FREE' ? (
                      <div className="text-2xl font-bold font-mono text-[#181615] dark:text-[#F5F2EB]">
                        Free
                      </div>
                    ) : activeQuote ? (
                      <div className="space-y-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold font-mono text-[#181615] dark:text-[#F5F2EB]">
                            {formatMinorCurrency(activeQuote.finalMinor, activeQuote.currency)}
                          </span>
                          {activeQuote.listedSlashedMinor > activeQuote.finalMinor && (
                            <span className="text-xs line-through text-[#57534E] dark:text-[#A8A29E] font-mono">
                              {formatMinorCurrency(
                                activeQuote.listedSlashedMinor,
                                activeQuote.currency
                              )}
                            </span>
                          )}
                          {activeQuote.savingsPercent > 0 && (
                            <span className="text-xs font-semibold text-[#15803D]">
                              Save {activeQuote.savingsPercent}%
                            </span>
                          )}
                        </div>

                        {/* For Guests: also show USD indicative price alongside INR per R1 */}
                        {secondaryUsdQuote && (
                          <div className="text-xs text-[#57534E] dark:text-[#A8A29E] font-mono">
                            International: {formatMinorCurrency(secondaryUsdQuote.finalMinor, 'USD')}{' '}
                            {secondaryUsdQuote.listedSlashedMinor > secondaryUsdQuote.finalMinor && (
                              <span className="line-through">
                                {formatMinorCurrency(secondaryUsdQuote.listedSlashedMinor, 'USD')}
                              </span>
                            )}
                          </div>
                        )}

                        <p className="text-[11px] text-[#57534E] dark:text-[#A8A29E]">
                          Tax-inclusive ·{' '}
                          {plan.durationHours === 24
                            ? '24-hour validity (0h grace)'
                            : plan.durationHours === 720
                            ? '30-day validity (48h renewal grace)'
                            : '365-day validity (48h renewal grace)'}
                        </p>
                      </div>
                    ) : null}
                  </div>

                  <ul className="space-y-2 text-xs text-[#181615] dark:text-[#F5F2EB] pt-2">
                    {plan.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-[#B44C32] shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Section P: Button strictly says "Proceed to Secure Payment" */}
                <div className="pt-5 mt-5 border-t border-[#E7E2DA] dark:border-[#2E2B28]">
                  {plan.id === 'FREE' ? (
                    <button
                      type="button"
                      disabled={isSignedIn}
                      onClick={onRequireSignIn}
                      className="w-full min-h-[44px] px-4 py-2 text-xs font-semibold rounded-xl border border-[#E7E2DA] dark:border-[#2E2B28] disabled:opacity-50"
                    >
                      {isSignedIn ? 'Included with Account' : 'Sign in / Sign up Free'}
                    </button>
                  ) : isCurrent ? (
                    <div className="w-full min-h-[44px] px-4 py-2 text-xs font-semibold rounded-xl bg-[#15803D]/10 text-[#15803D] flex items-center justify-center">
                      Current Active Plan
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={creatingPlanId === plan.id}
                      onClick={() => handleProceedToPayment(plan.id)}
                      className="w-full min-h-[44px] px-4 py-2.5 text-xs font-semibold text-[#FAF8F5] bg-[#B44C32] hover:bg-[#9E3F27] rounded-xl transition-colors"
                    >
                      {creatingPlanId === plan.id
                        ? 'Preparing Order...'
                        : 'Proceed to Secure Payment'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
};
