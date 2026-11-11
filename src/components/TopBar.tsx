import React from 'react';
import { SupportedLocale, UI_DICTIONARY } from '../core/i18n';

export type ActiveRoute =
  | 'STUDIOS'
  | 'PRESETS'
  | 'PLANS'
  | 'HELP'
  | 'AUTH'
  | 'DASHBOARD'
  | 'PAYMENT_VERIFY'
  | 'LEGAL'
  | 'HIDDEN_ADMIN';

interface TopBarProps {
  activeRoute: ActiveRoute;
  onNavigate: (route: ActiveRoute) => void;
  isSignedIn: boolean;
  userHandle?: string;
  userRoleCategory?: string;
  activePlanName?: string;
  hasAdminAccess?: boolean;
  locale: SupportedLocale;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeRoute,
  onNavigate,
  isSignedIn,
  userHandle,
  userRoleCategory,
  activePlanName,
  hasAdminAccess,
  locale,
}) => {
  const t = UI_DICTIONARY[locale] || UI_DICTIONARY.en;

  return (
    <>
      {/* Strict 3-Zone Top Bar Contract (frontend-design §2) */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-8 px-4 sm:px-8 h-14 bg-[#FAF8F5]/95 dark:bg-[#121110]/95 backdrop-blur-md border-b border-[#E7E2DA] dark:border-[#2E2B28]">
        {/* Zone 1: Brand Title & Monogram Logo = Home / Dashboard Button */}
        <button
          type="button"
          data-testid="brand-home-dashboard-btn"
          title={
            isSignedIn
              ? activeRoute === 'STUDIOS'
                ? 'Open User Dashboard (or click again from Dashboard to return Home)'
                : 'Return to Home Studio Workspace'
              : 'Return to Varnank Studios Home Workspace'
          }
          onClick={() => {
            if (isSignedIn && activeRoute === 'STUDIOS') {
              onNavigate('DASHBOARD');
            } else {
              onNavigate('STUDIOS');
            }
          }}
          className="flex items-center gap-2.5 text-left text-base sm:text-lg font-bold tracking-tight text-[#181615] dark:text-[#F5F2EB] whitespace-nowrap shrink-0 hover:opacity-85 transition-opacity focus-visible:outline-2 focus-visible:outline-[#B44C32]"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 64 64"
            className="w-7 h-7 shrink-0 rounded-md"
            fill="none"
          >
            <rect width="64" height="64" rx="14" fill="#181615" />
            <path
              d="M14 18L26 46L38 18"
              stroke="#FAF8F5"
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M36 42C38.5 44.8 42 46 45.5 46C50 46 53 43.2 53 39.5C53 35.8 49.8 34 44.5 32.5C39.5 31 36.5 28.8 36.5 24.5C36.5 20.5 39.8 18 44.8 18C48.2 18 51 19.2 52.8 21.2"
              stroke="#E06D53"
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>Varnank Studios</span>
        </button>

        {/* Zone 2: Concise single-line navigation links */}
        <nav
          aria-label="Primary Navigation"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-[#57534E] dark:text-[#A8A29E]"
        >
          <button
            type="button"
            onClick={() => onNavigate('STUDIOS')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeRoute === 'STUDIOS'
                ? 'text-[#181615] dark:text-[#F5F2EB] border-[#B44C32]'
                : 'border-transparent hover:text-[#181615] dark:hover:text-[#F5F2EB]'
            }`}
          >
            {t.navStudios}
          </button>
          <button
            type="button"
            onClick={() => onNavigate('PLANS')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeRoute === 'PLANS'
                ? 'text-[#181615] dark:text-[#F5F2EB] border-[#B44C32]'
                : 'border-transparent hover:text-[#181615] dark:hover:text-[#F5F2EB]'
            }`}
          >
            {t.navPlans}
          </button>
          <button
            type="button"
            onClick={() => onNavigate('HELP')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeRoute === 'HELP'
                ? 'text-[#181615] dark:text-[#F5F2EB] border-[#B44C32]'
                : 'border-transparent hover:text-[#181615] dark:hover:text-[#F5F2EB]'
            }`}
          >
            {t.navHelp}
          </button>
        </nav>

        {/* Zone 3: Single primary action area (Sign in / Sign up OR Dashboard + Admin Console) */}
        <div className="flex items-center gap-2 shrink-0">
          {hasAdminAccess && (
            <button
              type="button"
              data-testid="topbar-admin-console-btn"
              onClick={() => onNavigate('HIDDEN_ADMIN')}
              className="hidden sm:inline-flex items-center min-h-[38px] px-3 py-1.5 text-xs font-mono font-semibold text-[#B44C32] bg-[#FAF8F5] dark:bg-[#1C1A18] border border-[#B44C32] rounded-lg hover:bg-[#B44C32] hover:text-white transition-colors"
            >
              {userRoleCategory || 'ADMIN'} Console
            </button>
          )}
          {isSignedIn ? (
            <button
              type="button"
              data-testid="topbar-dashboard-btn"
              onClick={() => onNavigate('DASHBOARD')}
              className="min-h-[40px] px-4 py-2 text-xs sm:text-sm font-medium text-[#FAF8F5] bg-[#181615] dark:bg-[#E06D53] dark:text-[#121110] rounded-lg hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
            >
              {t.dashboard} · {userHandle || 'Account'}
              {activePlanName ? ` (${activePlanName})` : ''}
            </button>
          ) : (
            <button
              type="button"
              data-testid="topbar-auth-btn"
              onClick={() => onNavigate('AUTH')}
              className="min-h-[40px] px-4 py-2 text-xs sm:text-sm font-medium text-[#FAF8F5] bg-[#B44C32] hover:bg-[#9E3F27] rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              {t.signInSignUp}
            </button>
          )}
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar (44px+ touch targets, <= 15% viewport height) */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 grid grid-cols-4 items-center h-14 bg-[#FAF8F5]/95 dark:bg-[#121110]/95 backdrop-blur-md border-t border-[#E7E2DA] dark:border-[#2E2B28] px-2"
      >
        <button
          type="button"
          onClick={() => onNavigate('STUDIOS')}
          className={`min-h-[44px] flex flex-col items-center justify-center text-xs font-medium whitespace-nowrap ${
            activeRoute === 'STUDIOS'
              ? 'text-[#B44C32] dark:text-[#E06D53]'
              : 'text-[#57534E] dark:text-[#A8A29E]'
          }`}
        >
          <span>{t.navStudios}</span>
        </button>
        <button
          type="button"
          onClick={() => onNavigate('PLANS')}
          className={`min-h-[44px] flex flex-col items-center justify-center text-xs font-medium whitespace-nowrap ${
            activeRoute === 'PLANS'
              ? 'text-[#B44C32] dark:text-[#E06D53]'
              : 'text-[#57534E] dark:text-[#A8A29E]'
          }`}
        >
          <span>{t.navPlans}</span>
        </button>
        <button
          type="button"
          onClick={() => onNavigate('HELP')}
          className={`min-h-[44px] flex flex-col items-center justify-center text-xs font-medium whitespace-nowrap ${
            activeRoute === 'HELP'
              ? 'text-[#B44C32] dark:text-[#E06D53]'
              : 'text-[#57534E] dark:text-[#A8A29E]'
          }`}
        >
          <span>{t.navHelp}</span>
        </button>
        <button
          type="button"
          onClick={() => onNavigate(isSignedIn ? 'DASHBOARD' : 'AUTH')}
          className={`min-h-[44px] flex flex-col items-center justify-center text-xs font-medium whitespace-nowrap ${
            activeRoute === 'DASHBOARD' || activeRoute === 'AUTH'
              ? 'text-[#B44C32] dark:text-[#E06D53]'
              : 'text-[#57534E] dark:text-[#A8A29E]'
          }`}
        >
          <span>{isSignedIn ? t.dashboard : 'Sign in'}</span>
        </button>
      </nav>
    </>
  );
};
