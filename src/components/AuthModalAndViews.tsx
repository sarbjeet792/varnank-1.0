import React, { useState } from 'react';
import {
  CountryCurrencyEntry,
  resolveCurrencyFromCountryCode,
} from '../core/engine';
import { KeyRound, ShieldCheck, LifeBuoy, Check, Copy } from 'lucide-react';

interface EnabledSignInMethods {
  passkey: boolean;
  emailOtp: boolean;
  googleOAuth: boolean;
  password: boolean;
  appleOAuth: boolean;
  smsOtp: boolean;
  xOAuth: boolean;
}

interface AuthViewProps {
  countryCodes: CountryCurrencyEntry[];
  enabledMethods: EnabledSignInMethods;
  onAuthenticated: (payload: {
    sessionToken: string;
    entitlementToken: string;
    user: Record<string, unknown>;
    entitlement: Record<string, unknown>;
    oneTimeRecoveryKit?: string[];
  }) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({
  countryCodes,
  enabledMethods,
  onAuthenticated,
}) => {
  // Chart 2: Default mode SIGN IN on the unified screen
  const [step, setStep] = useState<'IDENTIFY' | 'COMPLETE_SIGNUP' | 'RECOVERY'>('IDENTIFY');
  const [identifier, setIdentifier] = useState<string>('');
  const [selectedMethod, setSelectedMethod] = useState<string>('PASSKEY');
  const [displayName, setDisplayName] = useState<string>('');
  const [countryCode, setCountryCode] = useState<string>('+91');
  const [acceptedTerms, setAcceptedTerms] = useState<boolean>(false);
  const [isAdultConfirmed, setIsAdultConfirmed] = useState<boolean>(false);
  const [recoveryCodeInput, setRecoveryCodeInput] = useState<string>('');
  const [neutralStatus, setNeutralStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const currencyPreview = resolveCurrencyFromCountryCode(countryCode, countryCodes);

  const handleIdentifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setNeutralStatus(null);
    setLoading(true);

    try {
      const resp = await fetch('/api/auth/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier,
          method: selectedMethod,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setErrorMessage(`${data.error || 'Could not continue.'} (${data.refId || 'ERR-A100'})`);
        setLoading(false);
        return;
      }

      if (data.step === 'SIGNED_IN') {
        onAuthenticated({
          sessionToken: data.sessionToken,
          entitlementToken: data.entitlementToken,
          user: data.user,
          entitlement: data.entitlement,
        });
      } else {
        setNeutralStatus(data.neutralMessage);
        setStep('COMPLETE_SIGNUP');
      }
    } catch {
      setErrorMessage('Unable to reach sign-in service. Please try again. (ERR-N500)');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const resp = await fetch('/api/auth/complete-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pendingIdentifier: identifier,
          displayName,
          countryCode,
          acceptedTerms,
          isAdultConfirmed,
          method: selectedMethod,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setErrorMessage(`${data.error || 'Could not complete sign-up.'} (${data.refId || 'ERR-C200'})`);
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
      setErrorMessage('Unable to complete sign-up right now. (ERR-N501)');
    } finally {
      setLoading(false);
    }
  };

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const resp = await fetch('/api/auth/recover-with-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier,
          recoveryCode: recoveryCodeInput,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setErrorMessage(`${data.error} (${data.refId || 'ERR-R100'})`);
        setLoading(false);
        return;
      }

      onAuthenticated({
        sessionToken: data.sessionToken,
        entitlementToken: data.entitlementToken,
        user: data.user,
        entitlement: data.entitlement,
      });
    } catch {
      setErrorMessage('Recovery request could not be completed. (ERR-N502)');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-10 pb-24">
      <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] space-y-6">
        <div className="border-b border-[#E7E2DA] dark:border-[#2E2B28] pb-4">
          <p className="text-xs font-medium text-[#57534E] dark:text-[#A8A29E]">
            Unified Identity · Default Sign In
          </p>
          <h1 className="text-2xl font-bold text-[#181615] dark:text-[#F5F2EB] mt-1">
            {step === 'IDENTIFY'
              ? 'Sign in / Sign up'
              : step === 'COMPLETE_SIGNUP'
              ? 'Complete Your Sign-Up'
              : 'Account Recovery'}
          </h1>
          <p className="text-xs text-[#57534E] dark:text-[#A8A29E] mt-1">
            {step === 'IDENTIFY'
              ? 'Enter your account handle or identifier. Existing members sign in directly; new members complete a quick one-step setup.'
              : step === 'COMPLETE_SIGNUP'
              ? 'Choose your country code to permanently set your account currency and confirm privacy terms.'
              : 'Recover access using your one-time recovery kit, another linked device, or support verification.'}
          </p>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-xs text-red-900 dark:text-red-200"
          >
            {errorMessage}
          </div>
        )}

        {neutralStatus && (
          <div className="p-3.5 rounded-xl bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA] dark:border-[#2E2B28] text-xs text-[#181615] dark:text-[#F5F2EB]">
            {neutralStatus}
          </div>
        )}

        {step === 'IDENTIFY' && (
          <form onSubmit={handleIdentifySubmit} className="space-y-4">
            {/* Method Selector: Only shows methods currently enabled in the Vault (Section A2) */}
            <div>
              <label className="block text-xs font-medium text-[#57534E] dark:text-[#A8A29E] mb-2">
                Sign-In Method
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedMethod('PASSKEY')}
                  className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-medium border text-left flex items-center gap-2 ${
                    selectedMethod === 'PASSKEY'
                      ? 'bg-[#181615] text-[#FAF8F5] dark:bg-[#F5F2EB] dark:text-[#121110] border-[#181615]'
                      : 'border-[#E7E2DA] dark:border-[#2E2B28]'
                  }`}
                >
                  <KeyRound className="w-4 h-4 shrink-0" />
                  <span>Passkey (Device Key)</span>
                </button>

                {enabledMethods.emailOtp && (
                  <button
                    type="button"
                    onClick={() => setSelectedMethod('EMAIL_OTP')}
                    className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-medium border text-left ${
                      selectedMethod === 'EMAIL_OTP'
                        ? 'bg-[#181615] text-[#FAF8F5] border-[#181615]'
                        : 'border-[#E7E2DA]'
                    }`}
                  >
                    Email One-Time Code
                  </button>
                )}

                {enabledMethods.googleOAuth && (
                  <button
                    type="button"
                    onClick={() => setSelectedMethod('GOOGLE')}
                    className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-medium border text-left ${
                      selectedMethod === 'GOOGLE'
                        ? 'bg-[#181615] text-[#FAF8F5] border-[#181615]'
                        : 'border-[#E7E2DA]'
                    }`}
                  >
                    Continue with Google
                  </button>
                )}

                {enabledMethods.password && (
                  <button
                    type="button"
                    onClick={() => setSelectedMethod('PASSWORD_HASH')}
                    className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-medium border text-left ${
                      selectedMethod === 'PASSWORD_HASH'
                        ? 'bg-[#181615] text-[#FAF8F5] border-[#181615]'
                        : 'border-[#E7E2DA]'
                    }`}
                  >
                    Account Password
                  </button>
                )}
              </div>
            </div>

            <div>
              <label
                htmlFor="auth-identifier"
                className="block text-xs font-medium text-[#181615] dark:text-[#F5F2EB] mb-1.5"
              >
                Account Identifier or Handle
              </label>
              <input
                id="auth-identifier"
                type="text"
                required
                placeholder="e.g. aarav@example.com or member-u1"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 text-sm rounded-xl bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA] dark:border-[#2E2B28]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[44px] px-4 py-2.5 text-sm font-semibold text-[#FAF8F5] bg-[#B44C32] hover:bg-[#9E3F27] rounded-xl transition-colors"
            >
              {loading ? 'Verifying...' : 'Continue with Sign in / Sign up'}
            </button>

            <div className="pt-3 border-t border-[#E7E2DA] dark:border-[#2E2B28] flex items-center justify-between text-xs text-[#57534E] dark:text-[#A8A29E]">
              <span>Lost your device passkey?</span>
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setStep('RECOVERY');
                }}
                className="font-medium text-[#B44C32] dark:text-[#E06D53] underline"
              >
                Use Account Recovery
              </button>
            </div>
          </form>
        )}

        {step === 'COMPLETE_SIGNUP' && (
          <form onSubmit={handleCompleteSignupSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="signup-display-name"
                className="block text-xs font-medium text-[#181615] dark:text-[#F5F2EB] mb-1"
              >
                Display Name or Placeholder Handle
              </label>
              <input
                id="signup-display-name"
                type="text"
                placeholder="e.g. Studio-Member-01"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 text-sm rounded-xl bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA] dark:border-[#2E2B28]"
              />
            </div>

            <div>
              <label
                htmlFor="signup-country-code"
                className="block text-xs font-medium text-[#181615] dark:text-[#F5F2EB] mb-1"
              >
                Country Code (Sets Your Permanent Account Currency)
              </label>
              <select
                id="signup-country-code"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 text-sm rounded-xl bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA] dark:border-[#2E2B28]"
              >
                {countryCodes.map((c) => (
                  <option key={c.countryCode} value={c.countryCode}>
                    {c.countryName} → {c.currency}
                  </option>
                ))}
              </select>
            </div>

            {/* Mandatory Plain-Language Currency Lock Disclosure (Section C) */}
            <div className="p-3.5 rounded-xl bg-[#FAF8F5] dark:bg-[#262320] border border-[#B44C32]/50 text-xs text-[#181615] dark:text-[#F5F2EB]">
              <div className="font-semibold mb-0.5">
                Account Currency: {currencyPreview.currency}
              </div>
              <p>{currencyPreview.explanation}</p>
            </div>

            <div className="space-y-2.5 pt-1">
              <label className="flex items-start gap-2.5 text-xs text-[#181615] dark:text-[#F5F2EB] cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAdultConfirmed}
                  onChange={(e) => setIsAdultConfirmed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-[#B44C32]"
                />
                <span>I confirm that I am 18 years of age or older.</span>
              </label>

              <label className="flex items-start gap-2.5 text-xs text-[#181615] dark:text-[#F5F2EB] cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-[#B44C32]"
                />
                <span>
                  I agree to the plain-language Privacy Notice and Service Terms (India DPDP Act
                  2023 &amp; GDPR compliant; files never leave my device).
                </span>
              </label>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setStep('IDENTIFY')}
                className="min-h-[44px] px-4 py-2 text-xs font-medium border border-[#E7E2DA] dark:border-[#2E2B28] rounded-xl"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 min-h-[44px] px-4 py-2.5 text-sm font-semibold text-[#FAF8F5] bg-[#B44C32] hover:bg-[#9E3F27] rounded-xl"
              >
                {loading ? 'Creating Account...' : 'Create Account & Lock Currency'}
              </button>
            </div>
          </form>
        )}

        {step === 'RECOVERY' && (
          <form onSubmit={handleRecoverySubmit} className="space-y-4">
            <div className="p-3.5 rounded-xl bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA] dark:border-[#2E2B28] text-xs space-y-1.5">
              <div className="font-semibold text-[#181615] dark:text-[#F5F2EB] flex items-center gap-1.5">
                <LifeBuoy className="w-4 h-4 text-[#B44C32]" />
                <span>Layered Account Recovery Paths</span>
              </div>
              <p className="text-[#57534E] dark:text-[#A8A29E]">
                1. Enter one of your 10 single-use Recovery Kit codes below.
              </p>
              <p className="text-[#57534E] dark:text-[#A8A29E]">
                2. Sign in from another linked device or method.
              </p>
              <p className="text-[#57534E] dark:text-[#A8A29E]">
                3. Request Support-Verified Recovery (requires Support checklist + Super User
                approval with a 24-hour cooling-off notice).
              </p>
            </div>

            <div>
              <label
                htmlFor="recovery-identifier"
                className="block text-xs font-medium mb-1"
              >
                Account Identifier
              </label>
              <input
                id="recovery-identifier"
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Your registered identifier"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm rounded-xl bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA]"
              />
            </div>

            <div>
              <label htmlFor="recovery-code" className="block text-xs font-medium mb-1">
                One-Time Recovery Code
              </label>
              <input
                id="recovery-code"
                type="text"
                required
                value={recoveryCodeInput}
                onChange={(e) => setRecoveryCodeInput(e.target.value)}
                placeholder="VS-XXXX-XXXX"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono rounded-xl bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA]"
              />
            </div>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setStep('IDENTIFY')}
                className="min-h-[44px] px-4 py-2 text-xs font-medium border border-[#E7E2DA] rounded-xl"
              >
                Back to Sign In
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 min-h-[44px] px-4 py-2.5 text-sm font-semibold text-[#FAF8F5] bg-[#B44C32] rounded-xl"
              >
                Verify Recovery Code
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

interface RecoveryKitModalProps {
  codes: string[];
  onClose: () => void;
}

export const RecoveryKitModal: React.FC<RecoveryKitModalProps> = ({ codes, onClose }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard?.writeText(codes.join('\n'));
    setCopied(true);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="One-Time Recovery Kit"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] rounded-2xl max-w-lg w-full p-6 space-y-4">
        <div className="flex items-center gap-2 text-[#15803D]">
          <ShieldCheck className="w-5 h-5" />
          <span className="text-xs font-semibold">Shown Once · Save Your Recovery Codes</span>
        </div>
        <h2 className="text-lg font-bold text-[#181615] dark:text-[#F5F2EB]">
          Your 10 One-Time Account Recovery Codes
        </h2>
        <p className="text-xs text-[#57534E] dark:text-[#A8A29E]">
          These codes allow you to regain access to your account without relying on paid SMS or
          external providers. We store only one-way hashes, so this is the only time these codes
          will be shown.
        </p>

        <div className="grid grid-cols-2 gap-2 p-3.5 rounded-xl bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA] dark:border-[#2E2B28] font-mono text-xs">
          {codes.map((c) => (
            <div key={c} className="py-1 px-2 rounded bg-white dark:bg-[#1C1A18]">
              {c}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <button
            type="button"
            onClick={handleCopy}
            className="min-h-[40px] px-3.5 py-2 text-xs font-medium border border-[#E7E2DA] rounded-lg flex items-center gap-1.5"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied to Clipboard' : 'Copy All 10 Codes'}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] px-5 py-2 text-xs font-semibold text-[#FAF8F5] bg-[#181615] dark:bg-[#E06D53] dark:text-[#121110] rounded-lg"
          >
            I Have Saved My Recovery Kit
          </button>
        </div>
      </div>
    </div>
  );
};
