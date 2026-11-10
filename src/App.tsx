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

  // Public catalog state
  const [studios, setStudios] = useState<
    Array<{ id: StudioId; codeLabel: string; name: string; summary: string }>
  >([
    {
      id: 'S1',
      codeLabel: 'Studio S1',
      name: 'Photo / Image Studio',
      summary: 'Crop, resize, convert formats, balance tone, and batch-watermark visuals on your device.',
    },
    {
      id: 'S2',
      codeLabel: 'Studio S2',
      name: 'PDF Studio',
      summary: 'Merge, split, reorder pages, redact sensitive areas, and clean document metadata.',
    },
    {
      id: 'S3',
      codeLabel: 'Studio S3',
      name: 'ID / Govt. ID Studio',
      summary: 'Format exact passport, visa, and signature dimensions and generate multi-copy print sheets.',
    },
    {
      id: 'S4',
      codeLabel: 'Studio S4',
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
  const [presetCategoryFilter, setPresetCategoryFilter] = useState<
    'ALL' | 'SIZE' | 'TEMPLATE' | 'EXPORT_PROFILE'
  >('ALL');

  const currentLocale: SupportedLocale = userProfile?.language || 'en';
  const currentTheme: 'light' | 'dark' | 'system' = userProfile?.theme || 'light';

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

  // Check URL hash or pathname for unguessable hidden admin portal entry (`#/_cp/portal/:slug` or `/_cp/portal/:slug`)
  useEffect(() => {
    const checkPortalRoute = () => {
      const hash = window.location.hash;
      const path = window.location.pathname;
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
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // Ignore storage error
    }
  };

  const t = UI_DICTIONARY[currentLocale] || UI_DICTIONARY.en;

  if (activeRoute === 'HIDDEN_ADMIN') {
    return (
      <div className="min-h-screen bg-[#FAF8F5] dark:bg-[#121110] text-[#181615] dark:text-[#F5F2EB]">
        <HiddenAdminConsole
          portalSlug={adminPortalSlug}
          onExitPortal={() => {
            window.location.hash = '';
            setActiveRoute('STUDIOS');
          }}
          onSwitchPortalSlug={(nextSlug) => {
            window.location.hash = `#/_cp/portal/${nextSlug}`;
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
        activeRoute={activeRoute}
        onNavigate={setActiveRoute}
        isSignedIn={Boolean(sessionToken && userProfile)}
        userHandle={userProfile?.handle}
        locale={currentLocale}
      />

      <main className="flex-1">
        {activeRoute === 'STUDIOS' && (
          <StudioWorkspace
            studios={studios}
            tools={tools}
            presets={presets}
            userCustomPresets={userCustomPresets}
            onSaveLocalPreset={(p) => setUserCustomPresets((prev) => [p, ...prev])}
            sessionToken={sessionToken}
            entitlementToken={entitlementToken}
            onRequestUpgrade={() => setActiveRoute('PLANS')}
            onRecordLocalActivity={(entry) =>
              setLocalRecentActivity((prev) => [entry, ...prev.slice(0, 19)])
            }
            onWipeAllLocalData={handleWipeAllLocalDeviceData}
            defaultExportFormat={userProfile?.defaultExportFormat || 'PNG'}
          />
        )}

        {activeRoute === 'PRESETS' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 pb-24 space-y-6">
            <div className="pb-5 border-b border-[#E7E2DA] dark:border-[#2E2B28] flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-[#57534E] dark:text-[#A8A29E] mb-1">
                  Sizes, Templates &amp; Export Profiles · Global + Local Device Presets
                </p>
                <h1 className="text-2xl sm:text-3xl font-bold">
                  Standard Studio Presets Library
                </h1>
              </div>

              <div className="flex items-center gap-1 p-1 bg-[#E7E2DA]/60 dark:bg-[#1C1A18] rounded-lg">
                {(['ALL', 'SIZE', 'TEMPLATE', 'EXPORT_PROFILE'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setPresetCategoryFilter(cat)}
                    className={`min-h-[36px] px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      presetCategoryFilter === cat
                        ? 'bg-white dark:bg-[#262320] text-[#181615] dark:text-[#F5F2EB] shadow-xs'
                        : 'text-[#57534E] dark:text-[#A8A29E]'
                    }`}
                  >
                    {cat === 'ALL'
                      ? 'All Presets'
                      : cat === 'SIZE'
                      ? 'Sizes'
                      : cat === 'TEMPLATE'
                      ? 'Templates'
                      : 'Export Profiles'}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...userCustomPresets, ...presets]
                .filter(
                  (p) =>
                    presetCategoryFilter === 'ALL' || p.category === presetCategoryFilter
                )
                .map((preset) => (
                  <div
                    key={preset.id}
                    className="p-5 rounded-xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] flex flex-col justify-between space-y-4"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs text-[#57534E] dark:text-[#A8A29E] font-mono">
                        <span>{preset.codeLabel}</span>
                        <span>
                          Studio {preset.studioId} · {preset.tier === 'PAID' ? 'Paid' : 'Free'}
                        </span>
                      </div>
                      <h2 className="text-sm font-bold mt-1">{preset.name}</h2>
                      <p className="text-xs font-mono text-[#57534E] dark:text-[#A8A29E] mt-1">
                        {preset.dimensionsLabel}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveRoute('STUDIOS')}
                      className="w-full min-h-[40px] px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#E7E2DA] dark:border-[#2E2B28] hover:border-[#B44C32]"
                    >
                      Open in Studio {preset.studioId}
                    </button>
                  </div>
                ))}
            </div>
          </div>
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
            onRequireSignIn={() => setActiveRoute('AUTH')}
            onOrderActivated={() => fetchAuthenticatedUser(sessionToken)}
          />
        )}

        {activeRoute === 'AUTH' && (
          <AuthView
            countryCodes={countryCodes}
            enabledMethods={enabledSignInMethods}
            onAuthenticated={async (payload) => {
              setSessionToken(payload.sessionToken);
              setEntitlementToken(payload.entitlementToken);
              setUserProfile(payload.user);
              setUserEntitlement(payload.entitlement);
              if (payload.oneTimeRecoveryKit) {
                setOneTimeRecoveryKitModal(payload.oneTimeRecoveryKit);
              }
              await fetchAuthenticatedUser(payload.sessionToken);
              setActiveRoute('DASHBOARD');
            }}
          />
        )}

        {activeRoute === 'DASHBOARD' && sessionToken && userProfile && userEntitlement && (
          <UserAreaView
            sessionToken={sessionToken}
            userData={userProfile}
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
            onLaunchStudio={() => setActiveRoute('STUDIOS')}
            onOpenPlans={() => setActiveRoute('PLANS')}
            onRefreshUser={() => fetchAuthenticatedUser(sessionToken)}
            onSignedOutOrDeleted={() => {
              setSessionToken(null);
              setEntitlementToken(null);
              setUserProfile(null);
              setUserEntitlement(null);
              setActiveRoute('STUDIOS');
            }}
            onShowNewRecoveryKit={(codes) => setOneTimeRecoveryKitModal(codes)}
          />
        )}

        {(activeRoute === 'HELP' || activeRoute === 'LEGAL') && (
          <div className="max-w-4xl mx-auto px-4 sm:px-8 py-10 pb-24 space-y-6">
            <div className="pb-5 border-b border-[#E7E2DA] dark:border-[#2E2B28]">
              <p className="text-xs font-medium text-[#57534E]">
                Plain-Language User Guide, Privacy &amp; Service Terms
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold mt-1">
                How Varnank Studios Protects Your Work &amp; Privacy
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
                  3. India DPDP Act 2023 &amp; GDPR Rights
                </h2>
                <p className="text-xs text-[#57534E] dark:text-[#A8A29E] leading-relaxed">
                  We store only the minimum account information needed for sign-in and active plans.
                  You can export your account data or permanently delete your account at any time
                  from your Account tab.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] space-y-2">
                <h2 className="text-sm font-bold">4. Need Direct Support?</h2>
                <p className="text-xs text-[#57534E] dark:text-[#A8A29E] leading-relaxed">
                  Sign in to open a ticket with our Support team or request two-person verified
                  account recovery if you ever lose both your device passkey and your 10-code
                  recovery kit.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Quiet Editorial Footer (No telemetry tickers, no admin links per Section R & frontend-design) */}
      <footer className="border-t border-[#E7E2DA] dark:border-[#2E2B28] py-6 px-4 sm:px-8 mb-14 md:mb-0 text-xs text-[#57534E] dark:text-[#A8A29E]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span>© {new Date().getFullYear()} Varnank Studios · </span>
            <span>{t.zeroUploadNotice}</span>
          </div>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => setActiveRoute('LEGAL')}
              className="hover:underline"
            >
              Privacy &amp; DPDP Notice
            </button>
            <button
              type="button"
              onClick={() => setActiveRoute('LEGAL')}
              className="hover:underline"
            >
              Terms of Service
            </button>
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

      {oneTimeRecoveryKitModal && (
        <RecoveryKitModal
          codes={oneTimeRecoveryKitModal}
          onClose={() => setOneTimeRecoveryKitModal(null)}
        />
      )}
    </div>
  );
}
