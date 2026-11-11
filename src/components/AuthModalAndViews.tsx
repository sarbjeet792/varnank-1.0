import React, { useState } from 'react';
import {
  Lock,
  Mail,
  CheckCircle2,
  ArrowRight,
  Copy,
  Download,
  X,
  Eye,
  EyeOff,
  UserPlus,
  RotateCcw,
  KeyRound,
} from 'lucide-react';
import {
  CountryCurrencyEntry,
  resolveCurrencyFromCountryCode,
  formatMinorCurrency,
  AdminCategory,
} from '../core/engine';

interface AuthViewProps {
  countryCodes: CountryCurrencyEntry[];
  enabledMethods: {
    passkey: boolean;
    emailOtp: boolean;
    googleOAuth: boolean;
    password: boolean;
    appleOAuth: boolean;
    smsOtp: boolean;
    xOAuth: boolean;
  };
  onAuthenticated: (payload: {
    sessionToken: string;
    adminSessionToken?: string | null;
    roleCategory?: AdminCategory;
    entitlementToken: string;
    user: any;
    entitlement: any;
    oneTimeRecoveryKit?: string[];
    openAdminConsoleDirectly?: boolean;
  }) => void;
  isModal?: boolean;
  onClose?: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({
  countryCodes,
  onAuthenticated,
  isModal = false,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'SIGN_IN' | 'SIGN_UP' | 'RECOVERY'>('SIGN_IN');

  // Sign-In state
  const [identifier, setIdentifier] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);

  // Sign-Up state
  const [signupName, setSignupName] = useState<string>('');
  const [signupEmail, setSignupEmail] = useState<string>('');
  const [signupPassword, setSignupPassword] = useState<string>('');
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>(
    countryCodes[0]?.countryCode || '+91'
  );
  const [acceptedTerms, setAcceptedTerms] = useState<boolean>(true);

  // Unified Password / Account Reset state
  const [recoveryIdentifier, setRecoveryIdentifier] = useState<string>('');
  const [recoveryCodeInput, setRecoveryCodeInput] = useState<string>('');
  const [newPasswordInput, setNewPasswordInput] = useState<string>('');

  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const currencyPreview = resolveCurrencyFromCountryCode(selectedCountryCode, countryCodes);

  // 1. Conventional Sign In Handler
  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setStatusBanner(null);
    setLoading(true);

    try {
      const resp = await fetch('/api/auth/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: identifier.trim(),
          password: password.trim(),
          passkeyCredential: password.trim() || undefined,
          method: 'PASSWORD',
          rememberMe,
        }),
      });
      const data = await resp.json();

      if (!resp.ok) {
        setErrorMessage(data.error || 'Incorrect email/username or password.');
        setLoading(false);
        return;
      }

      if (data.step === 'SIGNED_IN') {
        onAuthenticated({
          sessionToken: data.sessionToken,
          adminSessionToken: data.adminSessionToken,
          roleCategory: data.roleCategory,
          entitlementToken: data.entitlementToken,
          user: data.user,
          entitlement: data.entitlement,
          openAdminConsoleDirectly: Boolean(data.adminSessionToken),
        });
      } else if (data.step === 'COMPLETE_SIGNUP') {
        setSignupEmail(identifier.trim());
        setSignupPassword(password.trim());
        setStatusBanner(
          'Account not found — confirm your display name and billing region below to create your account.'
        );
        setActiveTab('SIGN_UP');
      }
    } catch {
      setErrorMessage('Unable to reach authentication service. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Conventional 1-Step Sign Up Handler
  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setStatusBanner(null);
    setLoading(true);

    try {
      const resp = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: signupEmail.trim(),
          identifier: signupEmail.trim(),
          displayName: signupName.trim(),
          password: signupPassword.trim(),
          countryCode: selectedCountryCode,
          acceptedTerms,
          isAdultConfirmed: true,
          method: 'PASSWORD',
        }),
      });
      const data = await resp.json();

      if (!resp.ok) {
        setErrorMessage(data.error || 'Could not create account.');
        setLoading(false);
        return;
      }

      onAuthenticated({
        sessionToken: data.sessionToken,
        entitlementToken: data.entitlementToken,
        user: data.user,
        entitlement: data.entitlement,
        oneTimeRecoveryKit: data.oneTimeRecoveryKit,
      });
    } catch {
      setErrorMessage('Unable to complete sign-up. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // 3a. Request Verification Code for Unified Password / Account Reset
  const handleSendResetCode = async () => {
    setErrorMessage(null);
    setStatusBanner(null);
    const targetEmail = (recoveryIdentifier || identifier).trim();
    if (!targetEmail) {
      setErrorMessage('Please enter your email address or username first.');
      return;
    }
    try {
      const resp = await fetch('/api/auth/request-reset-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: targetEmail }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setErrorMessage(data.error || 'Could not issue verification code.');
        return;
      }
      if (data.verificationCode) {
        setRecoveryCodeInput(data.verificationCode);
      }
      setStatusBanner(
        data.message || 'Verification code populated. Enter your new password below to complete the reset.'
      );
    } catch {
      setErrorMessage('Unable to request verification code.');
    }
  };

  // 3b. Unified Password / Account Reset Handler
  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setStatusBanner(null);
    setLoading(true);

    try {
      const resp = await fetch('/api/auth/recover-with-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: recoveryIdentifier.trim(),
          recoveryCode: recoveryCodeInput.trim(),
          newPassword: newPasswordInput.trim() || undefined,
        }),
      });
      const data = await resp.json();

      if (!resp.ok) {
        setErrorMessage(data.error || 'Could not verify code.');
        setLoading(false);
        return;
      }

      onAuthenticated({
        sessionToken: data.sessionToken,
        adminSessionToken: data.adminSessionToken,
        roleCategory: data.roleCategory,
        entitlementToken: data.entitlementToken,
        user: data.user,
        entitlement: data.entitlement,
        openAdminConsoleDirectly: Boolean(data.adminSessionToken),
      });
    } catch {
      setErrorMessage('Unable to complete password or account reset. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const dialogCard = (
    <div
      data-testid="auth-dialog-card"
      className="w-full max-w-md bg-white dark:bg-[#1C1A18] rounded-2xl border border-[#E7E2DA] dark:border-[#2E2B28] shadow-xl p-6 sm:p-7 space-y-5 relative"
    >
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          data-testid="close-auth-modal-btn"
          className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-[#57534E] hover:text-[#181615] dark:hover:text-[#F5F2EB] hover:bg-[#FAF8F5] dark:hover:bg-[#262320] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Header */}
      <div className="space-y-1 pr-6">
        <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[#B44C32] dark:text-[#E06D53]">
          <Lock className="w-3.5 h-3.5" />
          <span>Varnank Studios Account</span>
        </div>
        <h1 className="text-xl font-bold tracking-tight text-[#181615] dark:text-[#F5F2EB]">
          {activeTab === 'SIGN_IN'
            ? 'Sign In to Your Account'
            : activeTab === 'SIGN_UP'
            ? 'Create Your Account'
            : 'Password / Account Reset'}
        </h1>
        <p className="text-xs text-[#57534E] dark:text-[#A8A29E] leading-relaxed">
          {activeTab === 'SIGN_IN'
            ? 'Enter your email or username and password to access your studios and plans.'
            : activeTab === 'SIGN_UP'
            ? 'Create your account and select your billing currency region.'
            : 'Verify your account with a verification or recovery code and set a new password.'}
        </p>
      </div>

      {/* 3-Tab Switcher: Sign In | Sign Up | Password / Account Reset */}
      <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA] dark:border-[#2E2B28]">
        <button
          type="button"
          data-testid="auth-tab-signin"
          onClick={() => {
            setActiveTab('SIGN_IN');
            setErrorMessage(null);
            setStatusBanner(null);
          }}
          className={`min-h-[36px] px-2 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'SIGN_IN'
              ? 'bg-[#181615] text-[#FAF8F5] dark:bg-[#F5F2EB] dark:text-[#121110]'
              : 'text-[#57534E] dark:text-[#A8A29E] hover:text-[#181615]'
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          data-testid="auth-tab-signup"
          onClick={() => {
            setActiveTab('SIGN_UP');
            setErrorMessage(null);
            setStatusBanner(null);
          }}
          className={`min-h-[36px] px-2 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'SIGN_UP'
              ? 'bg-[#181615] text-[#FAF8F5] dark:bg-[#F5F2EB] dark:text-[#121110]'
              : 'text-[#57534E] dark:text-[#A8A29E] hover:text-[#181615]'
          }`}
        >
          Sign Up
        </button>
        <button
          type="button"
          data-testid="auth-tab-recovery"
          onClick={() => {
            if (identifier && !recoveryIdentifier) {
              setRecoveryIdentifier(identifier);
            }
            setActiveTab('RECOVERY');
            setErrorMessage(null);
            setStatusBanner(null);
          }}
          className={`min-h-[36px] px-2 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'RECOVERY'
              ? 'bg-[#181615] text-[#FAF8F5] dark:bg-[#F5F2EB] dark:text-[#121110]'
              : 'text-[#57534E] dark:text-[#A8A29E] hover:text-[#181615]'
          }`}
        >
          Password / Account Reset
        </button>
      </div>

      {errorMessage && (
        <div
          role="alert"
          data-testid="auth-error-alert"
          className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-xs text-red-900 dark:text-red-200"
        >
          {errorMessage}
        </div>
      )}

      {statusBanner && (
        <div
          data-testid="auth-status-banner"
          className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200"
        >
          {statusBanner}
        </div>
      )}

      {/* TAB 1: SIGN IN */}
      {activeTab === 'SIGN_IN' && (
        <form onSubmit={handleSignInSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="auth-identifier-input"
              className="block text-xs font-medium text-[#181615] dark:text-[#F5F2EB] mb-1"
            >
              Email Address or Username
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#57534E] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="auth-identifier-input"
                data-testid="auth-identifier-input"
                type="text"
                required
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Enter email or username"
                className="w-full min-h-[42px] pl-10 pr-3.5 py-2 text-sm rounded-xl bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA] dark:border-[#2E2B28] focus:outline-2 focus:outline-[#B44C32]"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="auth-passkey-input"
                className="block text-xs font-medium text-[#181615] dark:text-[#F5F2EB]"
              >
                Password
              </label>
              <button
                type="button"
                data-testid="forgot-password-link"
                onClick={() => {
                  if (identifier) setRecoveryIdentifier(identifier);
                  setActiveTab('RECOVERY');
                  setErrorMessage(null);
                }}
                className="text-xs font-semibold text-[#B44C32] dark:text-[#E06D53] hover:underline"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-[#57534E] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="auth-passkey-input"
                data-testid="auth-passkey-input"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full min-h-[42px] pl-10 pr-10 py-2 text-sm rounded-xl bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA] dark:border-[#2E2B28] focus:outline-2 focus:outline-[#B44C32]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#57534E] hover:text-[#181615]"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs">
            <label className="flex items-center gap-2 cursor-pointer text-[#57534E] dark:text-[#A8A29E]">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-[#E7E2DA]"
              />
              <span>Keep me signed in on this device</span>
            </label>
          </div>

          <button
            type="submit"
            data-testid="unified-auth-submit-btn"
            disabled={loading}
            className="w-full min-h-[44px] px-4 py-2.5 text-sm font-semibold text-[#FAF8F5] bg-[#B44C32] hover:bg-[#9E3F27] rounded-xl transition-all flex items-center justify-center gap-2 shadow-xs"
          >
            <span>{loading ? 'Signing in...' : 'Sign In'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="pt-2 border-t border-[#E7E2DA] dark:border-[#2E2B28] flex items-center justify-between text-xs text-[#57534E]">
            <span>Need an account?</span>
            <button
              type="button"
              onClick={() => {
                setActiveTab('SIGN_UP');
                setErrorMessage(null);
              }}
              className="font-semibold text-[#B44C32] dark:text-[#E06D53] hover:underline"
            >
              Create Account
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: SIGN UP */}
      {activeTab === 'SIGN_UP' && (
        <form onSubmit={handleSignUpSubmit} className="space-y-3.5">
          <div>
            <label htmlFor="signup-name-input" className="block text-xs font-medium mb-1">
              Display Name
            </label>
            <input
              id="signup-name-input"
              data-testid="signup-name-input"
              type="text"
              required
              value={signupName}
              onChange={(e) => setSignupName(e.target.value)}
              placeholder="Enter display name"
              className="w-full min-h-[40px] px-3.5 py-2 text-sm rounded-xl bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA] dark:border-[#2E2B28]"
            />
          </div>

          <div>
            <label htmlFor="signup-email-input" className="block text-xs font-medium mb-1">
              Email Address or Username
            </label>
            <input
              id="signup-email-input"
              data-testid="signup-email-input"
              type="text"
              required
              value={signupEmail}
              onChange={(e) => setSignupEmail(e.target.value)}
              placeholder="Enter email or username"
              className="w-full min-h-[40px] px-3.5 py-2 text-sm rounded-xl bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA] dark:border-[#2E2B28]"
            />
          </div>

          <div>
            <label htmlFor="signup-password-input" className="block text-xs font-medium mb-1">
              Create Password
            </label>
            <input
              id="signup-password-input"
              data-testid="signup-password-input"
              type={showPassword ? 'text' : 'password'}
              required
              minLength={4}
              value={signupPassword}
              onChange={(e) => setSignupPassword(e.target.value)}
              placeholder="Create password"
              className="w-full min-h-[40px] px-3.5 py-2 text-sm rounded-xl bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA] dark:border-[#2E2B28]"
            />
          </div>

          <div>
            <label htmlFor="signup-country-code" className="block text-xs font-medium mb-1">
              Billing Region (Sets Currency)
            </label>
            <select
              id="signup-country-code"
              data-testid="signup-country-select"
              value={selectedCountryCode}
              onChange={(e) => setSelectedCountryCode(e.target.value)}
              className="w-full min-h-[40px] px-3.5 py-2 text-sm rounded-xl bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA] dark:border-[#2E2B28]"
            >
              {countryCodes.map((c) => (
                <option key={c.countryCode} value={c.countryCode}>
                  {c.countryName} → {c.currency} ({c.currency === 'INR' ? '₹' : '$'})
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-[#57534E] dark:text-[#A8A29E]">
              Account currency:{' '}
              <strong className="text-[#181615] dark:text-[#F5F2EB]">
                {currencyPreview.currency} (
                {formatMinorCurrency(
                  currencyPreview.currency === 'INR' ? 29900 : 900,
                  currencyPreview.currency
                )}{' '}
                indicative monthly rate)
              </strong>
            </p>
          </div>

          <label className="flex items-start gap-2.5 text-xs text-[#57534E] dark:text-[#A8A29E] cursor-pointer">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-0.5 rounded border-[#E7E2DA]"
            />
            <span>I accept the privacy notice and terms of service (on-device processing).</span>
          </label>

          <button
            type="submit"
            data-testid="signup-submit-btn"
            disabled={loading}
            className="w-full min-h-[44px] px-4 py-2.5 text-sm font-semibold text-[#FAF8F5] bg-[#B44C32] hover:bg-[#9E3F27] rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            <span>{loading ? 'Creating Account...' : 'Create Account & Sign In'}</span>
          </button>
        </form>
      )}

      {/* TAB 3: SINGLE UNIFIED PASSWORD / ACCOUNT RESET */}
      {activeTab === 'RECOVERY' && (
        <form onSubmit={handleRecoverySubmit} className="space-y-3.5">
          <div>
            <label htmlFor="recovery-identifier" className="block text-xs font-medium mb-1">
              Email Address or Username
            </label>
            <input
              id="recovery-identifier"
              data-testid="recovery-identifier-input"
              type="text"
              required
              value={recoveryIdentifier}
              onChange={(e) => setRecoveryIdentifier(e.target.value)}
              placeholder="Enter email or username"
              className="w-full min-h-[40px] px-3.5 py-2 text-sm rounded-xl bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA] dark:border-[#2E2B28]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="recovery-code" className="block text-xs font-medium">
                Verification or Recovery Code
              </label>
              <button
                type="button"
                data-testid="send-reset-code-btn"
                onClick={handleSendResetCode}
                className="text-[11px] font-semibold text-[#B44C32] dark:text-[#E06D53] hover:underline"
              >
                Request Verification Code
              </button>
            </div>
            <input
              id="recovery-code"
              data-testid="recovery-code-input"
              type="text"
              required
              value={recoveryCodeInput}
              onChange={(e) => setRecoveryCodeInput(e.target.value)}
              placeholder="Enter verification or recovery code"
              className="w-full min-h-[40px] px-3.5 py-2 text-xs font-mono rounded-xl bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA] dark:border-[#2E2B28]"
            />
          </div>

          <div>
            <label htmlFor="recovery-new-password" className="block text-xs font-medium mb-1">
              New Password
            </label>
            <input
              id="recovery-new-password"
              data-testid="recovery-new-password-input"
              type={showPassword ? 'text' : 'password'}
              value={newPasswordInput}
              onChange={(e) => setNewPasswordInput(e.target.value)}
              placeholder="Enter new password"
              className="w-full min-h-[40px] px-3.5 py-2 text-sm rounded-xl bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA] dark:border-[#2E2B28]"
            />
          </div>

          <button
            type="submit"
            data-testid="recovery-submit-btn"
            disabled={loading}
            className="w-full min-h-[44px] px-4 py-2.5 text-sm font-semibold text-[#FAF8F5] bg-[#181615] dark:bg-[#F5F2EB] dark:text-[#121110] rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{loading ? 'Processing Reset...' : 'Reset Password & Sign In'}</span>
          </button>
        </form>
      )}
    </div>
  );

  if (isModal) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Sign in, Sign up, or Reset Account"
        data-testid="auth-dialog-backdrop"
        onClick={(e) => {
          if (e.target === e.currentTarget && onClose) {
            onClose();
          }
        }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      >
        {dialogCard}
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-12 flex items-center justify-center">
      {dialogCard}
    </div>
  );
};

interface RecoveryKitModalProps {
  codes: string[];
  onClose: () => void;
}

export const RecoveryKitModal: React.FC<RecoveryKitModalProps> = ({ codes, onClose }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleDownloadTxt = () => {
    const content = [
      'VARNANK STUDIOS — ACCOUNT RECOVERY CODES',
      '====================================================',
      'Keep these codes in a safe place. You can use any code in the Password / Account Reset tab.',
      '',
      ...codes.map((c, idx) => `${String(idx + 1).padStart(2, '0')}. ${c}`),
    ].join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'varnank-studios-recovery-kit.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="recovery-kit-title"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="max-w-md w-full bg-white dark:bg-[#1C1A18] rounded-2xl border border-[#E7E2DA] dark:border-[#2E2B28] p-6 space-y-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>Account Created Successfully</span>
            </div>
            <h2 id="recovery-kit-title" className="text-lg font-bold">
              Your Backup Recovery Codes
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-2.5 py-1 rounded-lg border border-[#E7E2DA] hover:bg-[#FAF8F5]"
          >
            Skip / Close
          </button>
        </div>

        <p className="text-xs text-[#57534E] dark:text-[#A8A29E] leading-relaxed">
          Save these backup codes for the Password / Account Reset tab whenever you need to restore
          your account.
        </p>

        <div className="grid grid-cols-2 gap-2 p-3.5 rounded-xl bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA] dark:border-[#2E2B28] font-mono text-xs">
          {codes.map((c) => (
            <div
              key={c}
              className="px-2 py-1 rounded bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] text-center font-semibold"
            >
              {c}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="flex-1 min-h-[40px] px-3 py-2 text-xs font-medium rounded-xl border border-[#E7E2DA] dark:border-[#2E2B28] hover:border-[#B44C32] flex items-center justify-center gap-1.5"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{copied ? 'Copied!' : 'Copy Codes'}</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadTxt}
            className="flex-1 min-h-[40px] px-3 py-2 text-xs font-medium rounded-xl border border-[#E7E2DA] dark:border-[#2E2B28] hover:border-[#B44C32] flex items-center justify-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download .txt</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full min-h-[42px] px-4 py-2 text-xs font-semibold text-[#FAF8F5] bg-[#181615] dark:bg-[#F5F2EB] dark:text-[#121110] rounded-xl"
        >
          Continue to Studios
        </button>
      </div>
    </div>
  );
};
