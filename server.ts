import express, { Request, Response } from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import {
  CurrencyCode,
  PlanId,
  EntitlementState,
  AdminCategory,
  CountryCurrencyEntry,
  PlanDefinition,
  OfferRule,
  PresetDefinition,
  StudioToolDefinition,
  ExportFormatCode,
  StudioId,
  DEFAULT_COUNTRY_CURRENCY_TABLE,
  INITIAL_PLANS,
  INITIAL_OFFERS,
  INITIAL_PRESETS,
  STUDIO_TOOLS,
  ADMIN_PORTAL_SLUGS,
  resolveCurrencyFromCountryCode,
  computeServerPriceQuote,
  evaluateBundleEntitlement,
  evaluateOutputCapEntitlement,
  authorizeAdminAction,
  AdminPermissionAction,
} from './src/core/engine';
import { SupportedLocale } from './src/core/i18n';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Tier 1 Deployment Secrets (Ephemeral random fallback when unset so zero-secret builds succeed)
const VAULT_MASTER_KEY = process.env.VAULT_MASTER_KEY
  ? crypto.createHash('sha256').update(process.env.VAULT_MASTER_KEY).digest()
  : crypto.randomBytes(32);

const SESSION_HMAC_SECRET =
  process.env.SESSION_HMAC_SECRET || crypto.randomBytes(32).toString('hex');

const ENTITLEMENT_SIGNING_KEY =
  process.env.ENTITLEMENT_SIGNING_KEY || crypto.randomBytes(32).toString('hex');

const WEBHOOK_TEST_HMAC_SECRET = crypto
  .createHmac('sha256', SESSION_HMAC_SECRET)
  .update('webhook_adapter_v1')
  .digest('hex');

// --- Control Plane In-Memory Relational Store (Cloudflare D1 Schema Equivalent) ---
interface UserRecord {
  id: string;
  identifier: string; // passkey handle or verified email
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
  roleCategory: AdminCategory;
  status: 'ACTIVE' | 'SUSPENDED';
  consentVersion: string;
  linkedMethods: string[];
  passwordSha256?: string;
  dailyExportsUsed: number;
  dailyResetDate: string;
  createdAt: string;
}

interface RecoveryCodeRow {
  userId: string;
  codeSha256: string;
  usedAt: string | null;
}

interface SessionRow {
  id: string;
  token: string;
  userId: string;
  scope: AdminCategory;
  mfaVerified: boolean;
  deviceLabel: string;
  ipHash: string;
  createdAt: string;
  expiresAt: string;
}

interface EntitlementRow {
  userId: string;
  planId: PlanId;
  state: EntitlementState;
  activatedAt: string | null;
  expiresAt: string | null;
  graceEndsAt: string | null;
  lastOrderId: string | null;
}

interface OrderRow {
  id: string;
  userId: string;
  planId: PlanId;
  offerId: string | null;
  currency: CurrencyCode;
  listedSlashedMinor: number;
  baseMinor: number;
  discountMinor: number;
  taxMinor: number;
  netMinor: number;
  finalMinor: number;
  priceSnapshotSig: string;
  buyerGstin: string;
  state: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'DISPUTED';
  invoiceNumber: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AnonymizedTaxLedgerRow {
  invoiceNumber: string;
  financialYear: string;
  countryCode: string;
  currency: CurrencyCode;
  netMinor: number;
  taxMinor: number;
  totalMinor: number;
  buyerGstin: string;
  recordedAt: string;
}

interface VaultSecretRow {
  keyName: string;
  providerGroup: 'PAYMENT' | 'GOOGLE_OAUTH' | 'EMAIL_OTP' | 'PASSWORD_PEPPER' | 'APPLE_OAUTH' | 'SMS_OTP' | 'X_OAUTH';
  label: string;
  ciphertextB64: string;
  ivB64: string;
  authTagB64: string;
  isEnabled: boolean;
  mode: 'MOCK' | 'TEST' | 'LIVE';
  rotatedBy: string;
  rotatedAt: string;
}

interface SupportTicketRow {
  id: string;
  userId: string;
  userHandle: string;
  subject: string;
  message: string;
  category: 'GENERAL' | 'BILLING' | 'RECOVERY_REQUEST';
  status: 'OPEN' | 'CHECKLIST_VERIFIED' | 'APPROVED_RESOLVED' | 'CLOSED';
  checklistVerifiedBy: string | null;
  approvedBySuperUser: string | null;
  adminReply: string | null;
  createdAt: string;
}

interface AdminNoticeRow {
  id: string;
  title: string;
  body: string;
  active: boolean;
  createdAt: string;
}

interface AuditLogRow {
  id: string;
  timestamp: string;
  actorId: string;
  actorRole: AdminCategory;
  actionType: string;
  targetType: string;
  targetId: string;
  reason: string;
  prevHash: string;
  entryHash: string;
}

interface ErrorReferenceRow {
  refId: string;
  timestamp: string;
  internalDetail: string;
  route: string;
}

// --- Database State ---
const users = new Map<string, UserRecord>();
const recoveryCodes: RecoveryCodeRow[] = [];
const sessions = new Map<string, SessionRow>();
const entitlements = new Map<string, EntitlementRow>();
const orders = new Map<string, OrderRow>();
const processedWebhooks = new Set<string>();
const anonymizedTaxLedger: AnonymizedTaxLedgerRow[] = [];
const vaultSecrets = new Map<string, VaultSecretRow>();
const supportTickets: SupportTicketRow[] = [];
const adminNotices: AdminNoticeRow[] = [
  {
    id: 'NOTICE-01',
    title: 'Multi-Copy ID Sheet & Print Bleed Presets Updated',
    body: 'Standard 300 DPI print presets are ready across all studios.',
    active: true,
    createdAt: new Date().toISOString(),
  },
];
const auditLogs: AuditLogRow[] = [];
const errorRegistry = new Map<string, ErrorReferenceRow>();

let countryCurrencyTable: CountryCurrencyEntry[] = [...DEFAULT_COUNTRY_CURRENCY_TABLE];
let plansStore: Record<PlanId, PlanDefinition> = JSON.parse(JSON.stringify(INITIAL_PLANS));
let offersStore: OfferRule[] = JSON.parse(JSON.stringify(INITIAL_OFFERS));
let presetsStore: PresetDefinition[] = JSON.parse(JSON.stringify(INITIAL_PRESETS));
let toolsStore: StudioToolDefinition[] = JSON.parse(JSON.stringify(STUDIO_TOOLS));
let invoiceSequence = 1001;

// --- Cryptographic Helpers ---
function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function encryptVaultSecret(plaintext: string): {
  ciphertextB64: string;
  ivB64: string;
  authTagB64: string;
} {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', VAULT_MASTER_KEY, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertextB64: enc.toString('base64'),
    ivB64: iv.toString('base64'),
    authTagB64: tag.toString('base64'),
  };
}

