import React, { useState, useEffect } from 'react';
import {
  ADMIN_PORTAL_SLUGS,
  AdminCategory,
  OfferTemplateType,
  PlanId,
  CurrencyCode,
  formatMinorCurrency,
} from '../core/engine';
import { KeyRound, ShieldAlert, Lock, CheckCircle2, RefreshCw } from 'lucide-react';

interface HiddenAdminConsoleProps {
  portalSlug: string;
  onExitPortal: () => void;
  onSwitchPortalSlug: (nextSlug: string) => void;
  onCatalogUpdated: () => Promise<void>;
}

export const HiddenAdminConsole: React.FC<HiddenAdminConsoleProps> = ({
  portalSlug,
  onExitPortal,
  onSwitchPortalSlug,
  onCatalogUpdated,
}) => {
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [passkeyCred, setPasskeyCred] = useState<string>('HARDWARE-PASSKEY-01');
  const [totpCode, setTotpCode] = useState<string>('123456');
  const [authError, setAuthError] = useState<string | null>(null);
  const [consoleData, setConsoleData] = useState<Record<string, any> | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  // Offer Builder state (Section O & Chart 6)
  const [offerTemplate, setOfferTemplate] = useState<OfferTemplateType>('PERCENTAGE');
  const [offerTitle, setOfferTitle] = useState<string>('Seasonal Studio Offer');
  const [offerExplanation, setOfferExplanation] = useState<string>(
    'Save 25% on Paid Monthly and Premium Annual plans.'
  );
  const [offerBadge, setOfferBadge] = useState<string>('Seasonal savings');
  const [offerInrValue, setOfferInrValue] = useState<number>(25);
  const [offerUsdValue, setOfferUsdValue] = useState<number>(25);

  // Vault Rotation state (Section S)
  const [selectedVaultKey, setSelectedVaultKey] = useState<string>('EMAIL_PROVIDER_API_KEY');
  const [newVaultSecretValue, setNewVaultSecretValue] = useState<string>('');
  const [vaultMode, setVaultMode] = useState<'MOCK' | 'TEST' | 'LIVE'>('TEST');

  const isKnownPortalSlug = Object.values(ADMIN_PORTAL_SLUGS).includes(portalSlug);

  const loadConsoleData = async (token: string, slug: string) => {
    const resp = await fetch(`/api/admin/console-data/${slug}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) {
      setConsoleData(null);
      return;
    }
    const data = await resp.json();
    setConsoleData(data);
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const resp = await fetch('/api/admin/authenticate-portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        portalSlug,
        passkeyCredential: passkeyCred,
        totpCode,
      }),
    });
    if (!resp.ok) {
      setAuthError('404 Not Found — Invalid category entry, passkey, or 6-digit MFA code.');
      return;
    }
    const data = await resp.json();
    setAdminToken(data.adminSessionToken);
    await loadConsoleData(data.adminSessionToken, portalSlug);
  };

  useEffect(() => {
    if (adminToken && isKnownPortalSlug) {
      loadConsoleData(adminToken, portalSlug);
    }
  }, [portalSlug]);

  // Generic 404 for unknown/unguessable routes (Section R)
  if (!isKnownPortalSlug) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-bold font-mono">404 — Page Not Found</h1>
        <p className="text-xs text-[#57534E]">
          The requested page does not exist on Varnank Studios.
        </p>
        <button
          type="button"
          onClick={onExitPortal}
          className="min-h-[40px] px-4 py-2 text-xs font-medium border border-[#E7E2DA] rounded-lg"
        >
          Return to Studios
        </button>
      </div>
    );
  }

  if (!adminToken || !consoleData) {
    return (
      <div className="max-w-md mx-auto px-4 py-12">
        <form
          onSubmit={handleAdminLogin}
          className="p-6 rounded-2xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] space-y-4"
        >
          <div className="text-xs font-mono text-[#B44C32]">
            Category Portal Entry · Passkey + MFA Mandatory
          </div>
          <h1 className="text-lg font-bold">
            Authenticate Portal ({portalSlug})
          </h1>
          <p className="text-xs text-[#57534E]">
            Social, email, and phone sign-in are strictly prohibited for administrative portals
            (Section A4).
          </p>

          {authError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-300 text-xs text-red-900">
              {authError}
            </div>
          )}

          <div>
            <label htmlFor="admin-passkey" className="block text-xs font-medium mb-1">
              Hardware / Device Passkey Assertion
            </label>
            <input
              id="admin-passkey"
              type="text"
              required
              value={passkeyCred}
              onChange={(e) => setPasskeyCred(e.target.value)}
              className="w-full min-h-[40px] px-3 py-1.5 text-xs font-mono rounded-lg bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA]"
            />
          </div>

          <div>
            <label htmlFor="admin-totp" className="block text-xs font-medium mb-1">
              6-Digit TOTP Authenticator Code
            </label>
            <input
              id="admin-totp"
              type="text"
              required
              maxLength={6}
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              className="w-full min-h-[40px] px-3 py-1.5 text-xs font-mono rounded-lg bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA]"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onExitPortal}
              className="min-h-[40px] px-4 py-2 text-xs border border-[#E7E2DA] rounded-lg"
            >
              Exit
            </button>
            <button
              type="submit"
              className="flex-1 min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-[#181615] rounded-lg"
            >
              Verify Passkey + MFA
            </button>
          </div>
        </form>
      </div>
    );
  }

  const handlePublishOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    const resp = await fetch('/api/admin/offers-pricing/create-offer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        templateType: offerTemplate,
        title: offerTitle,
        plainExplanation: offerExplanation,
        badgeText: offerBadge,
        targetPlanIds: ['PRO_MONTHLY', 'PREMIUM_ANNUAL'],
        discountType: offerTemplate === 'FLAT_AMOUNT' ? 'FLAT' : 'PERCENT',
        discountValueInrMinor: offerInrValue,
        discountValueUsdMinor: offerUsdValue,
      }),
    });
    if (resp.ok) {
      await loadConsoleData(adminToken, portalSlug);
      await onCatalogUpdated();
      setStatusNote(`Published offer "${offerTitle}" and recorded audit entry.`);
    }
  };

  const handleRotateVaultSecret = async (keyName: string, enableToggle?: boolean) => {
    const resp = await fetch('/api/admin/vault/rotate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        keyName,
        newSecretValue: newVaultSecretValue || 'TEST_ROTATED_ENCRYPTED_KEY',
        isEnabled: enableToggle,
        mode: vaultMode,
      }),
    });
    if (resp.ok) {
      setNewVaultSecretValue('');
      await loadConsoleData(adminToken, portalSlug);
      await onCatalogUpdated();
      setStatusNote(`Updated encrypted Vault slot ${keyName} (Write-Only AES-256-GCM).`);
    }
  };

  const handleRecoveryTwoPersonAction = async (
    ticketId: string,
    step: 'VERIFY_CHECKLIST' | 'SUPER_USER_APPROVE'
  ) => {
    const resp = await fetch('/api/admin/support/recovery-step', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ ticketId, step }),
    });
    const data = await resp.json();
    if (resp.ok) {
      await loadConsoleData(adminToken, portalSlug);
      setStatusNote(`Completed ${step} for recovery ticket ${ticketId}.`);
    } else {
      setStatusNote(data.error || 'Action denied by RBAC.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 pb-24 space-y-6">
      <div className="pb-5 border-b border-[#E7E2DA] dark:border-[#2E2B28] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-mono text-[#B44C32]">
            Hidden Category-Scoped Console · Role: {consoleData.roleCategory}
          </div>
          <h1 className="text-2xl font-bold">
            Varnank Studios Control Plane ({portalSlug})
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {consoleData.roleCategory === 'SUPER_USER' && (
            <select
              aria-label="Switch Admin Category Portal"
              value={portalSlug}
              onChange={(e) => onSwitchPortalSlug(e.target.value)}
              className="min-h-[40px] px-3 py-1.5 text-xs font-mono rounded-lg bg-white dark:bg-[#1C1A18] border border-[#E7E2DA]"
            >
              {Object.entries(ADMIN_PORTAL_SLUGS).map(([roleKey, slugVal]) => (
                <option key={roleKey} value={slugVal}>
                  {roleKey} ({slugVal})
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={onExitPortal}
            className="min-h-[40px] px-4 py-1.5 text-xs font-medium border border-[#E7E2DA] rounded-lg"
          >
            Lock &amp; Exit Console
          </button>
        </div>
      </div>

      {statusNote && (
        <div className="p-3.5 rounded-xl bg-white dark:bg-[#1C1A18] border border-[#B44C32] text-xs font-mono">
          {statusNote}
        </div>
      )}

      {/* MODULE 1: OFFERS & PRICING ADMIN (Section O & Chart 6) */}
      {consoleData.offersPricing && (
        <section className="p-5 rounded-2xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] space-y-4">
          <h2 className="text-base font-bold">
            Offers, Pricing &amp; Predefined Template Builder (Section O)
          </h2>
          <p className="text-xs text-[#57534E]">
            Consumer-Protection Honesty Rule enforced: slashed base prices must be genuine listed
            base prices. Server computes all final order amounts.
          </p>

          <form
            onSubmit={handlePublishOffer}
            className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 rounded-xl bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA]"
          >
            <div>
              <label className="block text-xs font-medium mb-1">
                Predefined Offer Template (5 Non-Coupon Types)
              </label>
              <select
                value={offerTemplate}
                onChange={(e) => setOfferTemplate(e.target.value as OfferTemplateType)}
                className="w-full min-h-[38px] px-2.5 py-1 text-xs rounded bg-white border border-[#E7E2DA]"
              >
                <option value="PERCENTAGE">1. Percentage Discount Template</option>
                <option value="FLAT_AMOUNT">2. Flat Amount Off Template</option>
                <option value="FIRST_PURCHASE">3. First-Purchase Welcome Offer</option>
                <option value="SEASONAL">4. Seasonal / Festival Offer</option>
                <option value="FLASH_COUNTDOWN">5. Time-Limited Countdown Flash Offer</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Offer Title</label>
              <input
                type="text"
                value={offerTitle}
                onChange={(e) => setOfferTitle(e.target.value)}
                className="w-full min-h-[38px] px-2.5 py-1 text-xs rounded bg-white border border-[#E7E2DA]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Badge Label</label>
              <input
                type="text"
                value={offerBadge}
                onChange={(e) => setOfferBadge(e.target.value)}
                className="w-full min-h-[38px] px-2.5 py-1 text-xs rounded bg-white border border-[#E7E2DA]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Discount Value (INR % or Paise)
              </label>
              <input
                type="number"
                value={offerInrValue}
                onChange={(e) => setOfferInrValue(Number(e.target.value))}
                className="w-full min-h-[38px] px-2.5 py-1 text-xs font-mono rounded bg-white border border-[#E7E2DA]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Discount Value (USD % or Cents)
              </label>
              <input
                type="number"
                value={offerUsdValue}
                onChange={(e) => setOfferUsdValue(Number(e.target.value))}
                className="w-full min-h-[38px] px-2.5 py-1 text-xs font-mono rounded bg-white border border-[#E7E2DA]"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full min-h-[38px] px-4 py-1.5 text-xs font-semibold text-white bg-[#B44C32] rounded"
              >
                Publish Offer &amp; Audit Log
              </button>
            </div>
          </form>

          <div className="space-y-2">
            <div className="text-xs font-semibold">Active &amp; Scheduled Offers</div>
            {consoleData.offersPricing.offers.map((off: any) => (
              <div
                key={off.id}
                className="p-3 rounded-lg border border-[#E7E2DA] flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <div>
                  <span className="font-mono font-semibold">{off.id}</span> ·{' '}
                  <span className="font-semibold">{off.title}</span> ({off.templateType}) · Status:{' '}
                  <span className="font-mono">{off.status}</span>
                </div>
                <div className="text-[#57534E] font-mono">
                  Targets: {off.targetPlanIds.join(', ')} · Uses: {off.currentUses}/{off.maxUses}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* MODULE 2: ENCRYPTED SECRETS VAULT (Section S & K) */}
      {consoleData.vault && (
        <section className="p-5 rounded-2xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] space-y-4">
          <h2 className="text-base font-bold">
            Tier 2 Encrypted Secrets Vault (Write-Only AES-256-GCM · Section S)
          </h2>
          <p className="text-xs text-[#57534E]">
            Enabling Email OTP, Google OAuth, or Password Pepper here dynamically turns on that
            sign-in method on the public unified Sign-In screen. Key values are never returned to
            the browser.
          </p>

          <div className="space-y-2">
            {consoleData.vault.map((v: any) => (
              <div
                key={v.keyName}
                className="p-3 rounded-xl bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="font-mono font-bold">
                    {v.keyName} · [{v.mode}]
                  </div>
                  <div className="text-[#57534E]">{v.label}</div>
                  <div className="text-[11px] font-mono text-[#57534E]">{v.maskedPreview}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleRotateVaultSecret(v.keyName, !v.isEnabled)}
                    className={`min-h-[36px] px-3 py-1 rounded font-semibold ${
                      v.isEnabled
                        ? 'bg-[#15803D] text-white'
                        : 'bg-white border border-[#E7E2DA] text-[#181615]'
                    }`}
                  >
                    {v.isEnabled ? 'Enabled (Click to Disable)' : 'Disabled (Click to Enable)'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* MODULE 3: SUPPORT TICKETS & 2-PERSON RECOVERY APPROVAL (Section A3) */}
      {consoleData.support && (
        <section className="p-5 rounded-2xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] space-y-4">
          <h2 className="text-base font-bold">
            Support Desk &amp; Two-Person Admin Recovery Verification
          </h2>
          {consoleData.support.tickets.length === 0 ? (
            <p className="text-xs text-[#57534E]">No support or recovery tickets in queue.</p>
          ) : (
            <div className="space-y-2">
              {consoleData.support.tickets.map((tkt: any) => (
                <div
                  key={tkt.id}
                  className="p-3.5 rounded-xl border border-[#E7E2DA] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="font-mono">
                      {tkt.id} · {tkt.category} · Status: {tkt.status}
                    </div>
                    <div className="font-semibold">{tkt.subject}</div>
                    <div className="text-[#57534E]">{tkt.message}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleRecoveryTwoPersonAction(tkt.id, 'VERIFY_CHECKLIST')}
                      className="min-h-[36px] px-3 py-1 border border-[#E7E2DA] rounded font-medium"
                    >
                      Step 1: Support Verify Checklist
                    </button>
                    {consoleData.roleCategory === 'SUPER_USER' && (
                      <button
                        type="button"
                        onClick={() => handleRecoveryTwoPersonAction(tkt.id, 'SUPER_USER_APPROVE')}
                        className="min-h-[36px] px-3 py-1 bg-[#181615] text-white rounded font-semibold"
                      >
                        Step 2: Super User Approve
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* MODULE 4: FINANCE LEDGER & ANONYMIZED TAX RETENTION */}
      {consoleData.finance && (
        <section className="p-5 rounded-2xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] space-y-3">
          <h2 className="text-base font-bold">
            Finance Orders &amp; Anonymized Indian Tax Ledger
          </h2>
          <div className="text-xs font-mono text-[#57534E]">
            Active Orders: {consoleData.finance.orders.length} · Anonymized Retained Tax Records:{' '}
            {consoleData.finance.anonymizedTaxLedger.length}
          </div>
        </section>
      )}

      {/* MODULE 5: ADMIN-ONLY TECHNICAL AREA, CLOUDFLARE FREE-PLAN USAGE, AUDIT LOGS & ASSET LICENSES (Section R) */}
      {(consoleData.securityAudit || consoleData.toolsStudios) && (
        <section className="p-5 rounded-2xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] space-y-5">
          <h2 className="text-base font-bold">
            Admin-Only Technical Registry, Free-Plan Quotas &amp; Hash-Chained Audit Log
          </h2>

          {consoleData.securityAudit?.cloudflareFreePlanUsage && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
              <div className="p-3 rounded-lg bg-[#FAF8F5] dark:bg-[#262320]">
                <div>Workers Requests Today</div>
                <div className="text-base font-bold mt-1">
                  {consoleData.securityAudit.cloudflareFreePlanUsage.workersRequestsToday} /{' '}
                  {consoleData.securityAudit.cloudflareFreePlanUsage.workersDailyLimit}
                </div>
                <div className="text-[#57534E]">
                  Avg CPU: {consoleData.securityAudit.cloudflareFreePlanUsage.workerAvgCpuMs}ms
                  (Limit 10ms)
                </div>
              </div>
              <div className="p-3 rounded-lg bg-[#FAF8F5] dark:bg-[#262320]">
                <div>D1 Database Storage &amp; Reads</div>
                <div className="text-base font-bold mt-1">
                  {consoleData.securityAudit.cloudflareFreePlanUsage.d1StorageMb} MB / 500 MB
                </div>
                <div className="text-[#57534E]">
                  Reads: {consoleData.securityAudit.cloudflareFreePlanUsage.d1RowReadsToday} / 5M
                </div>
              </div>
              <div className="p-3 rounded-lg bg-[#FAF8F5] dark:bg-[#262320]">
                <div>R2 Gated Bundles Storage</div>
                <div className="text-base font-bold mt-1">
                  {consoleData.securityAudit.cloudflareFreePlanUsage.r2StorageMb} MB / 10,240 MB
                </div>
                <div className="text-[#57534E]">Zero user files stored on server</div>
              </div>
            </div>
          )}

          {consoleData.toolsStudios?.assetLicenseRegistry && (
            <div className="space-y-2">
              <div className="text-xs font-semibold">Permissive Visual &amp; Font License Registry</div>
              {consoleData.toolsStudios.assetLicenseRegistry.map((lic: any) => (
                <div
                  key={lic.assetName}
                  className="p-2.5 rounded border border-[#E7E2DA] text-xs flex justify-between"
                >
                  <span className="font-semibold">{lic.assetName}</span>
                  <span className="font-mono text-[#57534E]">{lic.license}</span>
                </div>
              ))}
            </div>
          )}

          {consoleData.securityAudit?.auditLogs && (
            <div className="space-y-2">
              <div className="text-xs font-semibold">
                Tamper-Evident Hash-Chained Audit Trail (Latest Entries)
              </div>
              <div className="max-h-60 overflow-auto space-y-1.5 font-mono text-[11px]">
                {consoleData.securityAudit.auditLogs.slice(0, 12).map((log: any) => (
                  <div
                    key={log.id}
                    className="p-2 rounded bg-[#FAF8F5] dark:bg-[#262320] flex flex-wrap justify-between gap-2"
                  >
                    <span>
                      [{log.id}] {log.actionType} by {log.actorId} ({log.actorRole})
                    </span>
                    <span className="text-[#57534E]">
                      {log.reason} · sha256:{log.entryHash.slice(0, 10)}...
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
