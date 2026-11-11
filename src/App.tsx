import React, { useState, useEffect, useCallback } from 'react';
import { TopBar, ActiveRoute } from './components/TopBar';
import { StudioWorkspace, LocalActivityEntry } from './components/StudioWorkspace';
import { AuthView, RecoveryKitModal } from './components/AuthModalAndViews';
import { PlansAndPaymentView } from './components/PlansAndPaymentView';
import { UserAreaView } from './components/UserAreaView';
import { HiddenAdminConsole } from './components/HiddenAdminConsole';
import {
  INITIAL_PRESETS,
  INITIAL_PLANS,
  STUDIO_TOOLS,
  DEFAULT_COUNTRY_CURRENCY_TABLE,
  PresetDefinition,
  StudioId,
} from './core/engine';
import { SUPPORTED_LOCALES, SupportedLocale, UI_DICTIONARY } from './core/i18n';

export default function App() {
  const [activeRoute, setActiveRoute] = useState<ActiveRoute>('STUDIOS');
  const [adminPortalSlug, setAdminPortalSlug] = useState<string>('');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  // Public catalog state
  const [studios, setStudios] = useState<
    Array<{ id: StudioId; codeLabel: string; name: string; summary: string }>
  >([
    {
      id: 'S1',
      codeLabel: 'Photo & Image',
      name: 'Photo / Image Studio',
      summary: 'Crop, resize, convert formats, balance tone, and batch-watermark visuals on your device.',
    },
    {
      id: 'S2',
      codeLabel: 'PDF Documents',
      name: 'PDF Studio',
      summary: 'Merge, split, reorder pages, redact sensitive areas, and clean document metadata.',
    },
    {
      id: 'S3',
      codeLabel: 'ID & Passports',
      name: 'ID / Govt. ID Studio',
      summary: 'Format exact passport, visa, and signature dimensions and generate multi-copy print sheets.',
    },
    {
      id: 'S4',
      codeLabel: 'Print & Press',
      name: 'Print & Publication Studio',
      summary: 'Compose publication cards, vector emblems, and press-ready layouts with bleed and crop marks.',
    },
  ]);
  const [tools, setTools] = useState(STUDIO_TOOLS);
  const [presets, setPresets] = useState<PresetDefinition[]>(INITIAL_PRESETS);
  const [plans, setPlans] = useState<any[]>(Object.values(INITIAL_PLANS));
  const [countryCodes, setCountryCodes] = useState(
    DEFAULT_COUNTRY_CURRENCY_TABLE.filter((c) => c.countryCode !== 'DEFAULT')
  );
  const [enabledSignInMethods, setEnabledSignInMethods] = useState({
    passkey: true,
    emailOtp: false,
    googleOAuth: false,
    password: false,
    appleOAuth: false,
    smsOtp: false,
    xOAuth: false,
  });

  // Session & User state
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [adminSessionToken, setAdminSessionToken] = useState<string | null>(null);
  const [entitlementToken, setEntitlementToken] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [userEntitlement, setUserEntitlement] = useState<any | null>(null);
  const [userOrders, setUserOrders] = useState<any[]>([]);
  const [hasPriorPaidPurchase, setHasPriorPaidPurchase] = useState<boolean>(false);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [remainingRecoveryCodes, setRemainingRecoveryCodes] = useState<number>(10);
  const [userTickets, setUserTickets] = useState<any[]>([]);
  const [notices, setNotices] = useState<any[]>([]);
  const [oneTimeRecoveryKitModal, setOneTimeRecoveryKitModal] = useState<string[] | null>(null);

  // Local-only device state (Never sent to server)
  const [userCustomPresets, setUserCustomPresets] = useState<PresetDefinition[]>([]);
  const [localRecentActivity, setLocalRecentActivity] = useState<LocalActivityEntry[]>([]);
  const [selectedPresetFromLibrary, setSelectedPresetFromLibrary] =
    useState<PresetDefinition | null>(null);
  const [localDailyExportsCount, setLocalDailyExportsCount] = useState<number>(() => {
    try {
      const todayKey = `varnank_daily_exports_${new Date().toISOString().slice(0, 10)}`;
      return Math.max(0, Number(localStorage.getItem(todayKey)) || 0);
    } catch {
      return 0;
    }
  });
  const [pendingExternalLink, setPendingExternalLink] = useState<{
    url: string;
    label: string;
  } | null>(null);

  const currentLocale: SupportedLocale = userProfile?.language || 'en';
  const currentTheme: 'light' | 'dark' | 'system' = userProfile?.theme || 'light';

  // Immediate internal go-to / move-to route & work area helper (zero warnings for internal links)
  const navigateImmediatelyTo = useCallback((nextRoute: ActiveRoute) => {
    if (nextRoute === 'AUTH') {
      setIsAuthModalOpen(true);
      return;
    }
    setIsAuthModalOpen(false);
    if (nextRoute === 'HIDDEN_ADMIN') {
      window.location.hash = '#/admin';
      setAdminPortalSlug('admin');
    }
    setActiveRoute(nextRoute);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      const mainEl = document.getElementById('app-main-content');
      if (mainEl && typeof mainEl.focus === 'function') {
        mainEl.focus({ preventScroll: true });
      }
    }
  }, []);

  // Global listener: Warn user ONLY if a clicked link or button points to an external URL
  useEffect(() => {
    const handleGlobalDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const externalTrigger = target.closest('a[href], [data-external-url]') as HTMLElement | null;
      if (!externalTrigger) return;

      const rawHref =
        externalTrigger.getAttribute('data-external-url') ||
        externalTrigger.getAttribute('href') ||
        '';
      if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('/') || rawHref.startsWith('blob:') || rawHref.startsWith('data:')) {
        return;
      }

      try {
        const parsed = new URL(rawHref, window.location.origin);
        if (parsed.origin !== window.location.origin) {
          e.preventDefault();
          e.stopPropagation();
          setPendingExternalLink({
            url: parsed.href,
            label: (externalTrigger.textContent || parsed.hostname).trim(),
          });
        }
      } catch {
        // Ignore malformed href
      }
    };

    document.addEventListener('click', handleGlobalDocumentClick, true);
    return () => document.removeEventListener('click', handleGlobalDocumentClick, true);
  }, []);

  // Sync light/dark class on <html>
  useEffect(() => {
    const root = document.documentElement;
    const isDark =
      currentTheme === 'dark' ||
      (currentTheme === 'system' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    const locMeta = SUPPORTED_LOCALES.find((l) => l.code === currentLocale);
    root.dir = locMeta?.dir || 'ltr';
    root.lang = currentLocale;
  }, [currentTheme, currentLocale]);

  // Support unified Admin Portal route (`/#/admin` or `/admin`) as well as category slugs
  useEffect(() => {
    const checkPortalRoute = () => {
      const hash = window.location.hash;
      const path = window.location.pathname;
      if (
        hash === '#/admin' ||
        hash === '#admin' ||
        hash.startsWith('#/admin/') ||
        path === '/admin' ||
        path.startsWith('/admin/')
      ) {
        setAdminPortalSlug('admin');
        setActiveRoute('HIDDEN_ADMIN');
        return;
      }
      const match =
        hash.match(/^#\/_cp\/portal\/([a-z0-9-]+)$/i) ||
        path.match(/^\/_cp\/portal\/([a-z0-9-]+)$/i);
      if (match) {
        setAdminPortalSlug(match[1]);
        setActiveRoute('HIDDEN_ADMIN');
      }
    };
    checkPortalRoute();
    window.addEventListener('hashchange', checkPortalRoute);
    return () => window.removeEventListener('hashchange', checkPortalRoute);
  }, []);

  const fetchPublicCatalog = useCallback(async () => {
    try {
      const resp = await fetch('/api/public/catalog');
      if (!resp.ok) return;
      const data = await resp.json();
      if (data.studios) setStudios(data.studios);
      if (data.tools) setTools(data.tools);
      if (data.presets) setPresets(data.presets);
      if (data.plans) setPlans(data.plans);
      if (data.countryCodes) setCountryCodes(data.countryCodes);
      if (data.enabledSignInMethods) setEnabledSignInMethods(data.enabledSignInMethods);
      if (data.notices) setNotices(data.notices);
    } catch {
      // Fallback to local constants if offline
    }
  }, []);

  const fetchAuthenticatedUser = useCallback(
    async (tok?: string | null) => {
      const activeTok = tok ?? sessionToken;
      if (!activeTok) return;
      try {
        const resp = await fetch('/api/user/me', {
          headers: { Authorization: `Bearer ${activeTok}` },
        });
        if (!resp.ok) return;
        const data = await resp.json();
        setUserProfile(data.user);
        setUserEntitlement(data.entitlement);
        setEntitlementToken(data.entitlementToken);
        if (data.personalizedPlans) setPlans(data.personalizedPlans);
        setUserOrders(data.orders || []);
        setHasPriorPaidPurchase(Boolean(data.hasPriorPaidPurchase));
        setActiveSessions(data.activeSessions || []);
        setRemainingRecoveryCodes(data.remainingRecoveryCodes ?? 10);
        setUserTickets(data.tickets || []);
        if (data.notices) setNotices(data.notices);
      } catch {
        // Ignore transient network errors
      }
    },
    [sessionToken]
  );

  useEffect(() => {
    fetchPublicCatalog();
  }, [fetchPublicCatalog]);

  const handleWipeAllLocalDeviceData = () => {
    setUserCustomPresets([]);
    setLocalRecentActivity([]);
    setLocalDailyExportsCount(0);
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // Ignore storage error
    }
  };

  const handleAuthenticatedSuccess = async (payload: {
    sessionToken: string;
    adminSessionToken?: string | null;
    entitlementToken: string;
    user: any;
    entitlement: any;
    oneTimeRecoveryKit?: string[];
    openAdminConsoleDirectly?: boolean;
  }) => {
    setSessionToken(payload.sessionToken);
    if (payload.adminSessionToken) {
      setAdminSessionToken(payload.adminSessionToken);
    }
    setEntitlementToken(payload.entitlementToken);
    setUserProfile(payload.user);
    setUserEntitlement(payload.entitlement);
    if (payload.oneTimeRecoveryKit) {
      setOneTimeRecoveryKitModal(payload.oneTimeRecoveryKit);
    }
    setIsAuthModalOpen(false);
    await fetchAuthenticatedUser(payload.sessionToken);
    if (payload.openAdminConsoleDirectly) {
      window.location.hash = '#/admin';
      setAdminPortalSlug('admin');
      setActiveRoute('HIDDEN_ADMIN');
    } else {
      setActiveRoute('DASHBOARD');
    }
  };

  const t = UI_DICTIONARY[currentLocale] || UI_DICTIONARY.en;
  const activePlanObj =
    plans.find((p) => p.id === (userEntitlement?.planId || 'FREE')) || INITIAL_PLANS.FREE;
  const activeEntitlementState =
    userEntitlement?.state || (sessionToken ? 'FREE' : 'NONE');

  if (activeRoute === 'HIDDEN_ADMIN') {
    return (
      <div className="min-h-screen bg-[#FAF8F5] dark:bg-[#121110] text-[#181615] dark:text-[#F5F2EB]">
        <HiddenAdminConsole
          portalSlug={adminPortalSlug || 'admin'}
          initialAdminToken={adminSessionToken || sessionToken}
          onExitPortal={() => {
            window.location.hash = '';
            setActiveRoute('STUDIOS');
          }}
          onSwitchPortalSlug={(nextSlug) => {
            window.location.hash = nextSlug === 'admin' ? '#/admin' : `#/_cp/portal/${nextSlug}`;
            setAdminPortalSlug(nextSlug);
          }}
          onCatalogUpdated={fetchPublicCatalog}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] dark:bg-[#121110] text-[#181615] dark:text-[#F5F2EB]">
      <TopBar
        activeRoute={isAuthModalOpen ? 'AUTH' : activeRoute}
        onNavigate={navigateImmediatelyTo}
        isSignedIn={Boolean(sessionToken && userProfile)}
        userHandle={userProfile?.handle}
        userRoleCategory={userProfile?.role}
        activePlanName={activePlanObj?.name}
        hasAdminAccess={Boolean(
          adminSessionToken ||
            (userProfile?.role &&
              userProfile.role !== 'USER' &&
              userProfile.role !== 'NONE')
        )}
        locale={currentLocale}
      />

      <main id="app-main-content" tabIndex={-1} className="flex-1 outline-none">
        {(activeRoute === 'STUDIOS' || activeRoute === 'PRESETS') && (
          <StudioWorkspace
            studios={studios}
            tools={tools}
            presets={presets}
            userCustomPresets={userCustomPresets}
            onSaveLocalPreset={(p) => setUserCustomPresets((prev) => [p, ...prev])}
            sessionToken={sessionToken}
            entitlementToken={entitlementToken}
            activePlan={activePlanObj}
            entitlementState={activeEntitlementState}
            initialPresetToApply={selectedPresetFromLibrary}
            onConsumedInitialPreset={() => setSelectedPresetFromLibrary(null)}
            onRequestUpgrade={() => navigateImmediatelyTo('PLANS')}
            onRecordLocalActivity={(entry) =>
              setLocalRecentActivity((prev) => [entry, ...prev.slice(0, 19)])
            }
            onWipeAllLocalData={handleWipeAllLocalDeviceData}
            defaultExportFormat={userProfile?.defaultExportFormat || 'PNG'}
            onDailyExportsCountChange={(count) => setLocalDailyExportsCount(count)}
          />
        )}

        {activeRoute === 'PLANS' && (
          <PlansAndPaymentView
            plans={plans}
            isSignedIn={Boolean(sessionToken && userProfile)}
            lockedCurrency={userProfile?.currency}
            currencyExplanation={userProfile?.currencyExplanation}
            currentPlanId={userEntitlement?.planId}
            currentEntitlementState={userEntitlement?.state}
            sessionToken={sessionToken}
            onRequireSignIn={() => setIsAuthModalOpen(true)}
            onOrderActivated={() => fetchAuthenticatedUser(sessionToken)}
          />
        )}

        {activeRoute === 'AUTH' && (
          <AuthView
            countryCodes={countryCodes}
            enabledMethods={enabledSignInMethods}
            onAuthenticated={handleAuthenticatedSuccess}
          />
        )}

        {activeRoute === 'DASHBOARD' && sessionToken && userProfile && userEntitlement && (
          <UserAreaView
            sessionToken={sessionToken}
            userData={{
              ...userProfile,
              dailyExportsUsed: Math.max(
                Number(userProfile.dailyExportsUsed || 0),
                localDailyExportsCount
              ),
            }}
            entitlement={userEntitlement}
            orders={userOrders}
            hasPriorPaidPurchase={hasPriorPaidPurchase}
            activeSessions={activeSessions}
            remainingRecoveryCodes={remainingRecoveryCodes}
            tickets={userTickets}
            notices={notices}
            localRecentActivity={localRecentActivity}
            onClearLocalActivity={() => setLocalRecentActivity([])}
            onWipeLocalDeviceData={handleWipeAllLocalDeviceData}
            onLaunchStudio={() => navigateImmediatelyTo('STUDIOS')}
            onOpenPlans={() => navigateImmediatelyTo('PLANS')}
            onRefreshUser={() => fetchAuthenticatedUser(sessionToken)}
            onSignedOutOrDeleted={() => {
              setSessionToken(null);
              setAdminSessionToken(null);
              setEntitlementToken(null);
              setUserProfile(null);
              setUserEntitlement(null);
              navigateImmediatelyTo('STUDIOS');
            }}
            onShowNewRecoveryKit={(codes) => setOneTimeRecoveryKitModal(codes)}
          />
        )}

        {(activeRoute === 'HELP' || activeRoute === 'LEGAL') && (
          <div className="max-w-4xl mx-auto px-4 sm:px-8 py-10 pb-24 space-y-8">
            <div className="pb-5 border-b border-[#E7E2DA] dark:border-[#2E2B28]">
              <p className="text-xs font-medium text-[#57534E]">
                Plain-Language User Guide, Privacy, Output Entitlements &amp; Security Architecture
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold mt-1">
                How Varnank Studios Protects Your Work, Privacy &amp; Security
              </h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="p-5 rounded-xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] space-y-2">
                <h2 className="text-sm font-bold">1. Files Never Leave Your Device</h2>
                <p className="text-xs text-[#57534E] dark:text-[#A8A29E] leading-relaxed">
                  Every studio tool (Photo/Image, PDF, ID/Govt. ID, and Print &amp; Publication)
                  runs directly inside your web browser. Your photos, documents, and ID scans are
                  never uploaded to any server.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] space-y-2">
                <h2 className="text-sm font-bold">2. Country-Code Currency Rule</h2>
                <p className="text-xs text-[#57534E] dark:text-[#A8A29E] leading-relaxed">
                  We never track your location or IP address. When you sign up, the country code you
                  choose (+91 India → INR ₹; all other codes → USD $) permanently sets your account
                  billing currency.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] space-y-2">
                <h2 className="text-sm font-bold">
                  3. Plan-Capped Output Options &amp; Post-Payment Webhook Activation
                </h2>
                <p className="text-xs text-[#57534E] dark:text-[#A8A29E] leading-relaxed">
                  Guest and Freemium plans include 3 daily exports capped at 80% quality and
                  72 DPI. Paid plans (Per-Day Pass, Paid Monthly, and Premium Annual) unlock 95%–100%
                  quality, 300–600 DPI print density, SVG/ZIP outputs, 8-up/16-up ID sheets, and batch
                  runs ONLY after verified server-to-server payment webhook capture.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] space-y-2">
                <h2 className="text-sm font-bold">
                  4. India DPDP Act 2023 &amp; GDPR Rights
                </h2>
                <p className="text-xs text-[#57534E] dark:text-[#A8A29E] leading-relaxed">
                  We store only the minimum account information needed for sign-in and active plans.
                  You can export your account data or permanently delete your account at any time
                  from your Account tab.
                </p>
              </div>
            </div>

            {/* DOCUMENTED RECOVERY PROTOCOLS & VAULT SECURITY ARCHITECTURE */}
            <div className="p-6 rounded-2xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] space-y-4">
              <div>
                <div className="text-xs font-mono text-[#B44C32]">
                  Security Architecture &amp; Account Recovery Protocol
                </div>
                <h2 className="text-lg font-bold mt-0.5">
                  Zero Master Passwords, Hardware Passkey + MFA &amp; Write-Only Vault Strategy
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-[#57534E] dark:text-[#A8A29E] leading-relaxed">
                <div className="p-4 rounded-xl bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA] space-y-1.5">
                  <div className="font-bold text-[#181615] dark:text-[#F5F2EB]">
                    A. Zero Hardcoded Master Passwords in Codebase
                  </div>
                  <p>
                    No plaintext passwords, default master logins, or static recovery backdoors exist
                    anywhere in the source repository or client bundle. Credentials are stored
                    exclusively as one-way SHA-256 digests (`passkeyTokenHash`, `totpPinHash`,
                    `recoveryCodeHash`).
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA] space-y-1.5">
                  <div className="font-bold text-[#181615] dark:text-[#F5F2EB]">
                    B. Hardware Passkeys &amp; Multi-Factor Verification
                  </div>
                  <p>
                    Accounts authenticate using WebAuthn / Device Passkeys. Privileged roles enforce
                    mandatory dual-factor verification combining a cryptographic Passkey assertion
                    token with a 6-digit TOTP Authenticator PIN.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA] space-y-1.5">
                  <div className="font-bold text-[#181615] dark:text-[#F5F2EB]">
                    C. Single-Use Recovery Codes &amp; Two-Person Approval Rule
                  </div>
                  <p>
                    If a device passkey is lost, accounts can authenticate once using a pre-issued
                    Single-Use Recovery Code, which immediately consumes its SHA-256 hash and rotates
                    session credentials. Escalated recovery requires the Two-Person Rule: Step 1
                    verification followed by Step 2 executive approval.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA] space-y-1.5">
                  <div className="font-bold text-[#181615] dark:text-[#F5F2EB]">
                    D. Two-Tier Write-Only AES-256-GCM Secrets Vault
                  </div>
                  <p>
                    Tier 1 holds only the Master Decryption Key (`VAULT_MASTER_KEY`) in the runtime
                    environment. Tier 2 stores all provider keys encrypted with AES-256-GCM inside the
                    Vault. Plaintext secret values are never returned to any browser or API response.
                  </p>
                </div>
              </div>
              {/* External Standards & Regulatory References (Triggers External Link Security Warning) */}
              <div className="pt-3 border-t border-[#E7E2DA] dark:border-[#2E2B28] flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="text-[#57534E] dark:text-[#A8A29E]">
                  External Standards &amp; Regulatory References (External links warn before leaving workspace):
                </span>
                <div className="flex flex-wrap items-center gap-3 font-medium">
                  <a
                    href="https://www.w3.org/TR/webauthn-2/"
                    data-testid="external-w3c-link"
                    className="text-[#B44C32] dark:text-[#E06D53] hover:underline"
                  >
                    W3C WebAuthn Standard ↗
                  </a>
                  <a
                    href="https://www.icao.int/publications/pages/publication.aspx"
                    data-testid="external-icao-link"
                    className="text-[#B44C32] dark:text-[#E06D53] hover:underline"
                  >
                    ICAO Passport Dimension Spec ↗
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Editorial Footer */}
      <footer className="border-t border-[#E7E2DA] dark:border-[#2E2B28] py-6 px-4 sm:px-8 mb-14 md:mb-0 text-xs text-[#57534E] dark:text-[#A8A29E]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span>© {new Date().getFullYear()} Varnank Studios · </span>
            <span>{t.zeroUploadNotice}</span>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <button
              type="button"
              onClick={() => navigateImmediatelyTo('LEGAL')}
              className="hover:underline"
            >
              Privacy &amp; DPDP Notice
            </button>
            <button
              type="button"
              onClick={() => navigateImmediatelyTo('LEGAL')}
              className="hover:underline"
            >
              Terms of Service
            </button>
            <a
              href="https://www.w3.org/TR/webauthn-2/"
              data-testid="footer-external-standard-link"
              className="hover:underline text-[#57534E] dark:text-[#A8A29E]"
            >
              External W3C Spec ↗
            </a>
            <button
              type="button"
              onClick={handleWipeAllLocalDeviceData}
              className="text-[#B44C32] dark:text-[#E06D53] hover:underline"
            >
              {t.wipeLocalData}
            </button>
          </div>
        </div>
      </footer>

      {/* External Link Security Warning Modal (Shown ONLY when an external link is clicked) */}
      {pendingExternalLink && (
        <div
          data-testid="external-link-warning-modal"
          role="dialog"
          aria-modal="true"
          aria-label="External Link Security Warning"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-[#1C1A18] rounded-2xl max-w-md w-full p-6 space-y-4 border-2 border-[#B44C32] shadow-xl">
            <div className="space-y-1">
              <div className="text-xs font-mono font-semibold text-[#B44C32] dark:text-[#E06D53]">
                External Link Security Guard
              </div>
              <h2 className="text-lg font-bold text-[#181615] dark:text-[#F5F2EB]">
                Leaving Varnank Studios for an External Website
              </h2>
            </div>
            <p className="text-xs text-[#57534E] dark:text-[#A8A29E] leading-relaxed">
              You clicked an external link (<strong>{pendingExternalLink.label}</strong>) that points
              outside the Varnank Studios local workspace:
            </p>
            <div
              data-testid="external-link-target-url"
              className="p-2.5 rounded-lg bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA] dark:border-[#2E2B28] text-xs font-mono text-[#181615] dark:text-[#F5F2EB] break-all"
            >
              {pendingExternalLink.url}
            </div>
            <p className="text-[11px] text-[#57534E] dark:text-[#A8A29E]">
              Internal studio tools and pages never trigger this prompt and open immediately. Only
              external third-party websites require your confirmation.
            </p>
            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              <button
                type="button"
                data-testid="cancel-external-link-btn"
                onClick={() => setPendingExternalLink(null)}
                className="min-h-[40px] px-4 py-2 text-xs font-semibold rounded-lg bg-[#181615] text-[#FAF8F5] dark:bg-[#F5F2EB] dark:text-[#121110]"
              >
                Stay in Varnank Studios
              </button>
              <button
                type="button"
                data-testid="confirm-external-link-btn"
                onClick={() => {
                  const targetUrl = pendingExternalLink.url;
                  setPendingExternalLink(null);
                  window.location.assign(targetUrl);
                }}
                className="min-h-[40px] px-4 py-2 text-xs font-semibold rounded-lg border border-[#B44C32] text-[#B44C32] hover:bg-[#B44C32] hover:text-white transition-colors"
              >
                Continue to External Site
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Normal Sign-In / Sign-Up & Account Recovery Popup Dialog Modal */}
      {isAuthModalOpen && (
        <AuthView
          isModal={true}
          onClose={() => setIsAuthModalOpen(false)}
          countryCodes={countryCodes}
          enabledMethods={enabledSignInMethods}
          onAuthenticated={handleAuthenticatedSuccess}
        />
      )}

      {oneTimeRecoveryKitModal && (
        <RecoveryKitModal
          codes={oneTimeRecoveryKitModal}
          onClose={() => setOneTimeRecoveryKitModal(null)}
        />
      )}
    </div>
  );
}