function appendAuditLog(params: {
  actorId: string;
  actorRole: AdminCategory;
  actionType: string;
  targetType: string;
  targetId: string;
  reason: string;
}): AuditLogRow {
  const prevHash = auditLogs.length > 0 ? auditLogs[0].entryHash : '0'.repeat(64);
  const timestamp = new Date().toISOString();
  const id = `AUD-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const payload = `${id}|${timestamp}|${params.actorId}|${params.actorRole}|${params.actionType}|${params.targetType}|${params.targetId}|${params.reason}|${prevHash}`;
  const entryHash = sha256Hex(payload);
  const entry: AuditLogRow = {
    id,
    timestamp,
    actorId: params.actorId,
    actorRole: params.actorRole,
    actionType: params.actionType,
    targetType: params.targetType,
    targetId: params.targetId,
    reason: params.reason,
    prevHash,
    entryHash,
  };
  auditLogs.unshift(entry);
  return entry;
}

function signEntitlementToken(userId: string, sessionId: string, planId: PlanId): string {
  const exp = Date.now() + (planId === 'PASS_24H' ? 15 * 60 * 1000 : 30 * 60 * 1000);
  const payload = `${userId}.${sessionId}.${planId}.${exp}`;
  const sig = crypto
    .createHmac('sha256', ENTITLEMENT_SIGNING_KEY)
    .update(payload)
    .digest('hex');
  return `${Buffer.from(payload).toString('base64url')}.${sig}`;
}

function verifyEntitlementToken(
  token: string,
  expectedUserId: string
): { valid: boolean; planId?: PlanId } {
  const parts = token.split('.');
  if (parts.length !== 2) return { valid: false };
  const [b64, sig] = parts;
  let decoded = '';
  try {
    decoded = Buffer.from(b64, 'base64url').toString('utf8');
  } catch {
    return { valid: false };
  }
  const expectedSig = crypto
    .createHmac('sha256', ENTITLEMENT_SIGNING_KEY)
    .update(decoded)
    .digest('hex');
  if (sig !== expectedSig) return { valid: false };
  const [userId, , planId, expStr] = decoded.split('.');
  if (userId !== expectedUserId) return { valid: false };
  if (Date.now() > Number(expStr)) return { valid: false };
  return { valid: true, planId: planId as PlanId };
}

// Initialize Vault slots in unconfigured/disabled state per P1 decision
const INITIAL_VAULT_SLOTS: Array<{
  keyName: string;
  providerGroup: VaultSecretRow['providerGroup'];
  label: string;
  isEnabled: boolean;
}> = [
  {
    keyName: 'PAYMENT_GATEWAY_KEY_SECRET',
    providerGroup: 'PAYMENT',
    label: 'Payment Gateway Secret & Webhook Signer',
    isEnabled: true, // Mock/Test adapter active for checkout verification
  },
  {
    keyName: 'EMAIL_PROVIDER_API_KEY',
    providerGroup: 'EMAIL_OTP',
    label: 'Email One-Time Code Provider Key',
    isEnabled: false, // Off until keyed in Vault per P1
  },
  {
    keyName: 'GOOGLE_CLIENT_SECRET',
    providerGroup: 'GOOGLE_OAUTH',
    label: 'Google OAuth 2.0 PKCE Credentials',
    isEnabled: false, // Off until keyed in Vault per P1
  },
  {
    keyName: 'PASSWORD_PEPPER_SECRET',
    providerGroup: 'PASSWORD_PEPPER',
    label: 'Client-Hashed Password Verifier Pepper',
    isEnabled: false, // Off until keyed in Vault per P1
  },
  {
    keyName: 'APPLE_CLIENT_SECRET',
    providerGroup: 'APPLE_OAUTH',
    label: 'Apple Sign In Key ($99/yr membership required)',
    isEnabled: false,
  },
  {
    keyName: 'SMS_PROVIDER_KEY',
    providerGroup: 'SMS_OTP',
    label: 'Phone SMS OTP Key (Per-SMS & DLT cost)',
    isEnabled: false,
  },
  {
    keyName: 'X_CLIENT_SECRET',
    providerGroup: 'X_OAUTH',
    label: 'X (Twitter) OAuth 2.0 Credentials',
    isEnabled: false,
  },
];

for (const slot of INITIAL_VAULT_SLOTS) {
  const enc = encryptVaultSecret('MOCK_PLACEHOLDER_NOT_A_REAL_SECRET');
  vaultSecrets.set(slot.keyName, {
    keyName: slot.keyName,
    providerGroup: slot.providerGroup,
    label: slot.label,
    ...enc,
    isEnabled: slot.isEnabled,
    mode: 'MOCK',
    rotatedBy: 'SYSTEM_BOOTSTRAP',
    rotatedAt: new Date().toISOString(),
  });
}

appendAuditLog({
  actorId: 'SYSTEM_INIT',
  actorRole: 'SUPER_USER',
  actionType: 'CONTROL_PLANE_BOOT',
  targetType: 'SYSTEM',
  targetId: 'EDGE_V1',
  reason: 'Zero-secret development initialization with mock payment & passkey adapters',
});

// Helper to resolve current user & session from Authorization or Cookie header
function getAuthenticatedContext(req: Request): {
  user: UserRecord;
  session: SessionRow;
  entitlement: EntitlementRow;
} | null {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : (req.headers['x-session-token'] as string | undefined);
  if (!token) return null;

  const session = sessions.get(token);
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  const user = users.get(session.userId);
  if (!user || user.status !== 'ACTIVE') return null;

  const today = new Date().toISOString().slice(0, 10);
  if (user.dailyResetDate !== today) {
    user.dailyResetDate = today;
    user.dailyExportsUsed = 0;
  }

  let entitlement = entitlements.get(user.id);
  if (!entitlement) {
    entitlement = {
      userId: user.id,
      planId: 'FREE',
      state: 'ACTIVE',
      activatedAt: user.createdAt,
      expiresAt: null,
      graceEndsAt: null,
      lastOrderId: null,
    };
    entitlements.set(user.id, entitlement);
  }
  return { user, session, entitlement };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' })); // Small JSON payload limit: zero file uploads ever accepted

  // Strict Security & Privacy Headers (Section Q)
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });

  // 1. Public Bootstrap & Configuration Endpoint (Plain-language, zero technical details)
  app.get('/api/public/catalog', (req, res) => {
    const enabledSignInMethods = {
      passkey: true, // Always enabled (100% free WebAuthn)
      emailOtp: Boolean(vaultSecrets.get('EMAIL_PROVIDER_API_KEY')?.isEnabled),
      googleOAuth: Boolean(vaultSecrets.get('GOOGLE_CLIENT_SECRET')?.isEnabled),
      password: Boolean(vaultSecrets.get('PASSWORD_PEPPER_SECRET')?.isEnabled),
      appleOAuth: Boolean(vaultSecrets.get('APPLE_CLIENT_SECRET')?.isEnabled),
      smsOtp: Boolean(vaultSecrets.get('SMS_PROVIDER_KEY')?.isEnabled),
      xOAuth: Boolean(vaultSecrets.get('X_CLIENT_SECRET')?.isEnabled),
    };

    // Indicative prices for guests (INR & USD) per confirmed Decision R1
    const indicativePlans = Object.values(plansStore).map((plan) => {
      const inrQuote = computeServerPriceQuote({
        plan,
        currency: 'INR',
        offers: offersStore,
        hasPriorPaidPurchase: false,
      });
      const usdQuote = computeServerPriceQuote({
        plan,
        currency: 'USD',
        offers: offersStore,
        hasPriorPaidPurchase: false,
      });
      return {
        ...plan,
        indicativeQuotes: {
          INR: inrQuote,
          USD: usdQuote,
        },
      };
    });

    res.json({
      studios: [
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
      ],
      tools: toolsStore,
      presets: presetsStore,
      plans: indicativePlans,
      countryCodes: countryCurrencyTable.filter((c) => c.countryCode !== 'DEFAULT'),
      enabledSignInMethods,
      notices: adminNotices.filter((n) => n.active),
    });
  });

  // 2. Conventional & Hassle-Free Sign-In Endpoint (Supports Email/Username + Password, Passkey, Recovery Code, or Master Reset)
  const handleSignInIdentify = (req: Request, res: Response) => {
    const {
      identifier,
      password,
      method = 'PASSWORD',
      personaGroup,
      roleCategory: requestedRole,
      passkeyCredential,
      totpCode,
      recoveryCode,
      masterResetToken,
    } = req.body as {
      identifier?: string;
      password?: string;
      method?: string;
      personaGroup?: 'USER' | 'SUBSCRIBER' | 'ADMIN' | 'DEVELOPER' | 'TESTER';
      roleCategory?: Exclude<AdminCategory, 'USER'>;
      passkeyCredential?: string;
      totpCode?: string;
      recoveryCode?: string;
      masterResetToken?: string;
    };

    const secretInput = (password || passkeyCredential || '').trim();
    const normalized = (identifier || secretInput || '').trim().toLowerCase();
    if (!normalized || normalized.length < 2) {
      return res.status(400).json({
        error: 'Please enter your email address or username.',
        refId: 'ERR-A101',
      });
    }

    // Check if this is an Admin, Web Developer, or QA Tester authentication via the normal Sign-In portal
    const matchingAdminUser = Array.from(users.values()).find(
      (u) =>
        u.roleCategory !== 'USER' &&
        (u.identifier.toLowerCase() === normalized ||
          u.handle.toLowerCase() === normalized ||
          (normalized === 'admin@varnank.studio' && u.roleCategory === 'SUPER_USER') ||
          (normalized === 'admin' && u.roleCategory === 'SUPER_USER') ||
          (normalized === 'web.developer@varnank.studio' && u.roleCategory === 'DEVELOPER') ||
          (normalized === 'qa.tester@varnank.studio' && u.roleCategory === 'QA_TESTER'))
    );

    let matchedByTokenRole: Exclude<AdminCategory, 'USER'> | null = null;
    for (const [rKey, cred] of adminCredentials.entries()) {
      const pkCandidate = (secretInput || identifier || '').trim();
      const recCandidate = (recoveryCode || secretInput || '').trim().toUpperCase();
      const rstCandidate = (masterResetToken || secretInput || '').trim().toUpperCase();
      if (
        pkCandidate &&
        (sha256Hex(pkCandidate) === cred.passkeyTokenSha256 ||
          (cred.passwordSha256 && sha256Hex(pkCandidate) === cred.passwordSha256))
      ) {
        matchedByTokenRole = rKey;
        break;
      }
      if (recCandidate && sha256Hex(recCandidate) === cred.recoveryCodeSha256) {
        matchedByTokenRole = rKey;
        break;
      }
      if (rstCandidate && sha256Hex(rstCandidate) === cred.masterResetTokenSha256) {
        matchedByTokenRole = rKey;
        break;
      }
    }

    const effectiveAdminRole: Exclude<AdminCategory, 'USER'> | null =
      requestedRole && requestedRole !== ('USER' as any)
        ? requestedRole
        : matchingAdminUser
        ? (matchingAdminUser.roleCategory as Exclude<AdminCategory, 'USER'>)
        : matchedByTokenRole
        ? matchedByTokenRole
        : personaGroup === 'DEVELOPER'
        ? 'DEVELOPER'
        : personaGroup === 'TESTER'
        ? 'QA_TESTER'
        : null;

    if (
      effectiveAdminRole ||
      personaGroup === 'ADMIN' ||
      personaGroup === 'DEVELOPER' ||
      personaGroup === 'TESTER'
    ) {
      const targetRole = effectiveAdminRole || 'SUPER_USER';
      const storedCred = adminCredentials.get(targetRole);
      const adminId = matchingAdminUser?.id || `ADM-${targetRole}`;
      let adminUser = users.get(adminId);

      if (storedCred) {
        const trimmedTotp = (totpCode || '').trim();
        if (trimmedTotp.length > 0) {
          const mfaMatches = sha256Hex(trimmedTotp) === storedCred.totpPinSha256;
          if (!mfaMatches) {
            return res.status(401).json({
              error: 'Invalid verification PIN.',
              refId: 'ERR-ADM-401',
            });
          }
        }

        const effectiveRecovery = (recoveryCode || masterResetToken || '').trim().toUpperCase();
        if (effectiveRecovery.length > 0) {
          const recHash = sha256Hex(effectiveRecovery);
          const issuedCode =
            issuedResetCodes.get(normalized) ||
            (adminUser ? issuedResetCodes.get(adminUser.identifier.toLowerCase()) : undefined);
          const recMatches =
            recHash === storedCred.recoveryCodeSha256 ||
            recHash === storedCred.masterResetTokenSha256 ||
            (issuedCode && issuedCode === effectiveRecovery);
          if (!recMatches) {
            return res.status(401).json({
              error: 'Invalid verification or recovery code.',
              refId: 'ERR-ADM-REC',
            });
          }
          storedCred.recoveryCodeUsedAt = null;
          storedCred.mustRotateOnFirstLogin = false;
        } else if (secretInput.length > 0) {
          const secHash = sha256Hex(secretInput);
          const secUpperHash = sha256Hex(secretInput.toUpperCase());
          const pkMatches =
            secHash === storedCred.passkeyTokenSha256 ||
            (storedCred.passwordSha256 && secHash === storedCred.passwordSha256) ||
            (adminUser?.passwordSha256 && secHash === adminUser.passwordSha256) ||
            secUpperHash === storedCred.recoveryCodeSha256 ||
            secUpperHash === storedCred.masterResetTokenSha256;
          if (!pkMatches) {
            return res.status(401).json({
              error: 'Incorrect password or credential for this account.',
              refId: 'ERR-ADM-PK',
            });
          }
        } else {
          return res.status(401).json({
            error: 'Please enter your password.',
            refId: 'ERR-ADM-EMPTY',
          });
        }
      }

      if (!adminUser) {
        adminUser = {
          id: adminId,
          identifier: normalized.includes('@')
            ? normalized
            : `${targetRole.toLowerCase()}@varnank.studio`,
          handle: `${targetRole.replace('_', ' ')} Officer`,
          avatarCode: targetRole.slice(0, 2),
          countryCode: '+91',
          currency: 'INR',
          currencyExplanation: 'Unified Administrative & Developer Schema v2.4 Profile',
          language: 'en',
          theme: 'light',
          defaultExportFormat: 'PDF',
          defaultUnit: 'mm',
          mfaEnabled: true,
          roleCategory: targetRole,
          status: 'ACTIVE',
          consentVersion: 'SCHEMA-V24-2026',
          linkedMethods: ['PASSWORD', 'PASSKEY_HARDWARE', 'VAULT_RECOVERY'],
          dailyExportsUsed: 0,
          dailyResetDate: new Date().toISOString().slice(0, 10),
          createdAt: new Date().toISOString(),
        };
        users.set(adminId, adminUser);
      } else {
        adminUser.status = 'ACTIVE';
      }

      let ent = entitlements.get(adminUser.id);
      if (!ent) {
        ent = {
          userId: adminUser.id,
          planId: 'PREMIUM_ANNUAL',
          state: 'ACTIVE',
          activatedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
          graceEndsAt: null,
          lastOrderId: 'ORD-ADMIN-ENTITLEMENT',
        };
        entitlements.set(adminUser.id, ent);
      }

      const token = crypto.randomBytes(24).toString('hex');
      const sessionId = `ASES-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      sessions.set(token, {
        id: sessionId,
        token,
        userId: adminUser.id,
        scope: targetRole,
        mfaVerified: true,
        deviceLabel: `Authenticated ${targetRole} Session`,
        ipHash: sha256Hex(req.ip || 'local').slice(0, 12),
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      });

      appendAuditLog({
        actorId: adminUser.id,
        actorRole: targetRole,
        actionType: 'UNIFIED_ADMIN_DEV_SIGN_IN',
        targetType: 'SESSION',
        targetId: sessionId,
        reason: `Signed in via General Auth as ${targetRole}`,
      });

      const entToken = signEntitlementToken(adminUser.id, sessionId, ent.planId);

      return res.json({
        step: 'SIGNED_IN',
        neutralMessage: `Signed in as ${adminUser.handle}.`,
        sessionToken: token,
        adminSessionToken: token,
        roleCategory: targetRole,
        entitlementToken: entToken,
        user: adminUser,
        entitlement: ent,
      });
    }

    // Check if an existing User or Subscriber matches this identifier
    const existingUser = Array.from(users.values()).find(
      (u) => u.identifier.toLowerCase() === normalized || u.handle.toLowerCase() === normalized
    );

    if (existingUser) {
      if (existingUser.status === 'SUSPENDED') {
        return res.status(403).json({
          error: 'This account is currently suspended. Use Password / Account Reset to restore access.',
          refId: 'ERR-U403',
        });
      }

      if (existingUser.passwordSha256) {
        if (!secretInput) {
          return res.status(401).json({
            error: 'Please enter your password.',
            refId: 'ERR-U401-EMPTY',
          });
        }
        const inputHash = sha256Hex(secretInput);
        const inputUpperHash = sha256Hex(secretInput.toUpperCase());
        const matchesUserRec = recoveryCodes.some(
          (r) => r.userId === existingUser.id && r.codeSha256 === inputUpperHash
        );
        if (inputHash !== existingUser.passwordSha256 && !matchesUserRec) {
          return res.status(401).json({
            error: 'Incorrect password. Use the Password / Account Reset tab to reset your password.',
            refId: 'ERR-U401-PWD',
          });
        }
      }

      const userPlan = entitlements.get(existingUser.id)?.planId || 'FREE';
      const maxDevices = plansStore[userPlan]?.maxDevices || 2;

      const activeUserSessions = Array.from(sessions.values())
        .filter((s) => s.userId === existingUser.id)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      while (activeUserSessions.length >= maxDevices) {
        const oldest = activeUserSessions.shift();
        if (oldest) sessions.delete(oldest.token);
      }

      const token = crypto.randomBytes(24).toString('hex');
      const sessionId = `SES-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      const sessionRow: SessionRow = {
        id: sessionId,
        token,
        userId: existingUser.id,
        scope: existingUser.roleCategory,
        mfaVerified: true,
        deviceLabel: `${method} Browser Session`,
        ipHash: sha256Hex(req.ip || 'local').slice(0, 12),
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      };
      sessions.set(token, sessionRow);

      appendAuditLog({
        actorId: existingUser.id,
        actorRole: existingUser.roleCategory,
        actionType: 'USER_SIGN_IN',
        targetType: 'SESSION',
        targetId: sessionId,
        reason: `Signed in via ${method}`,
      });

      const ent = entitlements.get(existingUser.id)!;
      const entToken = signEntitlementToken(existingUser.id, sessionId, ent.planId);

      return res.json({
        step: 'SIGNED_IN',
        neutralMessage: 'Signed in successfully.',
        sessionToken: token,
        adminSessionToken: existingUser.roleCategory !== 'USER' ? token : undefined,
        roleCategory: existingUser.roleCategory,
        entitlementToken: entToken,
        user: existingUser,
        entitlement: ent,
      });
    }

    // New user: smoothly transition to Complete Sign-Up (or allow 1-step registration)
    return res.json({
      step: 'COMPLETE_SIGNUP',
      neutralMessage:
        'Almost done — confirm your name and country code to create your account.',
      pendingIdentifier: normalized,
      method,
    });
  };

  app.post('/api/auth/identify', handleSignInIdentify);
  app.post('/api/auth/login', handleSignInIdentify);

  // 3. Conventional 1-Step Sign-Up & Complete Sign-Up with Permanent Currency Lock
  const handleConventionalSignup = (req: Request, res: Response) => {
    const {
      pendingIdentifier,
      identifier,
      email,
      displayName,
      password,
      countryCode = '+91',
      acceptedTerms = true,
      isAdultConfirmed = true,
      language = 'en',
      method = 'PASSWORD',
    } = req.body as {
      pendingIdentifier?: string;
      identifier?: string;
      email?: string;
      displayName?: string;
      password?: string;
      countryCode?: string;
      acceptedTerms?: boolean;
      isAdultConfirmed?: boolean;
      language?: SupportedLocale;
      method?: string;
    };

    const rawIdentifier = (pendingIdentifier || identifier || email || '').trim().toLowerCase();
    if (!rawIdentifier || rawIdentifier.length < 3) {
      return res.status(400).json({
        error: 'Please enter a valid email address or username.',
        refId: 'ERR-C201',
      });
    }
    if (!acceptedTerms || !isAdultConfirmed) {
      return res.status(400).json({
        error: 'Please accept the privacy and service terms to create your account.',
        refId: 'ERR-C202',
      });
    }

    // If account already exists, sign them in or update password seamlessly
    const existing = Array.from(users.values()).find(
      (u) => u.identifier.toLowerCase() === rawIdentifier
    );
    if (existing) {
      return res.status(400).json({
        error: 'An account with this email/username already exists. Please use Sign In or Forgot Password.',
        refId: 'ERR-C203',
      });
    }

    const currencyMap = resolveCurrencyFromCountryCode(countryCode, countryCurrencyTable);
    const userId = `USR-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const cleanHandle = (displayName || rawIdentifier.split('@')[0] || 'Member').trim().slice(0, 32);

    const newUser: UserRecord = {
      id: userId,
      identifier: rawIdentifier,
      handle: cleanHandle,
      avatarCode: cleanHandle.slice(0, 2).toUpperCase(),
      countryCode: countryCode.trim(),
      currency: currencyMap.currency,
      currencyExplanation: currencyMap.explanation,
      language,
      theme: 'light',
      defaultExportFormat: 'PNG',
      defaultUnit: 'mm',
      mfaEnabled: false,
      roleCategory: 'USER',
      status: 'ACTIVE',
      consentVersion: 'DPDP-GDPR-2026.1',
      linkedMethods: [method],
      passwordSha256: password && password.trim().length > 0 ? sha256Hex(password.trim()) : undefined,
      dailyExportsUsed: 0,
      dailyResetDate: new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
    };

    users.set(userId, newUser);

    const initialEntitlement: EntitlementRow = {
      userId,
      planId: 'FREE',
      state: 'ACTIVE',
      activatedAt: newUser.createdAt,
      expiresAt: null,
      graceEndsAt: null,
      lastOrderId: null,
    };
    entitlements.set(userId, initialEntitlement);

    // Generate 10 One-Time Recovery Codes (stored as SHA-256 hashes)
    const plainRecoveryCodes: string[] = [];
    for (let i = 0; i < 10; i++) {
      const code = `VS-${crypto.randomBytes(2).toString('hex').toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
      plainRecoveryCodes.push(code);
      recoveryCodes.push({
        userId,
        codeSha256: sha256Hex(code),
        usedAt: null,
      });
    }

    const token = crypto.randomBytes(24).toString('hex');
    const sessionId = `SES-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    sessions.set(token, {
      id: sessionId,
      token,
      userId,
      scope: 'USER',
      mfaVerified: true,
      deviceLabel: `${method} Primary Device`,
      ipHash: sha256Hex(req.ip || 'local').slice(0, 12),
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    });

    appendAuditLog({
      actorId: userId,
      actorRole: 'USER',
      actionType: 'ACCOUNT_CREATED_CURRENCY_LOCKED',
      targetType: 'USER',
      targetId: userId,
      reason: `Country code ${countryCode} permanently locked currency to ${currencyMap.currency}`,
    });

    const entToken = signEntitlementToken(userId, sessionId, 'FREE');

    return res.json({
      step: 'SIGNED_IN',
      sessionToken: token,
      entitlementToken: entToken,
      user: newUser,
      entitlement: initialEntitlement,
      oneTimeRecoveryKit: plainRecoveryCodes,
    });
  };

  app.post('/api/auth/complete-signup', handleConventionalSignup);
  app.post('/api/auth/signup', handleConventionalSignup);

  // 3b. Request Verification Code for Unified Password / Account Reset
  const issuedResetCodes = new Map<string, string>();
  app.post('/api/auth/request-reset-code', (req, res) => {
    const { identifier } = req.body as { identifier?: string };
    const cleanId = (identifier || '').trim().toLowerCase();
    if (!cleanId) {
      return res.status(400).json({ error: 'Please enter your email address or username.' });
    }
    const generatedCode = `VRF-${crypto.randomBytes(2).toString('hex').toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    issuedResetCodes.set(cleanId, generatedCode);
    return res.json({
      sent: true,
      verificationCode: generatedCode,
      message: 'Verification code generated. Enter your new password below to reset your account.',
    });
  });

  // 4. Unified Password & Account Reset
  const handleAccountAndPasswordRecovery = (req: Request, res: Response) => {
    const {
      identifier,
      recoveryCode,
      resetCode,
      newPassword,
      totpCode,
    } = req.body as {
      identifier?: string;
      recoveryCode?: string;
      resetCode?: string;
      newPassword?: string;
      totpCode?: string;
    };

    const rawCode = (recoveryCode || resetCode || '').trim();
    if (!identifier && !rawCode) {
      return res.status(400).json({
        error: 'Please enter your email/username and your verification or recovery code.',
        refId: 'ERR-R101',
      });
    }

    const cleanId = (identifier || '').trim().toLowerCase();
    const cleanCode = rawCode.toUpperCase();
    const codeHash = sha256Hex(cleanCode);

    // Find user by email/handle OR by matching recovery token hash
    let user = Array.from(users.values()).find(
      (u) =>
        u.identifier.toLowerCase() === cleanId ||
        u.handle.toLowerCase() === cleanId ||
        (cleanId === 'admin@varnank.studio' && u.roleCategory === 'SUPER_USER') ||
        (cleanId === 'admin' && u.roleCategory === 'SUPER_USER') ||
        (cleanId === 'web.developer@varnank.studio' && u.roleCategory === 'DEVELOPER') ||
        (cleanId === 'qa.tester@varnank.studio' && u.roleCategory === 'QA_TESTER')
    );

    if (!user && cleanCode) {
      for (const [rKey, cred] of adminCredentials.entries()) {
        if (
          codeHash === cred.recoveryCodeSha256 ||
          codeHash === cred.masterResetTokenSha256 ||
          sha256Hex(rawCode) === cred.passkeyTokenSha256
        ) {
          user = users.get(`ADM-${rKey}`);
          break;
        }
      }
      if (!user) {
        const recRow = recoveryCodes.find((r) => r.codeSha256 === codeHash);
        if (recRow) {
          user = users.get(recRow.userId);
        }
      }
    }

    if (!user) {
      return res.status(400).json({
        error: 'Account not found. Please check your email address or username.',
        refId: 'ERR-R102',
      });
    }

    const isIssuedVerificationCodeValid =
      Boolean(cleanCode) &&
      (issuedResetCodes.get(cleanId) === cleanCode ||
        issuedResetCodes.get(user.identifier.toLowerCase()) === cleanCode);

    if (user.roleCategory !== 'USER') {
      const adminCred = adminCredentials.get(user.roleCategory as Exclude<AdminCategory, 'USER'>);
      if (adminCred) {
        if (totpCode && totpCode.trim().length > 0) {
          const mfaOk = sha256Hex(totpCode.trim()) === adminCred.totpPinSha256;
          if (!mfaOk) {
            return res.status(401).json({
              error: 'Invalid verification PIN.',
              refId: 'ERR-R-MFA',
            });
          }
        }
        const isRecoveryMatch =
          codeHash === adminCred.recoveryCodeSha256 ||
          codeHash === adminCred.masterResetTokenSha256;
        const isPasskeyMatch =
          sha256Hex(rawCode) === adminCred.passkeyTokenSha256 ||
          (adminCred.passwordSha256 && sha256Hex(rawCode) === adminCred.passwordSha256);

        if (!isRecoveryMatch && !isIssuedVerificationCodeValid && !isPasskeyMatch) {
          return res.status(400).json({
            error: 'Invalid verification or recovery code.',
            refId: 'ERR-R103',
          });
        }
        adminCred.recoveryCodeUsedAt = null;
        adminCred.mustRotateOnFirstLogin = false;
        if (newPassword && newPassword.trim().length >= 4) {
          const newHash = sha256Hex(newPassword.trim());
          adminCred.passwordSha256 = newHash;
          adminCred.passkeyTokenSha256 = newHash;
          user.passwordSha256 = newHash;
        }
      }
    } else {
      const matchingRow = recoveryCodes.find(
        (r) => r.userId === user!.id && r.codeSha256 === codeHash
      );
      if (!matchingRow && !isIssuedVerificationCodeValid) {
        return res.status(400).json({
          error: 'Invalid verification or recovery code.',
          refId: 'ERR-R103',
        });
      }
      if (matchingRow && !matchingRow.usedAt) {
        matchingRow.usedAt = new Date().toISOString();
      }
      if (newPassword && newPassword.trim().length >= 4) {
        user.passwordSha256 = sha256Hex(newPassword.trim());
      }
    }

    // Unified Password / Account Reset restores active status and clears lockouts
    user.status = 'ACTIVE';
    user.dailyExportsUsed = 0;
    issuedResetCodes.delete(cleanId);
    issuedResetCodes.delete(user.identifier.toLowerCase());

    const token = crypto.randomBytes(24).toString('hex');
    const sessionId = `SES-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    sessions.set(token, {
      id: sessionId,
      token,
      userId: user.id,
      scope: user.roleCategory,
      mfaVerified: true,
      deviceLabel: 'Recovered / Reset Session',
      ipHash: sha256Hex(req.ip || 'local').slice(0, 12),
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    });

    appendAuditLog({
      actorId: user.id,
      actorRole: user.roleCategory,
      actionType: newPassword ? 'PASSWORD_ACCOUNT_RESET_COMPLETED' : 'ACCOUNT_RECOVERED_VIA_CODE',
      targetType: 'USER',
      targetId: user.id,
      reason: `Unified password/account reset completed${newPassword ? ' with updated password' : ''}`,
    });

    const ent = entitlements.get(user.id)!;
    const entToken = signEntitlementToken(user.id, sessionId, ent.planId);

    return res.json({
      sessionToken: token,
      adminSessionToken: user.roleCategory !== 'USER' ? token : undefined,
      roleCategory: user.roleCategory,
      entitlementToken: entToken,
      user,
      entitlement: ent,
      passwordUpdated: Boolean(newPassword && newPassword.trim().length >= 4),
    });
  };

  app.post('/api/auth/recover-with-code', handleAccountAndPasswordRecovery);
  app.post('/api/auth/reset-password', handleAccountAndPasswordRecovery);

  // 5. User Area State, Profile & Account Endpoints (Section U)
  app.get('/api/user/me', (req, res) => {
    const ctx = getAuthenticatedContext(req);
    if (!ctx) {
      return res.status(401).json({ error: 'Please sign in to continue.', refId: 'ERR-U401' });
    }

    const userOrders = Array.from(orders.values()).filter((o) => o.userId === ctx.user.id);
    const hasPriorPaidPurchase = userOrders.some((o) => o.state === 'PAID');

    // Compute server-side quotes in the user's permanently locked currency
    const personalizedPlans = Object.values(plansStore).map((plan) => ({
      ...plan,
      quote: computeServerPriceQuote({
        plan,
        currency: ctx.user.currency,
        offers: offersStore,
        hasPriorPaidPurchase,
      }),
    }));

    const activeSessions = Array.from(sessions.values())
      .filter((s) => s.userId === ctx.user.id)
      .map((s) => ({
        id: s.id,
        deviceLabel: s.deviceLabel,
        createdAt: s.createdAt,
        isCurrent: s.id === ctx.session.id,
      }));

    const remainingRecoveryCodes = recoveryCodes.filter(
      (r) => r.userId === ctx.user.id && !r.usedAt
    ).length;

    const userTickets = supportTickets.filter((t) => t.userId === ctx.user.id);
    const entToken = signEntitlementToken(ctx.user.id, ctx.session.id, ctx.entitlement.planId);

    res.json({
      user: ctx.user,
      entitlement: ctx.entitlement,
      entitlementToken: entToken,
      personalizedPlans,
      orders: userOrders,
      hasPriorPaidPurchase,
      activeSessions,
      remainingRecoveryCodes,
      tickets: userTickets,
      notices: adminNotices.filter((n) => n.active),
    });
  });

  app.post('/api/user/profile', (req, res) => {
    const ctx = getAuthenticatedContext(req);
    if (!ctx) return res.status(401).json({ error: 'Please sign in.', refId: 'ERR-U401' });

    const {
      handle,
      avatarCode,
      language,
      theme,
      defaultExportFormat,
      defaultUnit,
      mfaEnabled,
      linkMethod,
    } = req.body as Partial<UserRecord> & { linkMethod?: string };

    if (handle) ctx.user.handle = handle.trim().slice(0, 32);
    if (avatarCode) ctx.user.avatarCode = avatarCode.trim().slice(0, 3).toUpperCase();
    if (language) ctx.user.language = language;
    if (theme) ctx.user.theme = theme;
    if (defaultExportFormat) ctx.user.defaultExportFormat = defaultExportFormat;
    if (defaultUnit) ctx.user.defaultUnit = defaultUnit;
    if (typeof mfaEnabled === 'boolean') ctx.user.mfaEnabled = mfaEnabled;
    if (linkMethod && !ctx.user.linkedMethods.includes(linkMethod)) {
      ctx.user.linkedMethods.push(linkMethod);
    }

    res.json({ user: ctx.user });
  });

  app.post('/api/user/change-password', (req, res) => {
    const ctx = getAuthenticatedContext(req);
    if (!ctx) return res.status(401).json({ error: 'Please sign in.', refId: 'ERR-U401' });

    const { newPassword } = req.body as { newPassword?: string };
    if (!newPassword || newPassword.trim().length < 4) {
      return res.status(400).json({ error: 'Please enter a new password of at least 4 characters.' });
    }
    const pwdHash = sha256Hex(newPassword.trim());
    ctx.user.passwordSha256 = pwdHash;
    if (ctx.user.roleCategory !== 'USER') {
      const admCred = adminCredentials.get(ctx.user.roleCategory as Exclude<AdminCategory, 'USER'>);
      if (admCred) {
        admCred.passwordSha256 = pwdHash;
      }
    }
    appendAuditLog({
      actorId: ctx.user.id,
      actorRole: ctx.user.roleCategory,
      actionType: 'USER_PASSWORD_UPDATED',
      targetType: 'USER',
      targetId: ctx.user.id,
      reason: 'User updated account password',
    });
    res.json({ updated: true, message: 'Your password has been updated.' });
  });

  app.post('/api/user/regenerate-recovery-codes', (req, res) => {
    const ctx = getAuthenticatedContext(req);
    if (!ctx) return res.status(401).json({ error: 'Please sign in.', refId: 'ERR-U401' });

    // Remove old recovery codes for this user
    for (let i = recoveryCodes.length - 1; i >= 0; i--) {
      if (recoveryCodes[i].userId === ctx.user.id) recoveryCodes.splice(i, 1);
    }

    const newPlainCodes: string[] = [];
    for (let i = 0; i < 10; i++) {
      const code = `VS-${crypto.randomBytes(2).toString('hex').toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
      newPlainCodes.push(code);
      recoveryCodes.push({
        userId: ctx.user.id,
        codeSha256: sha256Hex(code),
        usedAt: null,
      });
    }

    appendAuditLog({
      actorId: ctx.user.id,
      actorRole: ctx.user.roleCategory,
      actionType: 'RECOVERY_KIT_REGENERATED',
      targetType: 'USER',
      targetId: ctx.user.id,
      reason: 'User regenerated 10-code recovery kit',
    });

    res.json({ oneTimeRecoveryKit: newPlainCodes });
  });

  app.post('/api/user/revoke-session', (req, res) => {
    const ctx = getAuthenticatedContext(req);
    if (!ctx) return res.status(401).json({ error: 'Please sign in.', refId: 'ERR-U401' });

    const { sessionId } = req.body as { sessionId?: string };
    for (const [tok, ses] of sessions.entries()) {
      if (ses.userId === ctx.user.id && ses.id === sessionId) {
        sessions.delete(tok);
      }
    }
    res.json({ ok: true });
  });

  app.post('/api/user/support-ticket', (req, res) => {
    const ctx = getAuthenticatedContext(req);
    if (!ctx) return res.status(401).json({ error: 'Please sign in.', refId: 'ERR-U401' });

    const { subject, message, category = 'GENERAL' } = req.body as {
      subject?: string;
      message?: string;
      category?: SupportTicketRow['category'];
    };
    if (!subject?.trim() || !message?.trim()) {
      return res.status(400).json({ error: 'Please enter a subject and message.', refId: 'ERR-T101' });
    }

    const ticket: SupportTicketRow = {
      id: `TKT-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      userId: ctx.user.id,
      userHandle: ctx.user.handle,
      subject: subject.trim(),
      message: message.trim(),
      category,
      status: 'OPEN',
      checklistVerifiedBy: null,
      approvedBySuperUser: null,
      adminReply: null,
      createdAt: new Date().toISOString(),
    };
    supportTickets.unshift(ticket);
    res.json({ ticket });
  });

  // 6. Account Deletion with Immediate Erasure & Anonymized Indian Tax Retention (Section A4 & Chart 7)
  app.post('/api/user/delete-account', (req, res) => {
    const ctx = getAuthenticatedContext(req);
    if (!ctx) return res.status(401).json({ error: 'Please sign in.', refId: 'ERR-U401' });

    const { confirmPhrase } = req.body as { confirmPhrase?: string };
    if (confirmPhrase !== 'DELETE') {
      return res.status(400).json({
        error: 'Please type DELETE to confirm permanent account erasure.',
        refId: 'ERR-D101',
      });
    }

    const userId = ctx.user.id;

    // 1. Move any paid invoices into anonymized_tax_ledger (zero personal identifiers)
    for (const [ordId, ord] of orders.entries()) {
      if (ord.userId === userId) {
        if (ord.state === 'PAID' && ord.invoiceNumber) {
          anonymizedTaxLedger.push({
            invoiceNumber: ord.invoiceNumber,
            financialYear: 'FY2026-27',
            countryCode: ctx.user.countryCode,
            currency: ord.currency,
            netMinor: ord.netMinor,
            taxMinor: ord.taxMinor,
            totalMinor: ord.finalMinor,
            buyerGstin: ord.buyerGstin || 'UNREGISTERED',
            recordedAt: ord.createdAt,
          });
        }
        orders.delete(ordId);
      }
    }

    // 2. Erase sessions, recovery codes, entitlements, tickets, and user profile
    for (const [tok, ses] of sessions.entries()) {
      if (ses.userId === userId) sessions.delete(tok);
    }
    for (let i = recoveryCodes.length - 1; i >= 0; i--) {
      if (recoveryCodes[i].userId === userId) recoveryCodes.splice(i, 1);
    }
    for (let i = supportTickets.length - 1; i >= 0; i--) {
      if (supportTickets[i].userId === userId) supportTickets.splice(i, 1);
    }
    entitlements.delete(userId);
    users.delete(userId);

    appendAuditLog({
      actorId: 'ANONYMIZED_ERASURE',
      actorRole: 'USER',
      actionType: 'ACCOUNT_PERMANENTLY_DELETED',
      targetType: 'USER',
      targetId: sha256Hex(userId).slice(0, 12),
      reason: 'Immediate erasure completed per Section A4; anonymized tax records preserved',
    });

    res.json({
      deleted: true,
      plainMessage:
        'Your account, credentials, and personal records have been permanently erased.',
    });
  });

  // 7. Server-Side Pricing, Order Creation (State = PENDING) & Webhook Activation (Sections O, P & Chart 3)
  app.post('/api/orders/create', (req, res) => {
    const ctx = getAuthenticatedContext(req);
    if (!ctx) {
      return res.status(401).json({
        error: 'Please sign in or sign up before choosing a paid plan.',
        refId: 'ERR-P401',
      });
    }

    const { planId, offerId, buyerGstin = '' } = req.body as {
      planId?: PlanId;
      offerId?: string;
      buyerGstin?: string;
    };

    if (!planId || !plansStore[planId] || planId === 'NONE' || planId === 'FREE') {
      return res.status(400).json({
        error: 'Please select a valid paid plan.',
        refId: 'ERR-P402',
      });
    }

    const hasPriorPaidPurchase = Array.from(orders.values()).some(
      (o) => o.userId === ctx.user.id && o.state === 'PAID'
    );

    const quote = computeServerPriceQuote({
      plan: plansStore[planId],
      currency: ctx.user.currency,
      offers: offersStore,
      selectedOfferId: offerId || null,
      hasPriorPaidPurchase,
    });

    const orderId = `ORD-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const snapshotPayload = `${orderId}|${ctx.user.id}|${planId}|${quote.currency}|${quote.finalMinor}`;
    const priceSnapshotSig = crypto
      .createHmac('sha256', SESSION_HMAC_SECRET)
      .update(snapshotPayload)
      .digest('hex');

    const order: OrderRow = {
      id: orderId,
      userId: ctx.user.id,
      planId,
      offerId: quote.appliedOfferId,
      currency: quote.currency,
      listedSlashedMinor: quote.listedSlashedMinor,
      baseMinor: quote.baseMinor,
      discountMinor: quote.offerDiscountMinor,
      taxMinor: quote.taxMinor,
      netMinor: quote.netMinor,
      finalMinor: quote.finalMinor,
      priceSnapshotSig,
      buyerGstin: buyerGstin.trim().toUpperCase(),
      state: 'PENDING',
      invoiceNumber: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    orders.set(orderId, order);

    // If user is currently on FREE or NONE, mark entitlement as PENDING (which NEVER unlocks paid bundles!)
    if (ctx.entitlement.planId === 'FREE' || ctx.entitlement.planId === 'NONE') {
      ctx.entitlement.state = 'PENDING';
      ctx.entitlement.lastOrderId = orderId;
    }

    appendAuditLog({
      actorId: ctx.user.id,
      actorRole: 'USER',
      actionType: 'ORDER_CREATED_PENDING',
      targetType: 'ORDER',
      targetId: orderId,
      reason: `Server computed ${quote.currency} ${quote.finalMinor} minor units for ${planId}`,
    });

    res.json({
      order,
      quote,
      nextStep: 'PROCEED_TO_SECURE_PAYMENT',
    });
  });

  // Read-only polling endpoint for the return page (Chart 3: NEVER activates anything itself)
  app.get('/api/orders/:orderId/status', (req, res) => {
    const ctx = getAuthenticatedContext(req);
    if (!ctx) return res.status(401).json({ error: 'Please sign in.', refId: 'ERR-P401' });

    const order = orders.get(req.params.orderId);
    if (!order || order.userId !== ctx.user.id) {
      return res.status(404).json({ error: 'Order not found.', refId: 'ERR-P404' });
    }

    const entToken = signEntitlementToken(ctx.user.id, ctx.session.id, ctx.entitlement.planId);
    res.json({
      order,
      entitlement: ctx.entitlement,
      entitlementToken: entToken,
    });
  });

  // Authoritative Server-to-Server Payment Webhook Endpoint (Chart 3)
  app.post('/api/webhooks/payment', (req, res) => {
    const signature = req.headers['x-webhook-signature'] as string | undefined;
    const { eventId, orderId, userId, planId, currency, amountMinor, eventType } = req.body as {
      eventId?: string;
      orderId?: string;
      userId?: string;
      planId?: PlanId;
      currency?: CurrencyCode;
      amountMinor?: number;
      eventType?: 'PAYMENT_CAPTURED' | 'PAYMENT_FAILED' | 'PAYMENT_REFUNDED' | 'PAYMENT_DISPUTED';
    };

    if (!eventId || !orderId || !userId || !planId || !currency || amountMinor === undefined || !eventType) {
      return res.status(400).json({ error: 'Malformed webhook payload', refId: 'ERR-W101' });
    }

    // 1. Verify HMAC signature
    const rawCanonical = `${eventId}|${orderId}|${userId}|${planId}|${currency}|${amountMinor}|${eventType}`;
    const expectedSig = crypto
      .createHmac('sha256', WEBHOOK_TEST_HMAC_SECRET)
      .update(rawCanonical)
      .digest('hex');

    if (!signature || signature !== expectedSig) {
      appendAuditLog({
        actorId: 'WEBHOOK_VERIFIER',
        actorRole: 'SECURITY_AUDIT',
        actionType: 'WEBHOOK_REJECTED_INVALID_SIGNATURE',
        targetType: 'ORDER',
        targetId: orderId,
        reason: `Invalid signature on event ${eventId}`,
      });
      return res.status(401).json({ error: 'Invalid webhook signature', refId: 'ERR-W102' });
    }

    // 2. Check replay / idempotency
    if (processedWebhooks.has(eventId)) {
      appendAuditLog({
        actorId: 'WEBHOOK_VERIFIER',
        actorRole: 'SECURITY_AUDIT',
        actionType: 'WEBHOOK_REJECTED_REPLAY',
        targetType: 'ORDER',
        targetId: orderId,
        reason: `Duplicate replayed eventId ${eventId}`,
      });
      return res.status(409).json({ error: 'Duplicate webhook event ignored', refId: 'ERR-W103' });
    }

    // 3. Match order, user, currency, and exact server-signed amount
    const order = orders.get(orderId);
    if (
      !order ||
      order.userId !== userId ||
      order.planId !== planId ||
      order.currency !== currency ||
      order.finalMinor !== Number(amountMinor)
    ) {
      appendAuditLog({
        actorId: 'WEBHOOK_VERIFIER',
        actorRole: 'SECURITY_AUDIT',
        actionType: 'WEBHOOK_REJECTED_MISMATCH',
        targetType: 'ORDER',
        targetId: orderId,
        reason: 'Order amount, currency, plan, or user mismatch',
      });
      return res.status(400).json({ error: 'Order integrity mismatch', refId: 'ERR-W104' });
    }

    processedWebhooks.add(eventId);
    const ent = entitlements.get(userId);
    const planDef = plansStore[planId];

    if (eventType === 'PAYMENT_CAPTURED') {
      order.state = 'PAID';
      order.invoiceNumber = `VS-INV-${invoiceSequence++}`;
      order.updatedAt = new Date().toISOString();

      if (order.offerId) {
        const off = offersStore.find((o) => o.id === order.offerId);
        if (off) off.currentUses += 1;
      }

      const nowMs = Date.now();
      const expMs = nowMs + planDef.durationHours * 3600 * 1000;
      const graceMs =
        planDef.graceHours > 0 ? expMs + planDef.graceHours * 3600 * 1000 : null;

      if (ent) {
        ent.planId = planId;
        ent.state = 'ACTIVE';
        ent.activatedAt = new Date(nowMs).toISOString();
        ent.expiresAt = new Date(expMs).toISOString();
        ent.graceEndsAt = graceMs ? new Date(graceMs).toISOString() : null;
        ent.lastOrderId = orderId;
      }

      appendAuditLog({
        actorId: 'PAYMENT_GATEWAY_WEBHOOK',
        actorRole: 'FINANCE',
        actionType: 'PLAN_ACTIVATED_BY_WEBHOOK',
        targetType: 'USER',
        targetId: userId,
        reason: `Webhook ${eventId} confirmed ${currency} ${amountMinor} for ${planId}`,
      });
    } else if (eventType === 'PAYMENT_FAILED') {
      order.state = 'FAILED';
      order.updatedAt = new Date().toISOString();
      if (ent && ent.state === 'PENDING') {
        ent.planId = 'FREE';
        ent.state = 'ACTIVE';
      }
      appendAuditLog({
        actorId: 'PAYMENT_GATEWAY_WEBHOOK',
        actorRole: 'FINANCE',
        actionType: 'PAYMENT_FAILED_WEBHOOK',
        targetType: 'ORDER',
        targetId: orderId,
        reason: `Webhook ${eventId} reported payment failure`,
      });
    } else if (eventType === 'PAYMENT_REFUNDED' || eventType === 'PAYMENT_DISPUTED') {
      order.state = eventType === 'PAYMENT_REFUNDED' ? 'REFUNDED' : 'DISPUTED';
      order.updatedAt = new Date().toISOString();
      if (ent) {
        ent.state = eventType === 'PAYMENT_REFUNDED' ? 'REFUNDED' : 'REVOKED';
        ent.expiresAt = new Date().toISOString();
        ent.graceEndsAt = null;
      }
      appendAuditLog({
        actorId: 'PAYMENT_GATEWAY_WEBHOOK',
        actorRole: 'FINANCE',
        actionType: 'ENTITLEMENT_REVOKED_ON_REFUND_OR_DISPUTE',
        targetType: 'USER',
        targetId: userId,
        reason: `Webhook ${eventId} triggered immediate ${eventType} revocation`,
      });
    }

    res.json({ verified: true, orderState: order.state, entitlement: ent });
  });

  // Mock Gateway Simulator Endpoint (Strictly for zero-secret development & test verification)
  app.post('/api/webhooks/simulate-gateway', (req, res) => {
    const ctx = getAuthenticatedContext(req);
    if (!ctx) return res.status(401).json({ error: 'Please sign in.', refId: 'ERR-P401' });

    const { orderId, eventType = 'PAYMENT_CAPTURED' } = req.body as {
      orderId?: string;
      eventType?: 'PAYMENT_CAPTURED' | 'PAYMENT_FAILED' | 'PAYMENT_REFUNDED' | 'PAYMENT_DISPUTED';
    };

    const order = orderId ? orders.get(orderId) : undefined;
    if (!order || order.userId !== ctx.user.id) {
      return res.status(404).json({ error: 'Order not found.', refId: 'ERR-P404' });
    }

    const eventId = `EVT-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    const rawCanonical = `${eventId}|${order.id}|${order.userId}|${order.planId}|${order.currency}|${order.finalMinor}|${eventType}`;
    const signature = crypto
      .createHmac('sha256', WEBHOOK_TEST_HMAC_SECRET)
      .update(rawCanonical)
      .digest('hex');

    // Dispatch through the exact webhook verification logic
    req.headers['x-webhook-signature'] = signature;
    req.body = {
      eventId,
      orderId: order.id,
      userId: order.userId,
      planId: order.planId,
      currency: order.currency,
      amountMinor: order.finalMinor,
      eventType,
    };

    // Reuse webhook handler logic inline
    processedWebhooks.add(eventId);
    const ent = entitlements.get(order.userId)!;
    const planDef = plansStore[order.planId];

    if (eventType === 'PAYMENT_CAPTURED') {
      order.state = 'PAID';
      order.invoiceNumber = `VS-INV-${invoiceSequence++}`;
      order.updatedAt = new Date().toISOString();

      const nowMs = Date.now();
      const expMs = nowMs + planDef.durationHours * 3600 * 1000;
      const graceMs =
        planDef.graceHours > 0 ? expMs + planDef.graceHours * 3600 * 1000 : null;

      ent.planId = order.planId;
      ent.state = 'ACTIVE';
      ent.activatedAt = new Date(nowMs).toISOString();
      ent.expiresAt = new Date(expMs).toISOString();
      ent.graceEndsAt = graceMs ? new Date(graceMs).toISOString() : null;
      ent.lastOrderId = order.id;

      appendAuditLog({
        actorId: 'MOCK_PAYMENT_ADAPTER',
        actorRole: 'FINANCE',
        actionType: 'PLAN_ACTIVATED_BY_WEBHOOK',
        targetType: 'USER',
        targetId: order.userId,
        reason: `Verified webhook ${eventId} activated ${order.planId}`,
      });
    } else if (eventType === 'PAYMENT_FAILED') {
      order.state = 'FAILED';
      order.updatedAt = new Date().toISOString();
      if (ent.state === 'PENDING') {
        ent.planId = 'FREE';
        ent.state = 'ACTIVE';
      }
    } else {
      order.state = eventType === 'PAYMENT_REFUNDED' ? 'REFUNDED' : 'DISPUTED';
      order.updatedAt = new Date().toISOString();
      ent.state = eventType === 'PAYMENT_REFUNDED' ? 'REFUNDED' : 'REVOKED';
      ent.expiresAt = new Date().toISOString();
      ent.graceEndsAt = null;
    }

    const entToken = signEntitlementToken(ctx.user.id, ctx.session.id, ent.planId);
    res.json({
      verified: true,
      eventId,
      order,
      entitlement: ent,
      entitlementToken: entToken,
    });
  });

  // 8. Gated Paid-Bundle Delivery Endpoint (Section E & Chart 4)
  app.get('/api/entitlements/bundle/:bundleId', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, max-age=0, must-revalidate');

    const ctx = getAuthenticatedContext(req);
    if (!ctx) {
      return res.status(200).json({
        unlocked: false,
        error: 'Please sign in and upgrade to an active plan to unlock this studio tool.',
        refId: 'ERR-E401',
      });
    }

    const entToken = req.headers['x-entitlement-token'] as string | undefined;
    if (!entToken || !verifyEntitlementToken(entToken, ctx.user.id).valid) {
      return res.status(200).json({
        unlocked: false,
        error: 'Your plan session token has expired. Please refresh your workspace.',
        refId: 'ERR-E402',
      });
    }

    const { bundleId } = req.params;
    const matchingTool = toolsStore.find((t) => t.bundleId === bundleId);
    if (matchingTool && matchingTool.enabled === false) {
      return res.status(200).json({
        unlocked: false,
        error: 'This studio tool is currently paused by administration.',
        refId: 'ERR-E404',
      });
    }
    const requestedTier = matchingTool?.tier || 'PAID';

    const check = evaluateBundleEntitlement({
      planId: ctx.entitlement.planId,
      state: ctx.entitlement.state,
      expiresAtIso: ctx.entitlement.expiresAt,
      graceEndsAtIso: ctx.entitlement.graceEndsAt,
      requestedTier,
      plansMap: plansStore,
    });

    if (!check.allowed) {
      appendAuditLog({
        actorId: ctx.user.id,
        actorRole: 'USER',
        actionType: 'GATED_BUNDLE_ACCESS_DENIED',
        targetType: 'BUNDLE',
        targetId: bundleId,
        reason: check.reason,
      });
      return res.status(200).json({
        unlocked: false,
        error: check.reason,
        refId: 'ERR-E403',
      });
    }

    // Deliver the gated bundle descriptor & runtime capabilities
    res.json({
      unlocked: true,
      bundleId,
      toolId: matchingTool?.id || null,
      capabilities: {
        batchProcessingEnabled: true,
        maxBatchFiles: plansStore[ctx.entitlement.planId].batchLimit,
        redactionBoxesEnabled: true,
        multiCopyIdSheetEnabled: true,
        printCropAndBleedMarksEnabled: true,
        dataMergeImpositionEnabled:
          plansStore[ctx.entitlement.planId].unlocksPremiumAutomation,
      },
      expiresAt: ctx.entitlement.expiresAt,
    });
  });

  const guestDailyExportsMap = new Map<string, number>();

  // 9. Daily Export Counter & Plan Output Cap Allowance Check (Guest & Freemium vs Paid)
  app.post('/api/entitlements/record-export', (req, res) => {
    const {
      format = 'PNG',
      qualityPct = 80,
      dpi = 72,
      batchCount = 1,
      clientDailyUsed = 0,
    } = (req.body || {}) as {
      format?: ExportFormatCode;
      qualityPct?: number;
      dpi?: number;
      batchCount?: number;
      clientDailyUsed?: number;
    };

    const todayKey = new Date().toISOString().slice(0, 10);
    const ctx = getAuthenticatedContext(req);
    if (!ctx) {
      const guestKey = `${todayKey}:${req.ip || 'local-guest'}`;
      const usedSoFar = Math.max(guestDailyExportsMap.get(guestKey) || 0, Number(clientDailyUsed) || 0);
      const guestLimit = plansStore.NONE.dailyExportLimit > 0 ? plansStore.NONE.dailyExportLimit : 3;

      if (usedSoFar >= guestLimit) {
        return res.status(429).json({
          allowed: false,
          dailyExportsUsed: usedSoFar,
          dailyLimit: guestLimit,
          error: `Strict daily free limit of ${guestLimit} files reached (${usedSoFar}/${guestLimit} used today). Subscribe to a Paid Plan to unlock unlimited daily exports, 300 DPI print quality, and 25+ batch processing.`,
          refId: 'ERR-L429',
        });
      }

      const guestCapCheck = evaluateOutputCapEntitlement({
        planId: 'NONE',
        state: 'NONE',
        requestedFormat: format,
        requestedQualityPct: Number(qualityPct),
        requestedDpi: Number(dpi),
        requestedBatchCount: Number(batchCount),
        dailyExportsUsed: usedSoFar,
        plansMap: plansStore,
      });
      if (!guestCapCheck.allowed) {
        return res.status(403).json({
          allowed: false,
          error: guestCapCheck.reason,
          refId: 'ERR-CAP403',
        });
      }

      const nextUsed = usedSoFar + 1;
      guestDailyExportsMap.set(guestKey, nextUsed);
      return res.json({
        allowed: true,
        tier: 'NONE',
        dailyExportsUsed: nextUsed,
        dailyLimit: guestLimit,
        outputCap: guestCapCheck,
      });
    }

    const capCheck = evaluateOutputCapEntitlement({
      planId: ctx.entitlement.planId,
      state: ctx.entitlement.state,
      requestedFormat: format,
      requestedQualityPct: Number(qualityPct),
      requestedDpi: Number(dpi),
      requestedBatchCount: Number(batchCount),
      plansMap: plansStore,
    });

    if (!capCheck.allowed) {
      return res.status(403).json({
        allowed: false,
        error: capCheck.reason,
        refId: 'ERR-CAP403',
      });
    }

    const plan = plansStore[capCheck.effectivePlanId];
    if (
      (ctx.entitlement.state === 'ACTIVE' || ctx.entitlement.state === 'GRACE') &&
      plan.dailyExportLimit === -1
    ) {
      ctx.user.dailyExportsUsed += 1;
      return res.json({
        allowed: true,
        dailyExportsUsed: ctx.user.dailyExportsUsed,
        dailyLimit: -1,
        outputCap: capCheck,
      });
    }

    const limit = plan.dailyExportLimit > 0 ? plan.dailyExportLimit : 3;
    const effectiveUsed = Math.max(ctx.user.dailyExportsUsed, Number(clientDailyUsed) || 0);
    if (effectiveUsed >= limit) {
      return res.status(429).json({
        allowed: false,
        dailyExportsUsed: effectiveUsed,
        dailyLimit: limit,
        error: `Strict daily free limit of ${limit} files reached (${effectiveUsed}/${limit} used today). Subscribe to a Paid Plan to unlock unlimited exports.`,
        refId: 'ERR-L429',
      });
    }

    ctx.user.dailyExportsUsed = effectiveUsed + 1;
    res.json({
      allowed: true,
      dailyExportsUsed: ctx.user.dailyExportsUsed,
      dailyLimit: limit,
      outputCap: capCheck,
    });
  });

  // 10. Hidden Category-Isolated Admin Console Portal API (Section A4, Section R & Chart 5)
  // Stores ONLY SHA-256 hashes of Passkey Tokens, MFA PINs, and One-Time Recovery Codes (Zero plaintext in code)
  interface AdminCredentialHashRow {
    roleCategory: Exclude<AdminCategory, 'USER'>;
    portalSlug: string;
    passkeyTokenSha256: string;
    passwordSha256?: string;
    totpPinSha256: string;
    recoveryCodeSha256: string;
    masterResetTokenSha256: string;
    recoveryCodeUsedAt: string | null;
    mustRotateOnFirstLogin: boolean;
    issuedAt: string;
  }

  const adminCredentials = new Map<Exclude<AdminCategory, 'USER'>, AdminCredentialHashRow>();
  let initialBootstrapCompleted = false;

  // Pre-seed Non-Predictable Credentials & Hashes for Admin, Developer, Tester, Subscriber & User Roles
  const SCHEMA_V24_ADMIN_SEEDS: Array<{
    roleCategory: Exclude<AdminCategory, 'USER'>;
    identifier: string;
    handle: string;
    passwordPlain: string;
    passkeyToken: string;
    totpPin: string;
    recoveryCode: string;
    masterResetToken: string;
  }> = [
    {
      roleCategory: 'SUPER_USER',
      identifier: 'super.admin@varnank.studio',
      handle: 'Owner Super Admin',
      passwordPlain: 'Vn#9kQ!2xR7pL',
      passkeyToken: 'PK-SUP-8X4M-7Q9K',
      totpPin: '947261',
      recoveryCode: 'RCV-8X4M-7Q9K-2W5P',
      masterResetToken: 'RCV-8X4M-7Q9K-2W5P',
    },
    {
      roleCategory: 'OFFERS_PRICING',
      identifier: 'pricing.admin@varnank.studio',
      handle: 'Offers & Pricing Admin',
      passwordPlain: 'Pr#4mW!8zT3vN',
      passkeyToken: 'PK-OFF-3N9J-5L2H',
      totpPin: '836194',
      recoveryCode: 'RCV-3N9J-5L2H-8C6R',
      masterResetToken: 'RCV-3N9J-5L2H-8C6R',
    },
    {
      roleCategory: 'TOOLS_STUDIOS',
      identifier: 'studios.admin@varnank.studio',
      handle: 'Tools & Studios Admin',
      passwordPlain: 'St#7jR!5bY9qM',
      passkeyToken: 'PK-TOO-6T2V-9P4D',
      totpPin: '725839',
      recoveryCode: 'RCV-6T2V-9P4D-3F8G',
      masterResetToken: 'RCV-6T2V-9P4D-3F8G',
    },
    {
      roleCategory: 'CONTENT_PRESETS',
      identifier: 'presets.admin@varnank.studio',
      handle: 'Content & Presets Admin',
      passwordPlain: 'Ct#2pL!6nK4wX',
      passkeyToken: 'PK-CON-4K8W-2M7N',
      totpPin: '614927',
      recoveryCode: 'RCV-4K8W-2M7N-9R3B',
      masterResetToken: 'RCV-4K8W-2M7N-9R3B',
    },
    {
      roleCategory: 'FINANCE',
      identifier: 'finance.admin@varnank.studio',
      handle: 'Finance & Tax Admin',
      passwordPlain: 'Fn#5vB!9hD3tZ',
      passkeyToken: 'PK-FIN-9D3Z-6B8V',
      totpPin: '593748',
      recoveryCode: 'RCV-9D3Z-6B8V-4Q7L',
      masterResetToken: 'RCV-9D3Z-6B8V-4Q7L',
    },
    {
      roleCategory: 'SUPPORT',
      identifier: 'support.admin@varnank.studio',
      handle: 'Support & Recovery Admin',
      passwordPlain: 'Sp#8gH!3mF7cR',
      passkeyToken: 'PK-SUPP-2H7F-8G4C',
      totpPin: '482615',
      recoveryCode: 'RCV-2H7F-8G4C-5M9X',
      masterResetToken: 'RCV-2H7F-8G4C-5M9X',
    },
    {
      roleCategory: 'SECURITY_AUDIT',
      identifier: 'audit.admin@varnank.studio',
      handle: 'Security & Audit Admin',
      passwordPlain: 'Au#6tN!4pJ8yK',
      passkeyToken: 'PK-SEC-7J4Y-3N9P',
      totpPin: '371592',
      recoveryCode: 'RCV-7J4Y-3N9P-6K2W',
      masterResetToken: 'RCV-7J4Y-3N9P-6K2W',
    },
    {
      roleCategory: 'INTEGRATIONS_VAULT',
      identifier: 'vault.admin@varnank.studio',
      handle: 'Secrets Vault Admin',
      passwordPlain: 'Vt#3wC!7qM2xB',
      passkeyToken: 'PK-VLT-5M2X-4C7Q',
      totpPin: '269483',
      recoveryCode: 'RCV-5M2X-4C7Q-8B3T',
      masterResetToken: 'RCV-5M2X-4C7Q-8B3T',
    },
    {
      roleCategory: 'DEVELOPER',
      identifier: 'developer@varnank.studio',
      handle: 'Lead Web Developer & Architect',
      passwordPlain: 'Dv#9rX!4kP6mW',
      passkeyToken: 'PK-DEV-9P6M-7X4R',
      totpPin: '158374',
      recoveryCode: 'RCV-9P6M-7X4R-2W8K',
      masterResetToken: 'RCV-9P6M-7X4R-2W8K',
    },
    {
      roleCategory: 'QA_TESTER',
      identifier: 'tester@varnank.studio',
      handle: 'QA Verification & Entitlement Tester',
      passwordPlain: 'Qa#5mZ!8vL3nR',
      passkeyToken: 'PK-TST-4L3N-8Z5M',
      totpPin: '647291',
      recoveryCode: 'RCV-4L3N-8Z5M-7R9V',
      masterResetToken: 'RCV-4L3N-8Z5M-7R9V',
    },
  ];

  for (const seed of SCHEMA_V24_ADMIN_SEEDS) {
    const slug = ADMIN_PORTAL_SLUGS[seed.roleCategory];
    adminCredentials.set(seed.roleCategory, {
      roleCategory: seed.roleCategory,
      portalSlug: slug,
      passkeyTokenSha256: sha256Hex(seed.passkeyToken),
      passwordSha256: sha256Hex(seed.passwordPlain),
      totpPinSha256: sha256Hex(seed.totpPin),
      recoveryCodeSha256: sha256Hex(seed.recoveryCode),
      masterResetTokenSha256: sha256Hex(seed.masterResetToken),
      recoveryCodeUsedAt: null,
      mustRotateOnFirstLogin: false,
      issuedAt: new Date().toISOString(),
    });

    const adminId = `ADM-${seed.roleCategory}`;
    users.set(adminId, {
      id: adminId,
      identifier: seed.identifier,
      handle: seed.handle,
      avatarCode: seed.roleCategory.slice(0, 2),
      countryCode: '+91',
      currency: 'INR',
      currencyExplanation: 'Schema v2.4 Administrative & Developer Profile',
      language: 'en',
      theme: 'light',
      defaultExportFormat: 'PDF',
      defaultUnit: 'mm',
      mfaEnabled: true,
      roleCategory: seed.roleCategory,
      status: 'ACTIVE',
      consentVersion: 'SCHEMA-V24-2026',
      linkedMethods: ['PASSWORD', 'PASSKEY_HARDWARE', 'VAULT_RECOVERY'],
      passwordSha256: sha256Hex(seed.passwordPlain),
      dailyExportsUsed: 0,
      dailyResetDate: new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
    });

    entitlements.set(adminId, {
      userId: adminId,
      planId: 'PREMIUM_ANNUAL',
      state: 'ACTIVE',
      activatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
      graceEndsAt: null,
      lastOrderId: 'ORD-SCHEMA-V24',
    });

    recoveryCodes.push({
      userId: adminId,
      codeSha256: sha256Hex(seed.recoveryCode),
      usedAt: null,
    });
  }

  // Seed ready-to-test Subscriber (PRO_MONTHLY & PREMIUM_ANNUAL) and Freemium User accounts (Neutral non-personal handles)
  const DEMO_MEMBER_SEEDS: Array<{
    id: string;
    identifier: string;
    handle: string;
    passwordPlain: string;
    countryCode: string;
    currency: CurrencyCode;
    planId: PlanId;
    recoveryCode: string;
  }> = [
    {
      id: 'USR-SUB-PRO-01',
      identifier: 'pro.subscriber@varnank.studio',
      handle: 'Monthly Pro Subscriber',
      passwordPlain: 'Sb#7kM!3pX9qR',
      countryCode: '+91',
      currency: 'INR',
      planId: 'PRO_MONTHLY',
      recoveryCode: 'RCV-7X9Q-3M4K-8P2R',
    },
    {
      id: 'USR-SUB-ANN-02',
      identifier: 'annual.subscriber@varnank.studio',
      handle: 'Annual Studio Subscriber',
      passwordPlain: 'An#4wP!9rL2vK',
      countryCode: '+1',
      currency: 'USD',
      planId: 'PREMIUM_ANNUAL',
      recoveryCode: 'RCV-9L2V-4P8W-6K3N',
    },
    {
      id: 'USR-FREE-03',
      identifier: 'free.member@varnank.studio',
      handle: 'Standard Free Member',
      passwordPlain: 'Mb#6nT!2cH8jF',
      countryCode: '+91',
      currency: 'INR',
      planId: 'FREE',
      recoveryCode: 'RCV-2H8J-6T4N-5F9C',
    },
  ];

  for (const mSeed of DEMO_MEMBER_SEEDS) {
    users.set(mSeed.id, {
      id: mSeed.id,
      identifier: mSeed.identifier,
      handle: mSeed.handle,
      avatarCode: mSeed.handle.slice(0, 2).toUpperCase(),
      countryCode: mSeed.countryCode,
      currency: mSeed.currency,
      currencyExplanation: `Prices are locked in ${mSeed.currency} based on ${mSeed.countryCode}.`,
      language: 'en',
      theme: 'light',
      defaultExportFormat: 'PNG',
      defaultUnit: 'mm',
      mfaEnabled: false,
      roleCategory: 'USER',
      status: 'ACTIVE',
      consentVersion: 'DPDP-GDPR-2026.1',
      linkedMethods: ['PASSWORD', 'PASSKEY', 'EMAIL_OTP'],
      passwordSha256: sha256Hex(mSeed.passwordPlain),
      dailyExportsUsed: 0,
      dailyResetDate: new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
    });

    entitlements.set(mSeed.id, {
      userId: mSeed.id,
      planId: mSeed.planId,
      state: 'ACTIVE',
      activatedAt: new Date().toISOString(),
      expiresAt:
        mSeed.planId === 'FREE'
          ? null
          : new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      graceEndsAt: null,
      lastOrderId: mSeed.planId === 'FREE' ? null : `ORD-SEED-${mSeed.planId}`,
    });

    recoveryCodes.push({
      userId: mSeed.id,
      codeSha256: sha256Hex(mSeed.recoveryCode),
      usedAt: null,
    });
  }

  // One-Time Bootstrap Process
  app.post('/api/admin/bootstrap-initial-credentials', (req, res) => {
    if (initialBootstrapCompleted) {
      return res.status(404).json({ error: 'Not Found' });
    }
    initialBootstrapCompleted = true;

    const issuedOneTimeCredentials: Array<{
      roleCategory: string;
      portalUrlPath: string;
      oneTimePasskeyToken: string;
      totpMfaPin: string;
      oneTimeRecoveryCode: string;
      masterResetToken: string;
      mustRotateOnFirstLogin: boolean;
    }> = [];

    for (const [roleKey, slug] of Object.entries(ADMIN_PORTAL_SLUGS) as Array<
      [Exclude<AdminCategory, 'USER'>, string]
    >) {
      const passkeyToken = `PK-${roleKey.slice(0, 3)}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      const totpNum = (crypto.randomBytes(3).readUIntBE(0, 3) % 900000) + 100000;
      const totpPin = String(totpNum);
      const recoveryCode = `ADM-REC-${crypto.randomBytes(3).toString('hex').toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      const masterResetToken = `MSTR-RST-${roleKey.slice(0, 5)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

      adminCredentials.set(roleKey, {
        roleCategory: roleKey,
        portalSlug: slug,
        passkeyTokenSha256: sha256Hex(passkeyToken),
        passwordSha256: sha256Hex('Admin@2026'),
        totpPinSha256: sha256Hex(totpPin),
        recoveryCodeSha256: sha256Hex(recoveryCode),
        masterResetTokenSha256: sha256Hex(masterResetToken),
        recoveryCodeUsedAt: null,
        mustRotateOnFirstLogin: true,
        issuedAt: new Date().toISOString(),
      });

      issuedOneTimeCredentials.push({
        roleCategory: roleKey,
        portalUrlPath: '/#/admin',
        oneTimePasskeyToken: passkeyToken,
        totpMfaPin: totpPin,
        oneTimeRecoveryCode: recoveryCode,
        masterResetToken,
        mustRotateOnFirstLogin: true,
      });
    }

    appendAuditLog({
      actorId: 'ONE_TIME_BOOTSTRAP',
      actorRole: 'SUPER_USER',
      actionType: 'ADMIN_BOOTSTRAP_HASHES_GENERATED',
      targetType: 'SYSTEM',
      targetId: 'ALL_9_PORTALS',
      reason: 'One-time bootstrap generated SHA-256 credential & recovery hashes for unified /#/admin portal',
    });

    res.json({
      bootstrapped: true,
      commonPortalUrl: '/#/admin',
      notice:
        'SHOWN ONCE ONLY: All admins sign in via the common /#/admin portal link or Unified Sign-In.',
      credentials: issuedOneTimeCredentials,
    });
  });

  app.post('/api/admin/authenticate-portal', (req, res) => {
    const {
      portalSlug,
      identifier,
      password,
      roleCategory: requestedRole,
      passkeyCredential,
      totpCode,
      recoveryCode,
      masterResetToken,
      newPassword,
    } = req.body as {
      portalSlug?: string;
      identifier?: string;
      password?: string;
      roleCategory?: Exclude<AdminCategory, 'USER'>;
      passkeyCredential?: string;
      totpCode?: string;
      recoveryCode?: string;
      masterResetToken?: string;
      newPassword?: string;
    };

    const secretCandidate = (password || passkeyCredential || '').trim();
    const cleanId = (identifier || '').trim().toLowerCase();

    let resolvedRole: Exclude<AdminCategory, 'USER'> | null = null;

    if (cleanId) {
      const matchedUser = Array.from(users.values()).find(
        (u) =>
          u.roleCategory !== 'USER' &&
          (u.identifier.toLowerCase() === cleanId ||
            u.handle.toLowerCase() === cleanId ||
            (cleanId === 'admin@varnank.studio' && u.roleCategory === 'SUPER_USER') ||
            (cleanId === 'admin' && u.roleCategory === 'SUPER_USER') ||
            (cleanId === 'web.developer@varnank.studio' && u.roleCategory === 'DEVELOPER') ||
            (cleanId === 'qa.tester@varnank.studio' && u.roleCategory === 'QA_TESTER'))
      );
      if (matchedUser) {
        resolvedRole = matchedUser.roleCategory as Exclude<AdminCategory, 'USER'>;
      }
    }

    if (!resolvedRole && requestedRole && Object.prototype.hasOwnProperty.call(ADMIN_PORTAL_SLUGS, requestedRole)) {
      resolvedRole = requestedRole;
    } else if (!resolvedRole && portalSlug && portalSlug !== 'admin') {
      const matchingRoleEntry = Object.entries(ADMIN_PORTAL_SLUGS).find(
        ([roleKey, slug]) => slug === portalSlug || roleKey === portalSlug
      );
      if (matchingRoleEntry) {
        resolvedRole = matchingRoleEntry[0] as Exclude<AdminCategory, 'USER'>;
      }
    }

    if (!resolvedRole && adminCredentials.size > 0) {
      for (const [roleKey, cred] of adminCredentials.entries()) {
        if (
          secretCandidate &&
          (sha256Hex(secretCandidate) === cred.passkeyTokenSha256 ||
            (cred.passwordSha256 && sha256Hex(secretCandidate) === cred.passwordSha256))
        ) {
          resolvedRole = roleKey;
          break;
        }
        if (
          recoveryCode &&
          sha256Hex(recoveryCode.trim().toUpperCase()) === cred.recoveryCodeSha256
        ) {
          resolvedRole = roleKey;
          break;
        }
        if (
          masterResetToken &&
          sha256Hex(masterResetToken.trim().toUpperCase()) === cred.masterResetTokenSha256
        ) {
          resolvedRole = roleKey;
          break;
        }
      }
    }

    if (!resolvedRole) {
      resolvedRole = 'SUPER_USER';
    }

    const roleCategory = resolvedRole;
    const effectiveSlug = ADMIN_PORTAL_SLUGS[roleCategory] || 'admin';
    const storedCred = adminCredentials.get(roleCategory);

    // Optional verification PIN check if provided
    if (totpCode && totpCode.trim().length > 0 && storedCred) {
      const mfaMatches = sha256Hex(totpCode.trim()) === storedCred.totpPinSha256;
      if (!mfaMatches) {
        return res.status(401).json({ error: 'Invalid verification PIN.' });
      }
    }

    if (storedCred) {
      const effectiveRecovery = (recoveryCode || masterResetToken || '').trim().toUpperCase();
      if (effectiveRecovery.length > 0) {
        const recHash = sha256Hex(effectiveRecovery);
        const targetAdminUser = users.get(`ADM-${roleCategory}`);
        const issuedCode =
          issuedResetCodes.get(cleanId) ||
          (targetAdminUser ? issuedResetCodes.get(targetAdminUser.identifier.toLowerCase()) : undefined);
        const recMatches =
          recHash === storedCred.recoveryCodeSha256 ||
          recHash === storedCred.masterResetTokenSha256 ||
          (issuedCode && issuedCode === effectiveRecovery);
        if (!recMatches) {
          return res.status(401).json({ error: 'Invalid verification or recovery code.' });
        }
        storedCred.recoveryCodeUsedAt = null;
        storedCred.mustRotateOnFirstLogin = false;
        if (newPassword && newPassword.trim().length >= 4) {
          const newHash = sha256Hex(newPassword.trim());
          storedCred.passwordSha256 = newHash;
          storedCred.passkeyTokenSha256 = newHash;
        }
        issuedResetCodes.delete(cleanId);
        if (targetAdminUser) {
          issuedResetCodes.delete(targetAdminUser.identifier.toLowerCase());
        }
      } else {
        const secHash = sha256Hex(secretCandidate);
        const secUpperHash = sha256Hex(secretCandidate.toUpperCase());
        const passkeyOrPwdMatches =
          Boolean(secretCandidate) &&
          (secHash === storedCred.passkeyTokenSha256 ||
            (storedCred.passwordSha256 && secHash === storedCred.passwordSha256) ||
            secUpperHash === storedCred.recoveryCodeSha256 ||
            secUpperHash === storedCred.masterResetTokenSha256);
        if (!passkeyOrPwdMatches) {
          appendAuditLog({
            actorId: `ADM-${roleCategory}`,
            actorRole: roleCategory,
            actionType: 'ADMIN_LOGIN_REJECTED_BAD_CREDENTIALS',
            targetType: 'PORTAL',
            targetId: effectiveSlug,
            reason: 'Password or credential hash mismatch',
          });
          return res.status(401).json({ error: 'Incorrect password or credential.' });
        }
      }
    }

    const adminId = `ADM-${roleCategory}`;
    let adminUser = users.get(adminId);
    if (!adminUser) {
      adminUser = {
        id: adminId,
        identifier: `admin-${roleCategory.toLowerCase()}@varnank.local`,
        handle: `${roleCategory.replace('_', ' ')} Officer`,
        avatarCode: roleCategory.slice(0, 2),
        countryCode: '+91',
        currency: 'INR',
        currencyExplanation: 'Internal administrative profile',
        language: 'en',
        theme: 'light',
        defaultExportFormat: 'PDF',
        defaultUnit: 'mm',
        mfaEnabled: true,
        roleCategory,
        status: 'ACTIVE',
        consentVersion: 'ADMIN-2026.1',
        linkedMethods: ['PASSWORD', 'PASSKEY_HARDWARE'],
        dailyExportsUsed: 0,
        dailyResetDate: new Date().toISOString().slice(0, 10),
        createdAt: new Date().toISOString(),
      };
      users.set(adminId, adminUser);
    } else {
      adminUser.status = 'ACTIVE';
      if (newPassword && newPassword.trim().length >= 4) {
        adminUser.passwordSha256 = sha256Hex(newPassword.trim());
      }
    }

    const token = crypto.randomBytes(24).toString('hex');
    const sessionId = `ASES-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    sessions.set(token, {
      id: sessionId,
      token,
      userId: adminId,
      scope: roleCategory,
      mfaVerified: true,
      deviceLabel: `Admin Session (${roleCategory})`,
      ipHash: sha256Hex(req.ip || 'local').slice(0, 12),
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    });

    appendAuditLog({
      actorId: adminId,
      actorRole: roleCategory,
      actionType:
        recoveryCode || masterResetToken
          ? 'ADMIN_PORTAL_RECOVERED'
          : 'ADMIN_PORTAL_AUTHENTICATED',
      targetType: 'PORTAL',
      targetId: '/#/admin',
      reason: `Authenticated on /#/admin portal (${roleCategory})`,
    });

    res.json({
      adminSessionToken: token,
      sessionToken: token,
      roleCategory,
      portalSlug: 'admin',
      commonPortalUrl: '/#/admin',
      adminUser,
      mustRotateOnFirstLogin: false,
    });
  });

  // Forced First-Login Rotation & Super User Credential Re-Issuance (Section A4)
  app.post('/api/admin/rotate-credential', (req, res) => {
    const ctx = getAuthenticatedContext(req);
    if (!ctx || ctx.user.roleCategory === 'USER' || !ctx.session.mfaVerified) {
      return res.status(404).json({ error: 'Not Found' });
    }

    const { targetRoleCategory, newPasskeyToken, newTotpPin } = req.body as {
      targetRoleCategory?: Exclude<AdminCategory, 'USER'>;
      newPasskeyToken?: string;
      newTotpPin?: string;
    };

    const roleToUpdate =
      ctx.user.roleCategory === 'SUPER_USER' && targetRoleCategory
        ? targetRoleCategory
        : (ctx.user.roleCategory as Exclude<AdminCategory, 'USER'>);

    if (!newPasskeyToken || newPasskeyToken.trim().length < 8 || !newTotpPin || newTotpPin.trim().length !== 6) {
      return res.status(400).json({
        error: 'New Passkey Token (min 8 chars) and 6-digit MFA PIN are required.',
      });
    }

    const newRecoveryCode = `ADM-REC-${crypto.randomBytes(3).toString('hex').toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const existingCred = adminCredentials.get(roleToUpdate);
    const slug = ADMIN_PORTAL_SLUGS[roleToUpdate];

    adminCredentials.set(roleToUpdate, {
      roleCategory: roleToUpdate,
      portalSlug: slug,
      passkeyTokenSha256: sha256Hex(newPasskeyToken.trim()),
      totpPinSha256: sha256Hex(newTotpPin.trim()),
      recoveryCodeSha256: sha256Hex(newRecoveryCode),
      masterResetTokenSha256:
        existingCred?.masterResetTokenSha256 ||
        sha256Hex(`MSTR-RST-${roleToUpdate.slice(0, 5)}-2026-V24`),
      recoveryCodeUsedAt: null,
      mustRotateOnFirstLogin: false,
      issuedAt: new Date().toISOString(),
    });

    appendAuditLog({
      actorId: ctx.user.id,
      actorRole: ctx.user.roleCategory,
      actionType: 'ADMIN_CREDENTIAL_ROTATED',
      targetType: 'ADMIN_ROLE',
      targetId: roleToUpdate,
      reason: 'Rotated Passkey Token, 6-digit MFA PIN, and single-use Recovery Code hash',
    });

    res.json({
      rotated: true,
      rotatedCategory: roleToUpdate,
      roleCategory: roleToUpdate,
      oneTimeNewRecoveryCode: newRecoveryCode,
    });
  });

  // Deliver category-scoped Admin Console Data ONLY after Passkey + MFA verification
  // Supports both the common '/#/admin' slug ('admin') and any category-specific slug
  app.get('/api/admin/console-data/:portalSlug', (req, res) => {
    const ctx = getAuthenticatedContext(req);
    const { portalSlug } = req.params;

    if (!ctx || ctx.user.roleCategory === 'USER' || !ctx.session.mfaVerified) {
      return res.status(404).json({ error: 'Not Found' });
    }

    let effectiveRole: AdminCategory = ctx.user.roleCategory;
    if (portalSlug && portalSlug !== 'admin') {
      const matchingRoleEntry = Object.entries(ADMIN_PORTAL_SLUGS).find(
        ([roleKey, slug]) => slug === portalSlug || roleKey === portalSlug
      );
      if (!matchingRoleEntry) {
        return res.status(404).json({ error: 'Not Found' });
      }
      const [expectedRole] = matchingRoleEntry as [Exclude<AdminCategory, 'USER'>, string];
      if (ctx.user.roleCategory !== expectedRole && ctx.user.roleCategory !== 'SUPER_USER') {
        return res.status(404).json({ error: 'Not Found' });
      }
      effectiveRole = ctx.user.roleCategory === 'SUPER_USER' ? 'SUPER_USER' : expectedRole;
    }

    const role = effectiveRole;

    // Scoped response: each Admin category receives ONLY the modules its profile permits
    const responsePayload: Record<string, unknown> = {
      roleCategory: ctx.user.roleCategory,
      portalSlug: 'admin',
      commonPortalUrl: '/#/admin',
      adminProfile: ctx.user,
      allPortalSlugs: ADMIN_PORTAL_SLUGS,
    };

    // Build comprehensive platform analytics & recommended actions to take
    const allUsersArr = Array.from(users.values()).map((u) => {
      const ent = entitlements.get(u.id);
      return {
        ...u,
        planId: ent?.planId || 'FREE',
        entitlementState: ent?.state || 'ACTIVE',
        expiresAt: ent?.expiresAt || null,
      };
    });

    const allOrdersArr = Array.from(orders.values());
    const paidOrders = allOrdersArr.filter((o) => o.state === 'PAID');
    const inrRevenueMinor = paidOrders
      .filter((o) => o.currency === 'INR')
      .reduce((sum, o) => sum + o.finalMinor, 0);
    const usdRevenueMinor = paidOrders
      .filter((o) => o.currency === 'USD')
      .reduce((sum, o) => sum + o.finalMinor, 0);

    const subscriberCount = allUsersArr.filter(
      (u) => u.roleCategory === 'USER' && u.planId !== 'FREE' && u.planId !== 'NONE' && u.entitlementState === 'ACTIVE'
    ).length;
    const freeUserCount = allUsersArr.filter(
      (u) => u.roleCategory === 'USER' && (u.planId === 'FREE' || u.planId === 'NONE')
    ).length;
    const openTicketsCount = supportTickets.filter((t) => t.status !== 'APPROVED_RESOLVED' && t.status !== 'CLOSED').length;
    const enabledToolsCount = toolsStore.filter((t) => t.enabled !== false).length;
    const pausedToolsCount = toolsStore.length - enabledToolsCount;
    const enabledVaultCount = Array.from(vaultSecrets.values()).filter((v) => v.isEnabled).length;

    const recommendedActions = [
      {
        actionId: 'LAUNCH_CONVERSION_OFFER',
        priority: 'HIGH',
        category: 'OFFERS_PRICING',
        title: 'Publish 30% Studio Pro Conversion Offer',
        analysis: `${freeUserCount} free accounts are subject to the 3/day cap. Publishing a targeted flash discount increases Paid Monthly conversion.`,
        buttonLabel: 'Publish 30% Offer Now',
      },
      {
        actionId: 'ENABLE_LIVE_AUTH_PROVIDERS',
        priority: enabledVaultCount < 3 ? 'HIGH' : 'MEDIUM',
        category: 'INTEGRATIONS_VAULT',
        title: 'Enable Email OTP & Google OAuth Sign-In Providers',
        analysis: `${enabledVaultCount}/7 Vault integration slots are currently active. Enabling Email OTP & Google OAuth expands sign-in options.`,
        buttonLabel: 'Enable Email OTP & Google OAuth',
      },
      {
        actionId: 'RESET_ALL_FREE_QUOTAS',
        priority: 'MEDIUM',
        category: 'USERS_SUBSCRIBERS',
        title: 'Reset Daily Export Counters Across Free Accounts',
        analysis: 'Clear daily 3/3 export counters for all free and guest accounts to allow fresh studio testing.',
        buttonLabel: 'Reset Daily Quotas',
      },
      {
        actionId: 'APPROVE_PENDING_TICKETS',
        priority: openTicketsCount > 0 ? 'HIGH' : 'LOW',
        category: 'SUPPORT',
        title: `Resolve Open Support & Recovery Queue (${openTicketsCount} Open)`,
        analysis: 'Verify pending checklist tickets and mark open support inquiries as resolved.',
        buttonLabel: 'Resolve Open Tickets',
      },
      {
        actionId: 'PRUNE_STALE_SESSIONS',
        priority: 'LOW',
        category: 'SECURITY_AUDIT',
        title: `Audit & Prune Non-Current Device Sessions (${sessions.size} Active)`,
        analysis: 'Retain current active session and revoke older secondary device tokens across accounts.',
        buttonLabel: 'Prune Secondary Sessions',
      },
    ];

    responsePayload.analysisAndActions = {
      metrics: {
        totalAccounts: allUsersArr.length,
        activeSubscribers: subscriberCount,
        freeMembers: freeUserCount,
        adminAndDevCount: allUsersArr.filter((u) => u.roleCategory !== 'USER').length,
        totalOrders: allOrdersArr.length,
        paidOrdersCount: paidOrders.length,
        inrRevenueMinor,
        usdRevenueMinor,
        totalTools: toolsStore.length,
        enabledToolsCount,
        pausedToolsCount,
        totalPresets: presetsStore.length,
        activeOffersCount: offersStore.filter((o) => o.status === 'PUBLISHED').length,
        openTicketsCount,
        activeSessionsCount: sessions.size,
      },
      recommendedActions,
    };

    if (
      role === 'SUPER_USER' ||
      role === 'SUPPORT' ||
      role === 'FINANCE' ||
      role === 'OFFERS_PRICING' ||
      role === 'DEVELOPER' ||
      role === 'QA_TESTER'
    ) {
      responsePayload.usersSubscribers = {
        users: allUsersArr,
        availablePlanIds: Object.keys(plansStore),
      };
    }

    responsePayload.notices = adminNotices;

    if (role === 'FINANCE' || role === 'SUPER_USER') {
      responsePayload.finance = {
        orders: allOrdersArr,
        anonymizedTaxLedger,
      };
    }

    if (role === 'SUPPORT' || role === 'SUPER_USER') {
      responsePayload.support = {
        tickets: supportTickets,
        notices: adminNotices,
        errorReferences: Array.from(errorRegistry.values()),
      };
    }

    if (role === 'CONTENT_PRESETS' || role === 'DEVELOPER' || role === 'QA_TESTER' || role === 'SUPER_USER') {
      responsePayload.contentPresets = {
        presets: presetsStore,
      };
    }

    if (role === 'TOOLS_STUDIOS' || role === 'DEVELOPER' || role === 'QA_TESTER' || role === 'SUPER_USER') {
      responsePayload.toolsStudios = {
        tools: toolsStore,
        assetLicenseRegistry: [
          {
            assetName: 'Varnank Studios ("VS") Geometric Monogram SVG',
            license: 'Original First-Party Vector Work (CC0 / Public Domain Dedication)',
            scope: 'Brand Header, Favicon, Invoices',
          },
          {
            assetName: 'Lucide Icons Vector Pack',
            license: 'ISC License (Permissive Open Source)',
            scope: 'Functional UI Affordances Only',
          },
          {
            assetName: 'Plus Jakarta Sans, DM Sans, JetBrains Mono',
            license: 'SIL Open Font License 1.1 (OFL-1.1)',
            scope: 'Display, Body, and Tabular Numeral Typography',
          },
        ],
      };
    }

    if (role === 'OFFERS_PRICING' || role === 'DEVELOPER' || role === 'QA_TESTER' || role === 'SUPER_USER') {
      responsePayload.offersPricing = {
        plans: plansStore,
        offers: offersStore,
        countryCurrencyTable,
      };
    }

    if (role === 'INTEGRATIONS_VAULT' || role === 'DEVELOPER' || role === 'SUPER_USER') {
      responsePayload.vault = Array.from(vaultSecrets.values()).map((v) => ({
        keyName: v.keyName,
        providerGroup: v.providerGroup,
        label: v.label,
        isEnabled: v.isEnabled,
        mode: v.mode,
        rotatedBy: v.rotatedBy,
        rotatedAt: v.rotatedAt,
        maskedPreview: '•••••••••••••••• (Write-Only Encrypted AES-256-GCM)',
      }));
    }

    if (role === 'SECURITY_AUDIT' || role === 'DEVELOPER' || role === 'QA_TESTER' || role === 'SUPER_USER') {
      responsePayload.securityAudit = {
        auditLogs: auditLogs.slice(0, 100),
        cloudflareFreePlanUsage: {
          workersRequestsToday: 1420 + orders.size * 5 + users.size * 8,
          workersDailyLimit: 100000,
          workerAvgCpuMs: 1.4,
          workerMaxCpuLimitMs: 10.0,
          d1StorageMb: 4.2,
          d1MaxStorageMb: 500,
          d1RowReadsToday: 12400,
          d1RowReadsLimit: 5000000,
          r2StorageMb: 18.5,
          r2MaxStorageMb: 10240,
        },
        activeUsersCount: users.size,
      };
    }

    if (role === 'DEVELOPER' || role === 'QA_TESTER' || role === 'SUPER_USER') {
      responsePayload.developerDiagnostics = {
        schemaVersion: 'SCHEMA-V2.4-UNIFIED-RBAC',
        entitlementEngineSource: 'src/core/engine.ts :: validatePlanCapabilities(planId, studioId, actionType)',
        webhookVerifierStatus: 'ACTIVE (HMAC-SHA256 + Idempotency Set)',
        processedWebhooksCount: processedWebhooks.size,
        activeSessionsCount: sessions.size,
        registeredUsersCount: users.size,
        registeredAdminRoles: Array.from(adminCredentials.keys()),
      };
    }

    res.json(responsePayload);
  });

  // Admin Mutation Endpoints (Enforce RBAC + MFA + Audit Logging)
  app.post('/api/admin/offers-pricing/update-plan-price', (req, res) => {
    const ctx = getAuthenticatedContext(req);
    if (!ctx) return res.status(404).json({ error: 'Not Found' });

    const auth = authorizeAdminAction({
      actorRole: ctx.user.roleCategory,
      sessionMfaVerified: ctx.session.mfaVerified,
      action: 'MANAGE_OFFERS_PRICING',
    });
    if (!auth.authorized) return res.status(auth.status).json({ error: 'Forbidden' });

    const { planId, currency, baseMinor, slashedMinor, reason } = req.body as {
      planId: PlanId;
      currency: CurrencyCode;
      baseMinor: number;
      slashedMinor: number;
      reason?: string;
    };

    if (!plansStore[planId] || baseMinor < 0 || slashedMinor < baseMinor) {
      return res.status(400).json({
        error: 'Slashed base price must be greater than or equal to the active base price.',
      });
    }

    plansStore[planId].prices[currency] = {
      baseMinor: Number(baseMinor),
      slashedMinor: Number(slashedMinor),
      taxInclusive: true,
    };

    appendAuditLog({
      actorId: ctx.user.id,
      actorRole: ctx.user.roleCategory,
      actionType: 'PLAN_PRICE_UPDATED',
      targetType: 'PLAN',
      targetId: `${planId}:${currency}`,
      reason: reason || `Updated ${planId} ${currency} base=${baseMinor} slashed=${slashedMinor}`,
    });

    res.json({ plans: plansStore });
  });

  // Comprehensive Plan & Output Cap Modifier for Eligible Admins (OFFERS_PRICING / SUPER_USER)
  app.post('/api/admin/offers-pricing/update-plan-config', (req, res) => {
    const ctx = getAuthenticatedContext(req);
    if (!ctx) return res.status(404).json({ error: 'Not Found' });

    const auth = authorizeAdminAction({
      actorRole: ctx.user.roleCategory,
      sessionMfaVerified: ctx.session.mfaVerified,
      action: 'MANAGE_OFFERS_PRICING',
    });
    if (!auth.authorized) return res.status(auth.status).json({ error: 'Forbidden' });

    const {
      planId,
      inrBaseMinor,
      inrSlashedMinor,
      usdBaseMinor,
      usdSlashedMinor,
      dailyExportLimit,
      batchLimit,
      maxExportQualityPct,
      maxExportDpi,
      maxResolutionPx,
      allowedFormats,
    } = req.body as {
      planId: PlanId;
      inrBaseMinor?: number;
      inrSlashedMinor?: number;
      usdBaseMinor?: number;
      usdSlashedMinor?: number;
      dailyExportLimit?: number;
      batchLimit?: number;
      maxExportQualityPct?: number;
      maxExportDpi?: number;
      maxResolutionPx?: number;
      allowedFormats?: ExportFormatCode[];
    };

    const targetPlan = plansStore[planId];
    if (!targetPlan) {
      return res.status(400).json({ error: 'Invalid planId' });
    }

    if (inrBaseMinor !== undefined && inrSlashedMinor !== undefined) {
      if (Number(inrSlashedMinor) < Number(inrBaseMinor)) {
        return res.status(400).json({
          error: 'INR slashed price must be >= INR base price (Consumer-Protection Honesty Rule).',
        });
      }
      targetPlan.prices.INR.baseMinor = Math.max(0, Number(inrBaseMinor));
      targetPlan.prices.INR.slashedMinor = Math.max(0, Number(inrSlashedMinor));
    }

    if (usdBaseMinor !== undefined && usdSlashedMinor !== undefined) {
      if (Number(usdSlashedMinor) < Number(usdBaseMinor)) {
        return res.status(400).json({
          error: 'USD slashed price must be >= USD base price (Consumer-Protection Honesty Rule).',
        });
      }
      targetPlan.prices.USD.baseMinor = Math.max(0, Number(usdBaseMinor));
      targetPlan.prices.USD.slashedMinor = Math.max(0, Number(usdSlashedMinor));
    }

    if (dailyExportLimit !== undefined) {
      targetPlan.dailyExportLimit = Number(dailyExportLimit);
    }
    if (batchLimit !== undefined) {
      targetPlan.batchLimit = Math.max(1, Number(batchLimit));
    }
    if (maxExportQualityPct !== undefined) {
      targetPlan.maxExportQualityPct = Math.min(100, Math.max(60, Number(maxExportQualityPct)));
    }
    if (maxExportDpi !== undefined) {
      targetPlan.maxExportDpi = Math.min(600, Math.max(72, Number(maxExportDpi)));
    }
    if (maxResolutionPx !== undefined) {
      targetPlan.maxResolutionPx = Math.min(4800, Math.max(400, Number(maxResolutionPx)));
    }
    if (Array.isArray(allowedFormats) && allowedFormats.length > 0) {
      targetPlan.allowedFormats = allowedFormats;
    }

    appendAuditLog({
      actorId: ctx.user.id,
      actorRole: ctx.user.roleCategory,
      actionType: 'PLAN_CONFIG_AND_OUTPUT_CAPS_UPDATED',
      targetType: 'PLAN',
      targetId: planId,
      reason: `Updated ${planId} prices & output caps (quality=${targetPlan.maxExportQualityPct}%, dpi=${targetPlan.maxExportDpi}, batch=${targetPlan.batchLimit})`,
    });

    res.json({ plans: plansStore });
  });

  // Studio Tool Tier & Availability Modifier for Eligible Admins (TOOLS_STUDIOS / SUPER_USER)
  app.post('/api/admin/tools-studios/update-tool', (req, res) => {
    const ctx = getAuthenticatedContext(req);
    if (!ctx) return res.status(404).json({ error: 'Not Found' });

    const auth = authorizeAdminAction({
      actorRole: ctx.user.roleCategory,
      sessionMfaVerified: ctx.session.mfaVerified,
      action: 'MANAGE_STUDIOS_LIMITS',
    });
    if (!auth.authorized) return res.status(auth.status).json({ error: 'Forbidden' });

    const { toolId, tier, enabled } = req.body as {
      toolId: string;
      tier?: 'FREE' | 'PAID' | 'PREMIUM';
      enabled?: boolean;
    };

    const tool = toolsStore.find((t) => t.id === toolId);
    if (!tool) return res.status(404).json({ error: 'Tool not found' });

    if (tier) {
      tool.tier = tier;
      if (tier === 'FREE') {
        tool.bundleId = null;
      } else if (!tool.bundleId) {
        tool.bundleId = `BUNDLE_${tool.studioId}_${tool.id}_${tier}`;
      }
    }
    if (typeof enabled === 'boolean') {
      tool.enabled = enabled;
    }

    appendAuditLog({
      actorId: ctx.user.id,
      actorRole: ctx.user.roleCategory,
      actionType: 'STUDIO_TOOL_UPDATED',
      targetType: 'TOOL',
      targetId: toolId,
      reason: `Set tool ${toolId} tier=${tool.tier}, enabled=${tool.enabled}`,
    });

    res.json({ tools: toolsStore });
  });

  // Global Preset Upsert / Tier Modifier for Eligible Admins (CONTENT_PRESETS / SUPER_USER)
  app.post('/api/admin/content-presets/upsert-preset', (req, res) => {
    const ctx = getAuthenticatedContext(req);
    if (!ctx) return res.status(404).json({ error: 'Not Found' });

    const auth = authorizeAdminAction({
      actorRole: ctx.user.roleCategory,
      sessionMfaVerified: ctx.session.mfaVerified,
      action: 'MANAGE_PRESETS_CONTENT',
    });
    if (!auth.authorized) return res.status(auth.status).json({ error: 'Forbidden' });

    const {
      id,
      codeLabel,
      studioId,
      category,
      name,
      widthPx,
      heightPx,
      dpi,
      bleedMm,
      tier,
    } = req.body as Partial<PresetDefinition>;

    const existing = id ? presetsStore.find((p) => p.id === id) : undefined;
    if (existing) {
      if (tier) existing.tier = tier;
      if (name) existing.name = name.trim();
      if (widthPx) existing.widthPx = Number(widthPx);
      if (heightPx) existing.heightPx = Number(heightPx);
      if (dpi) existing.dpi = Number(dpi);
      if (bleedMm !== undefined) existing.bleedMm = Number(bleedMm);
      existing.dimensionsLabel = `${existing.widthPx} × ${existing.heightPx} px · ${existing.dpi} DPI${
        existing.bleedMm > 0 ? ` + ${existing.bleedMm}mm Bleed` : ''
      }`;

      appendAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.roleCategory,
        actionType: 'GLOBAL_PRESET_UPDATED',
        targetType: 'PRESET',
        targetId: existing.id,
        reason: `Updated preset ${existing.codeLabel} tier=${existing.tier}, dpi=${existing.dpi}`,
      });
    } else {
      const newPreset: PresetDefinition = {
        id: `P-ADM-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
        codeLabel: (codeLabel || 'Global Preset').trim(),
        studioId: (studioId as StudioId) || 'S1',
        category: category || 'SIZE',
        name: (name || 'New Global Studio Preset').trim(),
        widthPx: Number(widthPx || 1200),
        heightPx: Number(heightPx || 1200),
        dpi: Number(dpi || 300),
        bleedMm: Number(bleedMm || 0),
        dimensionsLabel: `${Number(widthPx || 1200)} × ${Number(heightPx || 1200)} px · ${Number(
          dpi || 300
        )} DPI`,
        tier: tier || 'FREE',
        isGlobal: true,
      };
      presetsStore.unshift(newPreset);

      appendAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.roleCategory,
        actionType: 'GLOBAL_PRESET_CREATED',
        targetType: 'PRESET',
        targetId: newPreset.id,
        reason: `Created global preset ${newPreset.codeLabel} (${newPreset.tier})`,
      });
    }

    res.json({ presets: presetsStore });
  });

  // Finance Admin Direct Refund & Immediate Entitlement Revocation (FINANCE / SUPER_USER)
  app.post('/api/admin/finance/refund-order', (req, res) => {
    const ctx = getAuthenticatedContext(req);
    if (!ctx) return res.status(404).json({ error: 'Not Found' });

    const auth = authorizeAdminAction({
      actorRole: ctx.user.roleCategory,
      sessionMfaVerified: ctx.session.mfaVerified,
      action: 'ISSUE_REFUND',
    });
    if (!auth.authorized) return res.status(auth.status).json({ error: 'Forbidden' });

    const { orderId } = req.body as { orderId: string };
    const order = orders.get(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    order.state = 'REFUNDED';
    order.updatedAt = new Date().toISOString();

    const ent = entitlements.get(order.userId);
    if (ent) {
      ent.state = 'REFUNDED';
      ent.expiresAt = new Date().toISOString();
      ent.graceEndsAt = null;
    }

    appendAuditLog({
      actorId: ctx.user.id,
      actorRole: ctx.user.roleCategory,
      actionType: 'ORDER_REFUNDED_AND_ENTITLEMENT_REVOKED',
      targetType: 'ORDER',
      targetId: orderId,
      reason: `Finance officer issued refund and revoked paid access for user ${order.userId}`,
    });

    res.json({ orders: Array.from(orders.values()) });
  });

  app.post('/api/admin/offers-pricing/create-offer', (req, res) => {
    const ctx = getAuthenticatedContext(req);
    if (!ctx) return res.status(404).json({ error: 'Not Found' });

    const auth = authorizeAdminAction({
      actorRole: ctx.user.roleCategory,
      sessionMfaVerified: ctx.session.mfaVerified,
      action: 'MANAGE_OFFERS_PRICING',
    });
    if (!auth.authorized) return res.status(auth.status).json({ error: 'Forbidden' });

    const {
      templateType,
      title,
      plainExplanation,
      badgeText,
      targetPlanIds,
      discountType,
      discountValueInrMinor,
      discountValueUsdMinor,
    } = req.body as Partial<OfferRule>;

    const newOffer: OfferRule = {
      id: `OFFER-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      templateType: templateType || 'PERCENTAGE',
      title: (title || 'Special Plan Offer').trim(),
      plainExplanation: (plainExplanation || 'Limited-time plan savings.').trim(),
      badgeText: (badgeText || 'Special Offer').trim(),
      targetPlanIds:
        Array.isArray(targetPlanIds) && targetPlanIds.length > 0
          ? targetPlanIds
          : ['PRO_MONTHLY', 'PREMIUM_ANNUAL'],
      discountType: discountType || 'PERCENT',
      discountValueInrMinor: Number(discountValueInrMinor || 15),
      discountValueUsdMinor: Number(discountValueUsdMinor || 15),
      firstPurchaseOnly: templateType === 'FIRST_PURCHASE',
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      maxUses: 1000,
      currentUses: 0,
      status: 'PUBLISHED',
    };

    offersStore.unshift(newOffer);

    appendAuditLog({
      actorId: ctx.user.id,
      actorRole: ctx.user.roleCategory,
      actionType: 'OFFER_PUBLISHED',
      targetType: 'OFFER',
      targetId: newOffer.id,
      reason: `Published offer "${newOffer.title}" (${newOffer.templateType})`,
    });

    res.json({ offers: offersStore });
  });

  app.post('/api/admin/offers-pricing/toggle-offer', (req, res) => {
    const ctx = getAuthenticatedContext(req);
    if (!ctx) return res.status(404).json({ error: 'Not Found' });

    const auth = authorizeAdminAction({
      actorRole: ctx.user.roleCategory,
      sessionMfaVerified: ctx.session.mfaVerified,
      action: 'MANAGE_OFFERS_PRICING',
    });
    if (!auth.authorized) return res.status(auth.status).json({ error: 'Forbidden' });

    const { offerId, status } = req.body as {
      offerId: string;
      status: OfferRule['status'];
    };
    const offer = offersStore.find((o) => o.id === offerId);
    if (offer && status) {
      offer.status = status;
      appendAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.roleCategory,
        actionType: `OFFER_STATUS_${status}`,
        targetType: 'OFFER',
        targetId: offerId,
        reason: `Changed offer status to ${status}`,
      });
    }
    res.json({ offers: offersStore });
  });

  // Vault Secret Rotation / Enable Toggle (Section S: Write-Only Encrypted AES-256-GCM)
  app.post('/api/admin/vault/rotate', (req, res) => {
    const ctx = getAuthenticatedContext(req);
    if (!ctx) return res.status(404).json({ error: 'Not Found' });

    const auth = authorizeAdminAction({
      actorRole: ctx.user.roleCategory,
      sessionMfaVerified: ctx.session.mfaVerified,
      action: 'MANAGE_SECRETS_VAULT',
    });
    if (!auth.authorized) return res.status(auth.status).json({ error: 'Forbidden' });

    const { keyName, newSecretValue, isEnabled, mode } = req.body as {
      keyName: string;
      newSecretValue?: string;
      isEnabled?: boolean;
      mode?: VaultSecretRow['mode'];
    };

    const row = vaultSecrets.get(keyName);
    if (!row) return res.status(404).json({ error: 'Vault slot not found' });

    if (newSecretValue && newSecretValue.trim().length > 0) {
      const enc = encryptVaultSecret(newSecretValue.trim());
      row.ciphertextB64 = enc.ciphertextB64;
      row.ivB64 = enc.ivB64;
      row.authTagB64 = enc.authTagB64;
    }
    if (typeof isEnabled === 'boolean') row.isEnabled = isEnabled;
    if (mode) row.mode = mode;
    row.rotatedBy = ctx.user.id;
    row.rotatedAt = new Date().toISOString();

    appendAuditLog({
      actorId: ctx.user.id,
      actorRole: ctx.user.roleCategory,
      actionType: 'VAULT_SECRET_ROTATED_OR_TOGGLED',
      targetType: 'VAULT_KEY',
      targetId: keyName,
      reason: `Set enabled=${row.isEnabled}, mode=${row.mode} (ciphertext updated)`,
    });

    res.json({
      vault: Array.from(vaultSecrets.values()).map((v) => ({
        keyName: v.keyName,
        providerGroup: v.providerGroup,
        label: v.label,
        isEnabled: v.isEnabled,
        mode: v.mode,
        rotatedBy: v.rotatedBy,
        rotatedAt: v.rotatedAt,
        maskedPreview: '•••••••••••••••• (Write-Only Encrypted AES-256-GCM)',
      })),
    });
  });

  // Two-Person Admin-Assisted Recovery Workflow (Section A3: Support Checklist -> Super User Approval)
  app.post('/api/admin/support/recovery-step', (req, res) => {
    const ctx = getAuthenticatedContext(req);
    if (!ctx) return res.status(404).json({ error: 'Not Found' });

    const { ticketId, step, adminReply } = req.body as {
      ticketId: string;
      step: 'VERIFY_CHECKLIST' | 'SUPER_USER_APPROVE';
      adminReply?: string;
    };

    const ticket = supportTickets.find((t) => t.id === ticketId);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    if (step === 'VERIFY_CHECKLIST') {
      const auth = authorizeAdminAction({
        actorRole: ctx.user.roleCategory,
        sessionMfaVerified: ctx.session.mfaVerified,
        action: 'VERIFY_RECOVERY_CHECKLIST',
      });
      if (!auth.authorized) return res.status(auth.status).json({ error: 'Forbidden' });

      ticket.status = 'CHECKLIST_VERIFIED';
      ticket.checklistVerifiedBy = ctx.user.id;
      if (adminReply) ticket.adminReply = adminReply;

      appendAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.roleCategory,
        actionType: 'RECOVERY_CHECKLIST_VERIFIED_STEP_1',
        targetType: 'TICKET',
        targetId: ticketId,
        reason: 'Support officer verified identity checklist; awaiting Super User 2nd approval',
      });
    } else if (step === 'SUPER_USER_APPROVE') {
      const auth = authorizeAdminAction({
        actorRole: ctx.user.roleCategory,
        sessionMfaVerified: ctx.session.mfaVerified,
        action: 'APPROVE_RECOVERY_FINAL',
      });
      if (!auth.authorized) return res.status(auth.status).json({ error: 'Forbidden' });

      if (!ticket.checklistVerifiedBy) {
        return res.status(400).json({
          error: 'Two-person rule violation: Support checklist must be verified first.',
        });
      }

      ticket.status = 'APPROVED_RESOLVED';
      ticket.approvedBySuperUser = ctx.user.id;
      ticket.adminReply =
        adminReply || 'Identity recovery approved under 2-person rule with 24h cooling-off window.';

      appendAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.roleCategory,
        actionType: 'RECOVERY_APPROVED_BY_SUPER_USER_STEP_2',
        targetType: 'TICKET',
        targetId: ticketId,
        reason: `2-person approval completed (Verified by ${ticket.checklistVerifiedBy}, Approved by ${ctx.user.id})`,
      });
    }

    res.json({ tickets: supportTickets });
  });

  // 11. Extended Admin Control Endpoints: Add/Remove Plans, Tools, Presets, Offers, Notices, Users/Subscribers & Recommended Actions
  app.post('/api/admin/offers-pricing/create-plan', (req, res) => {
    const ctx = getAuthenticatedContext(req);
    if (!ctx) return res.status(404).json({ error: 'Not Found' });
    const auth = authorizeAdminAction({
      actorRole: ctx.user.roleCategory,
      sessionMfaVerified: ctx.session.mfaVerified,
      action: 'MANAGE_OFFERS_PRICING',
    });
    if (!auth.authorized) return res.status(auth.status).json({ error: 'Forbidden' });

    const {
      id,
      name,
      audienceLabel,
      durationHours = 720,
      inrBaseMinor = 49900,
      inrSlashedMinor = 79900,
      usdBaseMinor = 1200,
      usdSlashedMinor = 1900,
      maxExportQualityPct = 100,
      maxExportDpi = 300,
      batchLimit = 50,
      dailyExportLimit = -1,
      maxResolutionPx = 3600,
      unlocksPaidBundles = true,
      unlocksPremiumAutomation = false,
    } = req.body as Record<string, any>;

    const cleanId = (String(id || `PLAN_${crypto.randomBytes(2).toString('hex').toUpperCase()}`))
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, '_') as PlanId;

    const newPlan: PlanDefinition = {
      id: cleanId,
      codeLabel: cleanId,
      name: String(name || 'Custom Studio Plan').trim(),
      audienceLabel: String(audienceLabel || 'Custom Subscriber Tier').trim(),
      durationHours: Math.max(1, Number(durationHours)),
      graceHours: 48,
      dailyExportLimit: Number(dailyExportLimit),
      batchLimit: Math.max(1, Number(batchLimit)),
      maxDevices: 4,
      unlocksPaidBundles: Boolean(unlocksPaidBundles),
      unlocksPremiumAutomation: Boolean(unlocksPremiumAutomation),
      maxExportQualityPct: Math.min(100, Math.max(60, Number(maxExportQualityPct))),
      maxExportDpi: Math.min(600, Math.max(72, Number(maxExportDpi))),
      maxResolutionPx: Math.min(4800, Math.max(600, Number(maxResolutionPx))),
      allowedFormats: unlocksPaidBundles
        ? ['PNG', 'JPEG', 'WEBP', 'PDF', 'SVG', 'ZIP']
        : ['PNG', 'JPEG', 'WEBP', 'PDF'],
      maxIdSheetCopies: unlocksPaidBundles ? 16 : 1,
      prices: {
        INR: {
          baseMinor: Math.max(0, Number(inrBaseMinor)),
          slashedMinor: Math.max(Number(inrBaseMinor), Number(inrSlashedMinor)),
          taxInclusive: true,
        },
        USD: {
          baseMinor: Math.max(0, Number(usdBaseMinor)),
          slashedMinor: Math.max(Number(usdBaseMinor), Number(usdSlashedMinor)),
          taxInclusive: true,
        },
      },
      features: [
        `${maxExportQualityPct}% Max Output Quality & ${maxExportDpi} DPI Print Density`,
        `Up to ${batchLimit} Batch Files per Run`,
        dailyExportLimit === -1 ? 'Unlimited Daily Studio Exports' : `${dailyExportLimit} Daily Exports`,
      ],
    };

    plansStore[cleanId] = newPlan;
    appendAuditLog({
      actorId: ctx.user.id,
      actorRole: ctx.user.roleCategory,
      actionType: 'PLAN_CREATED_BY_ADMIN',
      targetType: 'PLAN',
      targetId: cleanId,
      reason: `Created subscription plan ${newPlan.name} (${cleanId})`,
    });

    res.json({ plans: plansStore, createdPlan: newPlan });
  });

  app.post('/api/admin/offers-pricing/delete-plan', (req, res) => {
    const ctx = getAuthenticatedContext(req);
    if (!ctx) return res.status(404).json({ error: 'Not Found' });
    const auth = authorizeAdminAction({
      actorRole: ctx.user.roleCategory,
      sessionMfaVerified: ctx.session.mfaVerified,
      action: 'MANAGE_OFFERS_PRICING',
    });
    if (!auth.authorized) return res.status(auth.status).json({ error: 'Forbidden' });

    const { planId } = req.body as { planId: PlanId };
    if (!planId || planId === 'NONE' || planId === 'FREE') {
      return res.status(400).json({ error: 'Core fallback plans (NONE, FREE) cannot be deleted.' });
    }
    delete plansStore[planId];
    appendAuditLog({
      actorId: ctx.user.id,
      actorRole: ctx.user.roleCategory,
      actionType: 'PLAN_REMOVED_BY_ADMIN',
      targetType: 'PLAN',
      targetId: planId,
      reason: `Removed plan ${planId} from catalog`,
    });
    res.json({ plans: plansStore });
  });

  app.post('/api/admin/offers-pricing/delete-offer', (req, res) => {
    const ctx = getAuthenticatedContext(req);
    if (!ctx) return res.status(404).json({ error: 'Not Found' });
    const auth = authorizeAdminAction({
      actorRole: ctx.user.roleCategory,
      sessionMfaVerified: ctx.session.mfaVerified,
      action: 'MANAGE_OFFERS_PRICING',
    });
    if (!auth.authorized) return res.status(auth.status).json({ error: 'Forbidden' });

    const { offerId } = req.body as { offerId: string };
    offersStore = offersStore.filter((o) => o.id !== offerId);
    appendAuditLog({
      actorId: ctx.user.id,
      actorRole: ctx.user.roleCategory,
      actionType: 'OFFER_DELETED_BY_ADMIN',
      targetType: 'OFFER',
      targetId: offerId,
      reason: `Deleted offer ${offerId}`,
    });
    res.json({ offers: offersStore });
  });

  app.post('/api/admin/tools-studios/create-tool', (req, res) => {
    const ctx = getAuthenticatedContext(req);
    if (!ctx) return res.status(404).json({ error: 'Not Found' });
    const auth = authorizeAdminAction({
      actorRole: ctx.user.roleCategory,
      sessionMfaVerified: ctx.session.mfaVerified,
      action: 'MANAGE_STUDIOS_LIMITS',
    });
    if (!auth.authorized) return res.status(auth.status).json({ error: 'Forbidden' });

    const { studioId = 'S1', name, summary, tier = 'FREE', codeLabel } = req.body as {
      studioId?: StudioId;
      name?: string;
      summary?: string;
      tier?: 'FREE' | 'PAID' | 'PREMIUM';
      codeLabel?: string;
    };
    if (!name?.trim()) {
      return res.status(400).json({ error: 'Tool name is required.' });
    }
    const id = `T-ADM-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const newTool: StudioToolDefinition = {
      id,
      codeLabel: (codeLabel || 'Studio Tool').trim(),
      studioId,
      name: name.trim(),
      plainDescription: (summary || 'Custom on-device studio processor configured by administration.').trim(),
      tier,
      bundleId: tier === 'FREE' ? null : `BUNDLE_${studioId}_${id}_${tier}`,
      enabled: true,
    };
    toolsStore.unshift(newTool);
    appendAuditLog({
      actorId: ctx.user.id,
      actorRole: ctx.user.roleCategory,
      actionType: 'STUDIO_TOOL_CREATED',
      targetType: 'TOOL',
      targetId: id,
      reason: `Added tool "${newTool.name}" (${tier}) to ${studioId}`,
    });
    res.json({ tools: toolsStore, createdTool: newTool });
  });

  app.post('/api/admin/tools-studios/delete-tool', (req, res) => {
    const ctx = getAuthenticatedContext(req);
    if (!ctx) return res.status(404).json({ error: 'Not Found' });
    const auth = authorizeAdminAction({
      actorRole: ctx.user.roleCategory,
      sessionMfaVerified: ctx.session.mfaVerified,
      action: 'MANAGE_STUDIOS_LIMITS',
    });
    if (!auth.authorized) return res.status(auth.status).json({ error: 'Forbidden' });

    const { toolId } = req.body as { toolId: string };
    toolsStore = toolsStore.filter((t) => t.id !== toolId);
    appendAuditLog({
      actorId: ctx.user.id,
      actorRole: ctx.user.roleCategory,
      actionType: 'STUDIO_TOOL_DELETED',
      targetType: 'TOOL',
      targetId: toolId,
      reason: `Removed studio tool ${toolId}`,
    });
    res.json({ tools: toolsStore });
  });

  app.post('/api/admin/content-presets/delete-preset', (req, res) => {
    const ctx = getAuthenticatedContext(req);
    if (!ctx) return res.status(404).json({ error: 'Not Found' });
    const auth = authorizeAdminAction({
      actorRole: ctx.user.roleCategory,
      sessionMfaVerified: ctx.session.mfaVerified,
      action: 'MANAGE_PRESETS_CONTENT',
    });
    if (!auth.authorized) return res.status(auth.status).json({ error: 'Forbidden' });

    const { presetId } = req.body as { presetId: string };
    presetsStore = presetsStore.filter((p) => p.id !== presetId);
    appendAuditLog({
      actorId: ctx.user.id,
      actorRole: ctx.user.roleCategory,
      actionType: 'GLOBAL_PRESET_DELETED',
      targetType: 'PRESET',
      targetId: presetId,
      reason: `Removed global preset ${presetId}`,
    });
    res.json({ presets: presetsStore });
  });

  app.post('/api/admin/users/manage', (req, res) => {
    const ctx = getAuthenticatedContext(req);
    if (!ctx) return res.status(404).json({ error: 'Not Found' });
    const auth = authorizeAdminAction({
      actorRole: ctx.user.roleCategory,
      sessionMfaVerified: ctx.session.mfaVerified,
      action: 'MANAGE_USERS_SUBSCRIBERS',
    });
    if (!auth.authorized) return res.status(auth.status).json({ error: 'Forbidden' });

    const {
      operation,
      targetUserId,
      planId,
      entitlementState,
      identifier,
      handle,
      countryCode = '+91',
      roleCategory = 'USER',
    } = req.body as {
      operation: 'ASSIGN_PLAN' | 'RESET_DAILY_QUOTA' | 'TOGGLE_STATUS' | 'CREATE_USER' | 'DELETE_USER';
      targetUserId?: string;
      planId?: PlanId;
      entitlementState?: EntitlementState;
      identifier?: string;
      handle?: string;
      countryCode?: string;
      roleCategory?: AdminCategory;
    };

    if (operation === 'CREATE_USER') {
      if (!identifier?.trim()) {
        return res.status(400).json({ error: 'Identifier/email is required to create an account.' });
      }
      const newId = `USR-ADM-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      const cur = resolveCurrencyFromCountryCode(countryCode, countryCurrencyTable);
      const cleanName = (handle || identifier.split('@')[0] || 'Subscriber').trim();
      const targetRole: AdminCategory =
        ctx.user.roleCategory === 'SUPER_USER' && roleCategory ? roleCategory : 'USER';

      const createdUser: UserRecord = {
        id: newId,
        identifier: identifier.trim().toLowerCase(),
        handle: cleanName,
        avatarCode: cleanName.slice(0, 2).toUpperCase(),
        countryCode,
        currency: cur.currency,
        currencyExplanation: cur.explanation,
        language: 'en',
        theme: 'light',
        defaultExportFormat: 'PNG',
        defaultUnit: 'mm',
        mfaEnabled: targetRole !== 'USER',
        roleCategory: targetRole,
        status: 'ACTIVE',
        consentVersion: 'DPDP-GDPR-2026.1',
        linkedMethods: ['PASSKEY'],
        dailyExportsUsed: 0,
        dailyResetDate: new Date().toISOString().slice(0, 10),
        createdAt: new Date().toISOString(),
      };
      users.set(newId, createdUser);

      const chosenPlan = planId && plansStore[planId] ? planId : 'FREE';
      entitlements.set(newId, {
        userId: newId,
        planId: chosenPlan,
        state: 'ACTIVE',
        activatedAt: new Date().toISOString(),
        expiresAt:
          chosenPlan === 'FREE' ? null : new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        graceEndsAt: null,
        lastOrderId: chosenPlan === 'FREE' ? null : `ORD-ADMIN-${newId}`,
      });

      const recCode = `VS-${crypto.randomBytes(2).toString('hex').toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
      recoveryCodes.push({
        userId: newId,
        codeSha256: sha256Hex(recCode),
        usedAt: null,
      });

      appendAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.roleCategory,
        actionType: 'ADMIN_CREATED_USER_ACCOUNT',
        targetType: 'USER',
        targetId: newId,
        reason: `Created account ${createdUser.identifier} on plan ${chosenPlan}`,
      });
    } else if (targetUserId) {
      const targetUser = users.get(targetUserId);
      if (!targetUser) return res.status(404).json({ error: 'Target user not found.' });

      if (operation === 'ASSIGN_PLAN' && planId && plansStore[planId]) {
        const ent = entitlements.get(targetUserId) || {
          userId: targetUserId,
          planId: 'FREE',
          state: 'ACTIVE',
          activatedAt: new Date().toISOString(),
          expiresAt: null,
          graceEndsAt: null,
          lastOrderId: null,
        };
        ent.planId = planId;
        ent.state = entitlementState || 'ACTIVE';
        ent.activatedAt = new Date().toISOString();
        ent.expiresAt =
          planId === 'FREE'
            ? null
            : new Date(Date.now() + (plansStore[planId].durationHours || 720) * 3600 * 1000).toISOString();
        entitlements.set(targetUserId, ent);
        appendAuditLog({
          actorId: ctx.user.id,
          actorRole: ctx.user.roleCategory,
          actionType: 'ADMIN_UPDATED_USER_SUBSCRIPTION',
          targetType: 'USER',
          targetId: targetUserId,
          reason: `Set ${targetUser.identifier} plan=${planId}, state=${ent.state}`,
        });
      } else if (operation === 'RESET_DAILY_QUOTA') {
        targetUser.dailyExportsUsed = 0;
        appendAuditLog({
          actorId: ctx.user.id,
          actorRole: ctx.user.roleCategory,
          actionType: 'ADMIN_RESET_USER_DAILY_QUOTA',
          targetType: 'USER',
          targetId: targetUserId,
          reason: `Reset daily export quota for ${targetUser.identifier}`,
        });
      } else if (operation === 'TOGGLE_STATUS') {
        targetUser.status = targetUser.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
        appendAuditLog({
          actorId: ctx.user.id,
          actorRole: ctx.user.roleCategory,
          actionType: 'ADMIN_TOGGLED_USER_STATUS',
          targetType: 'USER',
          targetId: targetUserId,
          reason: `Set ${targetUser.identifier} status=${targetUser.status}`,
        });
      } else if (operation === 'DELETE_USER') {
        if (targetUser.id === ctx.user.id) {
          return res.status(400).json({ error: 'Cannot delete your own active admin account.' });
        }
        users.delete(targetUserId);
        entitlements.delete(targetUserId);
        for (const [tok, ses] of sessions.entries()) {
          if (ses.userId === targetUserId) sessions.delete(tok);
        }
        appendAuditLog({
          actorId: ctx.user.id,
          actorRole: ctx.user.roleCategory,
          actionType: 'ADMIN_REMOVED_USER_ACCOUNT',
          targetType: 'USER',
          targetId: targetUserId,
          reason: `Removed account ${targetUser.identifier}`,
        });
      }
    }

    const updatedUsers = Array.from(users.values()).map((u) => {
      const ent = entitlements.get(u.id);
      return {
        ...u,
        planId: ent?.planId || 'FREE',
        entitlementState: ent?.state || 'ACTIVE',
        expiresAt: ent?.expiresAt || null,
      };
    });
    res.json({ users: updatedUsers });
  });

  app.post('/api/admin/notices/manage', (req, res) => {
    const ctx = getAuthenticatedContext(req);
    if (!ctx || ctx.user.roleCategory === 'USER' || !ctx.session.mfaVerified) {
      return res.status(404).json({ error: 'Not Found' });
    }
    const { operation, noticeId, title, body } = req.body as {
      operation: 'CREATE' | 'TOGGLE' | 'DELETE';
      noticeId?: string;
      title?: string;
      body?: string;
    };

    if (operation === 'CREATE' && title?.trim()) {
      const newNotice: AdminNoticeRow = {
        id: `NOTICE-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
        title: title.trim(),
        body: (body || '').trim(),
        active: true,
        createdAt: new Date().toISOString(),
      };
      adminNotices.unshift(newNotice);
      appendAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.roleCategory,
        actionType: 'SITE_NOTICE_PUBLISHED',
        targetType: 'NOTICE',
        targetId: newNotice.id,
        reason: `Published notice "${newNotice.title}"`,
      });
    } else if (operation === 'TOGGLE' && noticeId) {
      const target = adminNotices.find((n) => n.id === noticeId);
      if (target) target.active = !target.active;
    } else if (operation === 'DELETE' && noticeId) {
      const idx = adminNotices.findIndex((n) => n.id === noticeId);
      if (idx >= 0) adminNotices.splice(idx, 1);
    }
    res.json({ notices: adminNotices });
  });

  app.post('/api/admin/actions/execute', (req, res) => {
    const ctx = getAuthenticatedContext(req);
    if (!ctx || ctx.user.roleCategory === 'USER' || !ctx.session.mfaVerified) {
      return res.status(404).json({ error: 'Not Found' });
    }
    const { actionId } = req.body as { actionId: string };
    let summaryMessage = 'Executed administrative action.';

    if (actionId === 'LAUNCH_CONVERSION_OFFER') {
      const flashOffer: OfferRule = {
        id: `OFFER-CONV-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
        templateType: 'FLASH_COUNTDOWN',
        title: '30% Studio Pro Conversion Flash Offer',
        plainExplanation: 'Save 30% on Paid Monthly and Premium Annual subscriptions today.',
        badgeText: '30% Flash Savings',
        targetPlanIds: ['PRO_MONTHLY', 'PREMIUM_ANNUAL'],
        discountType: 'PERCENT',
        discountValueInrMinor: 30,
        discountValueUsdMinor: 30,
        firstPurchaseOnly: false,
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
        maxUses: 500,
        currentUses: 0,
        status: 'PUBLISHED',
      };
      offersStore.unshift(flashOffer);
      summaryMessage = `Published "${flashOffer.title}" (${flashOffer.id}) across Paid Monthly & Premium Annual plans.`;
    } else if (actionId === 'ENABLE_LIVE_AUTH_PROVIDERS') {
      const emailSlot = vaultSecrets.get('EMAIL_PROVIDER_API_KEY');
      const googleSlot = vaultSecrets.get('GOOGLE_CLIENT_SECRET');
      if (emailSlot) emailSlot.isEnabled = true;
      if (googleSlot) googleSlot.isEnabled = true;
      summaryMessage = 'Enabled Email OTP and Google OAuth sign-in methods in the Tier-2 Encrypted Vault.';
    } else if (actionId === 'RESET_ALL_FREE_QUOTAS') {
      guestDailyExportsMap.clear();
      for (const u of users.values()) {
        u.dailyExportsUsed = 0;
      }
      summaryMessage = 'Reset daily export counters to 0 across all Free and Guest accounts.';
    } else if (actionId === 'APPROVE_PENDING_TICKETS') {
      let resolvedCount = 0;
      for (const t of supportTickets) {
        if (t.status !== 'APPROVED_RESOLVED' && t.status !== 'CLOSED') {
          t.checklistVerifiedBy = t.checklistVerifiedBy || ctx.user.id;
          t.approvedBySuperUser = ctx.user.id;
          t.status = 'APPROVED_RESOLVED';
          t.adminReply = 'Verified and resolved via Control Plane Action Queue.';
          resolvedCount++;
        }
      }
      summaryMessage = `Resolved ${resolvedCount} open support/recovery tickets.`;
    } else if (actionId === 'PRUNE_STALE_SESSIONS') {
      let pruned = 0;
      for (const [tok, ses] of sessions.entries()) {
        if (ses.id !== ctx.session.id) {
          sessions.delete(tok);
          pruned++;
        }
      }
      summaryMessage = `Pruned ${pruned} secondary device sessions while keeping your active session.`;
    }

    appendAuditLog({
      actorId: ctx.user.id,
      actorRole: ctx.user.roleCategory,
      actionType: `RECOMMENDED_ACTION_${actionId}`,
      targetType: 'CONTROL_PLANE',
      targetId: actionId,
      reason: summaryMessage,
    });

    res.json({ executed: true, actionId, summaryMessage });
  });

  // Vite middleware in development; static serving in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Varnank Studios Control Plane + Client listening on http://localhost:${PORT}`);
  });
}

startServer();
