import React, { useState } from 'react';
import {
  CurrencyCode,
  PlanId,
  EntitlementState,
  formatMinorCurrency,
  INITIAL_PLANS,
} from '../core/engine';
import { SUPPORTED_LOCALES, SupportedLocale } from '../core/i18n';
import { LocalActivityEntry } from './StudioWorkspace';
import {
  Shield,
  Trash2,
  Download,
  KeyRound,
  LogOut,
  FileText,
  HelpCircle,
  Bell,
  ArrowUpRight,
} from 'lucide-react';

interface UserAreaProps {
  sessionToken: string;
  userData: {
    id: string;
    identifier: string;
    handle: string;
    avatarCode: string;
    countryCode: string;
    currency: CurrencyCode;
    currencyExplanation: string;
    language: SupportedLocale;
    theme: 'light' | 'dark' | 'system';
    defaultExportFormat: 'PNG' | 'JPEG' | 'WEBP' | 'PDF';
    defaultUnit: 'mm' | 'px' | 'in';
    mfaEnabled: boolean;
    linkedMethods: string[];
    dailyExportsUsed: number;
    createdAt: string;
  };
  entitlement: {
    planId: PlanId;
    state: EntitlementState;
    activatedAt: string | null;
    expiresAt: string | null;
    graceEndsAt: string | null;
  };
  orders: Array<{
    id: string;
    planId: PlanId;
    currency: CurrencyCode;
    finalMinor: number;
    taxMinor: number;
    netMinor: number;
    state: string;
    invoiceNumber: string | null;
    createdAt: string;
  }>;
  hasPriorPaidPurchase: boolean;
  activeSessions: Array<{
    id: string;
    deviceLabel: string;
    createdAt: string;
    isCurrent: boolean;
  }>;
  remainingRecoveryCodes: number;
  tickets: Array<{
    id: string;
    subject: string;
    message: string;
    category: string;
    status: string;
    adminReply: string | null;
    createdAt: string;
  }>;
  notices: Array<{
    id: string;
    title: string;
    body: string;
    createdAt: string;
  }>;
  localRecentActivity: LocalActivityEntry[];
  onClearLocalActivity: () => void;
  onWipeLocalDeviceData: () => void;
  onLaunchStudio: () => void;
  onOpenPlans: () => void;
  onRefreshUser: () => Promise<void>;
  onSignedOutOrDeleted: () => void;
  onShowNewRecoveryKit: (codes: string[]) => void;
}

export const UserAreaView: React.FC<UserAreaProps> = ({
  sessionToken,
  userData,
  entitlement,
  orders,
  hasPriorPaidPurchase,
  activeSessions,
  remainingRecoveryCodes,
  tickets,
  notices,
  localRecentActivity,
  onClearLocalActivity,
  onWipeLocalDeviceData,
  onLaunchStudio,
  onOpenPlans,
  onRefreshUser,
  onSignedOutOrDeleted,
  onShowNewRecoveryKit,
}) => {
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'PROFILE' | 'ACCOUNT' | 'SUPPORT'>(
    'DASHBOARD'
  );
  const [handleInput, setHandleInput] = useState<string>(userData.handle);
  const [avatarInput, setAvatarInput] = useState<string>(userData.avatarCode);
  const [languageInput, setLanguageInput] = useState<SupportedLocale>(userData.language);
  const [themeInput, setThemeInput] = useState<'light' | 'dark' | 'system'>(userData.theme);
  const [formatInput, setFormatInput] = useState<'PNG' | 'JPEG' | 'WEBP' | 'PDF'>(
    userData.defaultExportFormat
  );
  const [unitInput, setUnitInput] = useState<'mm' | 'px' | 'in'>(userData.defaultUnit);

  const [ticketSubject, setTicketSubject] = useState<string>('');
  const [ticketMessage, setTicketMessage] = useState<string>('');
  const [ticketCategory, setTicketCategory] = useState<'GENERAL' | 'BILLING' | 'RECOVERY_REQUEST'>(
    'GENERAL'
  );
  const [deleteConfirmText, setDeleteConfirmText] = useState<string>('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const planDef = INITIAL_PLANS[entitlement.planId] || INITIAL_PLANS.FREE;
  // Section U: Upgrade is hidden for the top plan (PREMIUM_ANNUAL)
  const isTopPlan = entitlement.planId === 'PREMIUM_ANNUAL' && entitlement.state === 'ACTIVE';

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const resp = await fetch('/api/user/profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        handle: handleInput,
        avatarCode: avatarInput,
        language: languageInput,
        theme: themeInput,
        defaultExportFormat: formatInput,
        defaultUnit: unitInput,
      }),
    });
    if (resp.ok) {
      await onRefreshUser();
      setFeedback('Profile and workspace preferences saved.');
    }
  };

  const handleToggleMfa = async () => {
    await fetch('/api/user/profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        mfaEnabled: !userData.mfaEnabled,
      }),
    });
    await onRefreshUser();
    setFeedback(
      !userData.mfaEnabled
        ? 'Two-step verification enabled for your account.'
        : 'Two-step verification turned off.'
    );
  };

  const handleRegenerateCodes = async () => {
    const resp = await fetch('/api/user/regenerate-recovery-codes', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    const data = await resp.json();
    if (resp.ok && data.oneTimeRecoveryKit) {
      onShowNewRecoveryKit(data.oneTimeRecoveryKit);
      await onRefreshUser();
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    await fetch('/api/user/revoke-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({ sessionId }),
    });
    await onRefreshUser();
  };

  const handleExportMyDataJson = () => {
    const exportPayload = {
      exportedAt: new Date().toISOString(),
      profile: userData,
      entitlement,
      orders,
      tickets,
      privacyNote: 'Zero user studio files are ever stored on any server.',
    };
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `varnank-account-data-${userData.id.toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadInvoice = (ord: UserAreaProps['orders'][number]) => {
    const invoiceLines = [
      'VARNANK STUDIOS — TAX INVOICE',
      '==================================================',
      `Invoice Number : ${ord.invoiceNumber || ord.id}`,
      `Order ID       : ${ord.id}`,
      `Date           : ${new Date(ord.createdAt).toLocaleDateString()}`,
      `Account Handle : ${userData.handle} (${userData.countryCode})`,
      `Plan           : ${INITIAL_PLANS[ord.planId]?.name || ord.planId}`,
      `Currency       : ${ord.currency} (Locked at Sign-Up)`,
      '--------------------------------------------------',
      `Net Amount     : ${formatMinorCurrency(ord.netMinor, ord.currency)}`,
      `Tax / GST      : ${formatMinorCurrency(ord.taxMinor, ord.currency)}`,
      `Total Paid     : ${formatMinorCurrency(ord.finalMinor, ord.currency)}`,
      '==================================================',
    ].join('\n');

    const blob = new Blob([invoiceLines], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(ord.invoiceNumber || ord.id).toLowerCase()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    const resp = await fetch('/api/user/support-ticket', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        subject: ticketSubject,
        message: ticketMessage,
        category: ticketCategory,
      }),
    });
    if (resp.ok) {
      setTicketSubject('');
      setTicketMessage('');
      await onRefreshUser();
      setFeedback('Support request submitted.');
    }
  };

  const handleImmediateDeleteAccount = async () => {
    const resp = await fetch('/api/user/delete-account', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({ confirmPhrase: deleteConfirmText }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      setFeedback(data.error || 'Please type DELETE to confirm.');
      return;
    }
    onWipeLocalDeviceData();
    onSignedOutOrDeleted();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 pb-24">
      {/* Header & Section U Navigation */}
      <div className="pb-6 border-b border-[#E7E2DA] dark:border-[#2E2B28] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          {/* Abstract Geometric / Initial Avatar (No Photo Upload per Section D & U) */}
          <div className="w-12 h-12 rounded-xl bg-[#181615] text-[#FAF8F5] dark:bg-[#F5F2EB] dark:text-[#121110] flex items-center justify-center font-mono font-bold text-base shrink-0">
            {userData.avatarCode}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#181615] dark:text-[#F5F2EB]">
              {userData.handle}
            </h1>
            <div className="flex items-center gap-2 text-xs text-[#57534E] dark:text-[#A8A29E] font-mono">
              <span>{planDef.name}</span>
              <span aria-hidden="true">·</span>
              <span>State: {entitlement.state}</span>
              <span aria-hidden="true">·</span>
              <span>Currency: {userData.currency}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(['DASHBOARD', 'PROFILE', 'ACCOUNT', 'SUPPORT'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setFeedback(null);
                setActiveTab(tab);
              }}
              className={`min-h-[40px] px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                activeTab === tab
                  ? 'bg-[#181615] text-[#FAF8F5] dark:bg-[#F5F2EB] dark:text-[#121110]'
                  : 'bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28]'
              }`}
            >
              {tab === 'DASHBOARD'
                ? 'Home / Dashboard'
                : tab === 'PROFILE'
                ? 'Profile'
                : tab === 'ACCOUNT'
                ? 'Account & Security'
                : 'Help / Support'}
            </button>
          ))}
          <button
            type="button"
            onClick={onSignedOutOrDeleted}
            className="min-h-[40px] px-3 py-1.5 text-xs font-medium text-[#B91C1C] border border-[#E7E2DA] dark:border-[#2E2B28] rounded-lg flex items-center gap-1"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className="mt-4 p-3.5 rounded-xl bg-white dark:bg-[#1C1A18] border border-[#B44C32] text-xs">
          {feedback}
        </div>
      )}

      {/* TAB 1: HOME / DASHBOARD (Section U) */}
      {activeTab === 'DASHBOARD' && (
        <div className="mt-6 space-y-6">
          {/* Admin Notices (Automatically hidden if none exist per Section U) */}
          {notices.length > 0 && (
            <div className="p-4 rounded-xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#B44C32] dark:text-[#E06D53]">
                <Bell className="w-3.5 h-3.5" />
                <span>Platform Notice</span>
              </div>
              {notices.map((n) => (
                <div key={n.id} className="text-xs text-[#181615] dark:text-[#F5F2EB]">
                  <span className="font-semibold">{n.title}: </span>
                  <span className="text-[#57534E] dark:text-[#A8A29E]">{n.body}</span>
                </div>
              ))}
            </div>
          )}

          {/* Plan Status, Expiry, Usage Meters & Conditional Upgrade Prompt */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="p-5 rounded-xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] space-y-2">
              <div className="text-xs text-[#57534E] dark:text-[#A8A29E]">Current Plan</div>
              <div className="text-xl font-bold text-[#181615] dark:text-[#F5F2EB]">
                {planDef.name} ({planDef.codeLabel})
              </div>
              <div className="text-xs font-mono text-[#57534E] dark:text-[#A8A29E]">
                Status: {entitlement.state}
                {entitlement.expiresAt
                  ? ` · Valid until ${new Date(entitlement.expiresAt).toLocaleDateString()}`
                  : ' · Standard Account'}
              </div>
            </div>

            <div className="p-5 rounded-xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] space-y-2">
              <div className="text-xs text-[#57534E] dark:text-[#A8A29E]">Daily Usage Meter</div>
              <div className="text-xl font-bold font-mono tabular-nums text-[#181615] dark:text-[#F5F2EB]">
                {userData.dailyExportsUsed} /{' '}
                {planDef.dailyExportLimit === -1 ? 'Unlimited' : planDef.dailyExportLimit}
              </div>
              <div className="text-xs text-[#57534E] dark:text-[#A8A29E]">
                Exports completed today · Max batch: {planDef.batchLimit} files
              </div>
            </div>

            {/* Upgrade Prompt: Hidden automatically for top plan (PREMIUM_ANNUAL) per Section U */}
            {!isTopPlan ? (
              <div className="p-5 rounded-xl bg-white dark:bg-[#1C1A18] border border-[#B44C32] flex flex-col justify-between">
                <div>
                  <div className="text-xs font-semibold text-[#B44C32] dark:text-[#E06D53]">
                    Unlock Pro Studio Bundles
                  </div>
                  <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mt-1">
                    Get multi-copy ID sheets, permanent PDF redaction, print bleed marks, and batch
                    processing.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onOpenPlans}
                  className="mt-3 min-h-[40px] px-4 py-2 text-xs font-semibold text-[#FAF8F5] bg-[#B44C32] rounded-lg flex items-center justify-center gap-1"
                >
                  <span>View Upgrade Options</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="p-5 rounded-xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] space-y-2">
                <div className="text-xs font-semibold text-[#15803D]">Top Tier Active</div>
                <div className="text-sm font-bold">All Paid &amp; Premium Studios Unlocked</div>
                <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">
                  Up to 4 concurrent devices and 100-file batch mode active.
                </p>
              </div>
            )}
          </div>

          {/* Quick Studio Launch & Local-Only Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-5 rounded-xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] space-y-3">
              <h2 className="text-sm font-bold">Quick Launch Studios</h2>
              <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">
                Open any browser-side studio directly. Your files never leave your device.
              </p>
              <button
                type="button"
                onClick={onLaunchStudio}
                className="min-h-[44px] px-4 py-2 text-xs font-semibold text-[#FAF8F5] bg-[#181615] dark:bg-[#F5F2EB] dark:text-[#121110] rounded-lg"
              >
                Open Studio Workspace (S1–S4)
              </button>
            </div>

            <div className="p-5 rounded-xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold">Local-Only Recent Activity (Stays on Device)</h2>
                {localRecentActivity.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearLocalActivity}
                    className="text-xs text-[#B91C1C] underline"
                  >
                    Clear Activity
                  </button>
                )}
              </div>

              {localRecentActivity.length === 0 ? (
                <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">
                  No local exports recorded in this browser session yet.
                </p>
              ) : (
                <ul className="space-y-2 text-xs">
                  {localRecentActivity.map((act) => (
                    <li
                      key={act.id}
                      className="py-2 border-b border-[#E7E2DA] dark:border-[#2E2B28] flex items-center justify-between font-mono"
                    >
                      <span>
                        {act.studioName} · {act.presetCode} ({act.exportFormat})
                      </span>
                      <span className="text-[#57534E]">{act.timestamp}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PROFILE (Section U) */}
      {activeTab === 'PROFILE' && (
        <form
          onSubmit={handleSaveProfile}
          className="mt-6 max-w-2xl p-6 rounded-xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] space-y-4"
        >
          <h2 className="text-base font-bold">Profile &amp; Workspace Preferences</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="prof-handle" className="block text-xs font-medium mb-1">
                Display Name / Handle
              </label>
              <input
                id="prof-handle"
                type="text"
                value={handleInput}
                onChange={(e) => setHandleInput(e.target.value)}
                className="w-full min-h-[40px] px-3 py-1.5 text-xs rounded-lg bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA]"
              />
            </div>

            <div>
              <label htmlFor="prof-avatar" className="block text-xs font-medium mb-1">
                Initial / Monogram Badge (No Photo Upload)
              </label>
              <input
                id="prof-avatar"
                type="text"
                maxLength={3}
                value={avatarInput}
                onChange={(e) => setAvatarInput(e.target.value.toUpperCase())}
                className="w-full min-h-[40px] px-3 py-1.5 text-xs font-mono rounded-lg bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA]"
              />
            </div>

            <div>
              <label htmlFor="prof-lang" className="block text-xs font-medium mb-1">
                Interface Language
              </label>
              <select
                id="prof-lang"
                value={languageInput}
                onChange={(e) => setLanguageInput(e.target.value as SupportedLocale)}
                className="w-full min-h-[40px] px-3 py-1.5 text-xs rounded-lg bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA]"
              >
                {SUPPORTED_LOCALES.map((loc) => (
                  <option key={loc.code} value={loc.code}>
                    {loc.label} ({loc.nativeLabel})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="prof-theme" className="block text-xs font-medium mb-1">
                Workspace Theme
              </label>
              <select
                id="prof-theme"
                value={themeInput}
                onChange={(e) =>
                  setThemeInput(e.target.value as 'light' | 'dark' | 'system')
                }
                className="w-full min-h-[40px] px-3 py-1.5 text-xs rounded-lg bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA]"
              >
                <option value="light">Warm Minimal Light</option>
                <option value="dark">Obsidian Dark</option>
                <option value="system">Match System Setting</option>
              </select>
            </div>

            <div>
              <label htmlFor="prof-format" className="block text-xs font-medium mb-1">
                Default Export Format
              </label>
              <select
                id="prof-format"
                value={formatInput}
                onChange={(e) =>
                  setFormatInput(e.target.value as 'PNG' | 'JPEG' | 'WEBP' | 'PDF')
                }
                className="w-full min-h-[40px] px-3 py-1.5 text-xs rounded-lg bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA]"
              >
                <option value="PNG">PNG</option>
                <option value="JPEG">JPEG</option>
                <option value="WEBP">WebP</option>
                <option value="PDF">PDF</option>
              </select>
            </div>

            <div>
              <label htmlFor="prof-unit" className="block text-xs font-medium mb-1">
                Default Measurement Unit
              </label>
              <select
                id="prof-unit"
                value={unitInput}
                onChange={(e) => setUnitInput(e.target.value as 'mm' | 'px' | 'in')}
                className="w-full min-h-[40px] px-3 py-1.5 text-xs rounded-lg bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA]"
              >
                <option value="mm">Millimeters (mm)</option>
                <option value="px">Pixels (px)</option>
                <option value="in">Inches (in)</option>
              </select>
            </div>
          </div>

          <div className="pt-2">
            <div className="text-xs font-medium mb-1">Linked Sign-In Methods</div>
            <div className="text-xs text-[#57534E] font-mono">
              {userData.linkedMethods.join(' · ')}
            </div>
          </div>

          <button
            type="submit"
            className="min-h-[44px] px-5 py-2 text-xs font-semibold text-[#FAF8F5] bg-[#B44C32] rounded-lg"
          >
            Save Profile Preferences
          </button>
        </form>
      )}

      {/* TAB 3: ACCOUNT, BILLING, SECURITY & PRIVACY (Section U) */}
      {activeTab === 'ACCOUNT' && (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Read-Only Locked Currency Card (Section C & U) */}
          <div className="p-5 rounded-xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] space-y-2">
            <h2 className="text-sm font-bold">Account Currency (Read-Only)</h2>
            <div className="text-lg font-mono font-bold text-[#181615] dark:text-[#F5F2EB]">
              {userData.currency} ({userData.countryCode})
            </div>
            <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">
              {userData.currencyExplanation}
            </p>
          </div>

          {/* Billing & Invoices: Hidden automatically if user has never purchased (Section U) */}
          {hasPriorPaidPurchase ? (
            <div className="p-5 rounded-xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] space-y-3">
              <h2 className="text-sm font-bold">Billing History &amp; Tax Invoices</h2>
              <ul className="space-y-2 text-xs">
                {orders.map((ord) => (
                  <li
                    key={ord.id}
                    className="py-2 border-b border-[#E7E2DA] flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-semibold">
                        {INITIAL_PLANS[ord.planId]?.name || ord.planId} ·{' '}
                        {formatMinorCurrency(ord.finalMinor, ord.currency)}
                      </div>
                      <div className="text-[#57534E] font-mono">
                        {ord.invoiceNumber || ord.id} · {ord.state}
                      </div>
                    </div>
                    {ord.state === 'PAID' && (
                      <button
                        type="button"
                        onClick={() => handleDownloadInvoice(ord)}
                        className="min-h-[36px] px-3 py-1 text-xs font-medium border border-[#E7E2DA] rounded-lg"
                      >
                        Download Invoice
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="p-5 rounded-xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] space-y-2">
              <h2 className="text-sm font-bold">Plan &amp; Upgrade</h2>
              <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">
                You are currently on the Freemium Account plan. Billing history and invoices appear
                here automatically after your first plan purchase.
              </p>
              <button
                type="button"
                onClick={onOpenPlans}
                className="min-h-[40px] px-4 py-2 text-xs font-semibold text-[#FAF8F5] bg-[#B44C32] rounded-lg"
              >
                Explore Paid Plans
              </button>
            </div>
          )}

          {/* Security: Passkeys, Active Sessions, MFA, Recovery Kit */}
          <div className="p-5 rounded-xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] space-y-4">
            <h2 className="text-sm font-bold">Security, Devices &amp; Recovery Codes</h2>

            <div className="flex items-center justify-between text-xs">
              <div>
                <div className="font-semibold">Two-Step Verification (MFA)</div>
                <div className="text-[#57534E]">Optional extra protection at sign-in</div>
              </div>
              <button
                type="button"
                onClick={handleToggleMfa}
                className="min-h-[38px] px-3 py-1.5 font-medium border border-[#E7E2DA] rounded-lg"
              >
                {userData.mfaEnabled ? 'Enabled (Turn Off)' : 'Enable MFA'}
              </button>
            </div>

            <div className="flex items-center justify-between text-xs pt-2 border-t border-[#E7E2DA]">
              <div>
                <div className="font-semibold">One-Time Recovery Codes</div>
                <div className="text-[#57534E] font-mono">
                  {remainingRecoveryCodes} unused codes remaining
                </div>
              </div>
              <button
                type="button"
                onClick={handleRegenerateCodes}
                className="min-h-[38px] px-3 py-1.5 font-medium border border-[#E7E2DA] rounded-lg"
              >
                Regenerate 10 Codes
              </button>
            </div>

            <div className="pt-2 border-t border-[#E7E2DA] space-y-2">
              <div className="text-xs font-semibold">Active Sessions &amp; Devices</div>
              {activeSessions.map((ses) => (
                <div
                  key={ses.id}
                  className="flex items-center justify-between text-xs py-1.5"
                >
                  <div>
                    <span className="font-medium">{ses.deviceLabel}</span>
                    {ses.isCurrent && (
                      <span className="ml-2 text-[#15803D] font-mono">(Current)</span>
                    )}
                  </div>
                  {!ses.isCurrent && (
                    <button
                      type="button"
                      onClick={() => handleRevokeSession(ses.id)}
                      className="text-xs text-[#B91C1C] underline"
                    >
                      Log Out Device
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Privacy, DPDP/GDPR Data Export, Wipe Local Data & Immediate Delete Account */}
          <div className="p-5 rounded-xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] space-y-4">
            <h2 className="text-sm font-bold">Privacy, Local Data Wipe &amp; Account Erasure</h2>
            <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">
              Consent Status: Active ({userData.countryCode} · DPDP Act 2023 &amp; GDPR). Zero
              analytics or tracking cookies are used.
            </p>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleExportMyDataJson}
                className="min-h-[40px] px-3.5 py-2 text-xs font-medium border border-[#E7E2DA] rounded-lg flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export My Account Data</span>
              </button>
              <button
                type="button"
                onClick={onWipeLocalDeviceData}
                className="min-h-[40px] px-3.5 py-2 text-xs font-medium border border-[#E7E2DA] rounded-lg flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5 text-[#B44C32]" />
                <span>Wipe Local Device Data</span>
              </button>
            </div>

            <div className="pt-3 border-t border-[#E7E2DA] space-y-2">
              <div className="text-xs font-semibold text-[#B91C1C]">
                Permanent Account Deletion (Immediate Erasure)
              </div>
              <p className="text-xs text-[#57534E]">
                Immediately erases your credentials, profile, recovery codes, sessions, and
                entitlements. Type <span className="font-mono font-bold">DELETE</span> to confirm.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  aria-label="Type DELETE to confirm account erasure"
                  placeholder="Type DELETE"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="flex-1 min-h-[40px] px-3 py-1.5 text-xs font-mono rounded-lg bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA]"
                />
                <button
                  type="button"
                  onClick={handleImmediateDeleteAccount}
                  className="min-h-[40px] px-4 py-1.5 text-xs font-semibold bg-[#B91C1C] text-white rounded-lg"
                >
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: HELP & SUPPORT (Decision Log Q1) */}
      {activeTab === 'SUPPORT' && (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form
            onSubmit={handleSubmitTicket}
            className="p-5 rounded-xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] space-y-4"
          >
            <h2 className="text-sm font-bold">Contact Support or Request Assistance</h2>

            <div>
              <label htmlFor="tkt-cat" className="block text-xs font-medium mb-1">
                Category
              </label>
              <select
                id="tkt-cat"
                value={ticketCategory}
                onChange={(e) =>
                  setTicketCategory(
                    e.target.value as 'GENERAL' | 'BILLING' | 'RECOVERY_REQUEST'
                  )
                }
                className="w-full min-h-[40px] px-3 py-1.5 text-xs rounded-lg bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA]"
              >
                <option value="GENERAL">General Workspace Help</option>
                <option value="BILLING">Plan or Invoice Question</option>
                <option value="RECOVERY_REQUEST">Admin-Assisted Account Recovery</option>
              </select>
            </div>

            <div>
              <label htmlFor="tkt-subj" className="block text-xs font-medium mb-1">
                Subject
              </label>
              <input
                id="tkt-subj"
                type="text"
                required
                value={ticketSubject}
                onChange={(e) => setTicketSubject(e.target.value)}
                placeholder="Brief summary of your question"
                className="w-full min-h-[40px] px-3 py-1.5 text-xs rounded-lg bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA]"
              />
            </div>

            <div>
              <label htmlFor="tkt-msg" className="block text-xs font-medium mb-1">
                Details
              </label>
              <textarea
                id="tkt-msg"
                rows={4}
                required
                value={ticketMessage}
                onChange={(e) => setTicketMessage(e.target.value)}
                placeholder="Describe how we can help (include any ERR-XXXX reference code if shown)"
                className="w-full p-3 text-xs rounded-lg bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA]"
              />
            </div>

            <button
              type="submit"
              className="min-h-[40px] px-4 py-2 text-xs font-semibold text-[#FAF8F5] bg-[#B44C32] rounded-lg"
            >
              Submit Support Ticket
            </button>
          </form>

          <div className="p-5 rounded-xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] space-y-3">
            <h2 className="text-sm font-bold">Your Support Tickets</h2>
            {tickets.length === 0 ? (
              <p className="text-xs text-[#57534E]">You have no open support tickets.</p>
            ) : (
              <ul className="space-y-3 text-xs">
                {tickets.map((tkt) => (
                  <li key={tkt.id} className="p-3 rounded-lg bg-[#FAF8F5] dark:bg-[#262320] space-y-1">
                    <div className="flex justify-between font-mono text-[11px] text-[#57534E]">
                      <span>
                        {tkt.id} · {tkt.category}
                      </span>
                      <span>{tkt.status}</span>
                    </div>
                    <div className="font-semibold">{tkt.subject}</div>
                    <p className="text-[#57534E]">{tkt.message}</p>
                    {tkt.adminReply && (
                      <div className="mt-2 pt-2 border-t border-[#E7E2DA] text-[#15803D]">
                        Support Response: {tkt.adminReply}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
