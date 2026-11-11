import React, { useState, useEffect } from 'react';
import {
  ADMIN_PORTAL_SLUGS,
  AdminCategory,
  OfferTemplateType,
  PlanId,
  StudioId,
  formatMinorCurrency,
} from '../core/engine';

interface HiddenAdminConsoleProps {
  portalSlug: string;
  initialAdminToken?: string | null;
  onExitPortal: () => void;
  onSwitchPortalSlug: (nextSlug: string) => void;
  onCatalogUpdated: () => Promise<void>;
}

type ConsoleTab =
  | 'OVERVIEW'
  | 'PLANS_OFFERS'
  | 'TOOLS_PRESETS'
  | 'USERS_SUBSCRIBERS'
  | 'OPERATIONS_SECURITY';

export const HiddenAdminConsole: React.FC<HiddenAdminConsoleProps> = ({
  portalSlug,
  initialAdminToken,
  onExitPortal,
  onSwitchPortalSlug,
  onCatalogUpdated,
}) => {
  const [adminToken, setAdminToken] = useState<string | null>(initialAdminToken || null);
  const [activeTab, setActiveTab] = useState<ConsoleTab>('OVERVIEW');
  const [selectedLoginRole, setSelectedLoginRole] = useState<string>('AUTO');
  const [loginMode, setLoginMode] = useState<'SIGN_IN' | 'ACCOUNT_RESET'>('SIGN_IN');
  const [adminIdentifier, setAdminIdentifier] = useState<string>('');
  const [passkeyCred, setPasskeyCred] = useState<string>('');
  const [recoveryCodeInput, setRecoveryCodeInput] = useState<string>('');
  const [adminNewPassword, setAdminNewPassword] = useState<string>('');
  const [mustRotateOnFirstLogin, setMustRotateOnFirstLogin] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [consoleData, setConsoleData] = useState<Record<string, any> | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  // Admin Credential Rotation state
  const [rotateTargetCategory, setRotateTargetCategory] = useState<AdminCategory>('SUPER_USER');
  const [newPasskeyToken, setNewPasskeyToken] = useState<string>('');
  const [newTotpPin, setNewTotpPin] = useState<string>('');
  const [freshRecoveryCodeOnce, setFreshRecoveryCodeOnce] = useState<string | null>(null);

  // Offer Builder state
  const [offerTemplate, setOfferTemplate] = useState<OfferTemplateType>('PERCENTAGE');
  const [offerTitle, setOfferTitle] = useState<string>('Seasonal Studio Offer');
  const [offerExplanation, setOfferExplanation] = useState<string>(
    'Save 25% on Paid Monthly and Premium Annual plans.'
  );
  const [offerBadge, setOfferBadge] = useState<string>('Seasonal savings');
  const [offerInrValue, setOfferInrValue] = useState<number>(25);
  const [offerUsdValue, setOfferUsdValue] = useState<number>(25);

  // Plan Price & Output Cap Editor state
  const [editingPlanId, setEditingPlanId] = useState<PlanId>('PRO_MONTHLY');
  const [editInrBaseMinor, setEditInrBaseMinor] = useState<number>(39900);
  const [editInrSlashedMinor, setEditInrSlashedMinor] = useState<number>(69900);
  const [editUsdBaseMinor, setEditUsdBaseMinor] = useState<number>(900);
  const [editUsdSlashedMinor, setEditUsdSlashedMinor] = useState<number>(1500);
  const [editQualityCap, setEditQualityCap] = useState<number>(100);
  const [editDpiCap, setEditDpiCap] = useState<number>(300);
  const [editBatchCap, setEditBatchCap] = useState<number>(50);
  const [editDailyQuota, setEditDailyQuota] = useState<number>(-1);
  const [editMaxResPx, setEditMaxResPx] = useState<number>(3600);

  // Create New Plan state
  const [newPlanCode, setNewPlanCode] = useState<string>('');
  const [newPlanName, setNewPlanName] = useState<string>('');
  const [newPlanInrMinor, setNewPlanInrMinor] = useState<number>(59900);
  const [newPlanUsdMinor, setNewPlanUsdMinor] = useState<number>(1400);
  const [newPlanDpi, setNewPlanDpi] = useState<number>(300);
  const [newPlanBatch, setNewPlanBatch] = useState<number>(50);

  // Create New Studio Tool state
  const [newToolStudioId, setNewToolStudioId] = useState<StudioId>('S1');
  const [newToolTier, setNewToolTier] = useState<'FREE' | 'PAID' | 'PREMIUM'>('PAID');
  const [newToolName, setNewToolName] = useState<string>('');
  const [newToolSummary, setNewToolSummary] = useState<string>('');

  // Global Preset Creator state
  const [newPresetStudioId, setNewPresetStudioId] = useState<StudioId>('S1');
  const [newPresetCategory, setNewPresetCategory] = useState<'SIZE' | 'TEMPLATE' | 'EXPORT_PROFILE'>('SIZE');
  const [newPresetTier, setNewPresetTier] = useState<'FREE' | 'PAID'>('FREE');
  const [newPresetName, setNewPresetName] = useState<string>('');
  const [newPresetWidthPx, setNewPresetWidthPx] = useState<number>(1200);
  const [newPresetHeightPx, setNewPresetHeightPx] = useState<number>(1200);
  const [newPresetDpi, setNewPresetDpi] = useState<number>(300);

  // Create New User / Subscriber state
  const [newUserEmail, setNewUserEmail] = useState<string>('');
  const [newUserHandle, setNewUserHandle] = useState<string>('');
  const [newUserCountry, setNewUserCountry] = useState<string>('+91');
  const [newUserPlan, setNewUserPlan] = useState<PlanId>('PRO_MONTHLY');
  const [userFilterRole, setUserFilterRole] = useState<'ALL' | 'SUBSCRIBERS' | 'FREE' | 'STAFF'>('ALL');

  // Site Notice Creator state
  const [newNoticeTitle, setNewNoticeTitle] = useState<string>('');
  const [newNoticeBody, setNewNoticeBody] = useState<string>('');

  // Vault Rotation state
  const [newVaultSecretValue, setNewVaultSecretValue] = useState<string>('');
  const [vaultMode] = useState<'MOCK' | 'TEST' | 'LIVE'>('TEST');

  const isKnownPortalSlug =
    !portalSlug ||
    portalSlug === 'admin' ||
    Object.values(ADMIN_PORTAL_SLUGS).includes(portalSlug) ||
    Object.keys(ADMIN_PORTAL_SLUGS).includes(portalSlug);

  const syncSelectedPlanEditor = (plansObj: Record<string, any>, targetPlanId: PlanId) => {
    const plan = plansObj?.[targetPlanId];
    if (!plan) return;
    setEditInrBaseMinor(plan.prices?.INR?.baseMinor ?? 39900);
    setEditInrSlashedMinor(plan.prices?.INR?.slashedMinor ?? 69900);
    setEditUsdBaseMinor(plan.prices?.USD?.baseMinor ?? 900);
    setEditUsdSlashedMinor(plan.prices?.USD?.slashedMinor ?? 1500);
    setEditQualityCap(plan.maxExportQualityPct ?? 100);
    setEditDpiCap(plan.maxExportDpi ?? 300);
    setEditBatchCap(plan.batchLimit ?? 50);
    setEditDailyQuota(plan.dailyExportLimit ?? -1);
    setEditMaxResPx(plan.maxResolutionPx ?? 3600);
  };

  const loadConsoleData = async (token: string, slug: string) => {
    const targetSlug = slug || 'admin';
    const resp = await fetch(`/api/admin/console-data/${targetSlug}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) {
      setConsoleData(null);
      return;
    }
    const data = await resp.json();
    setConsoleData(data);
    if (data.roleCategory) {
      setRotateTargetCategory(data.roleCategory as AdminCategory);
    }
    if (data.offersPricing?.plans) {
      syncSelectedPlanEditor(data.offersPricing.plans, editingPlanId);
    }
  };

  useEffect(() => {
    if (initialAdminToken) {
      setAdminToken(initialAdminToken);
      loadConsoleData(initialAdminToken, portalSlug || 'admin');
    }
  }, [initialAdminToken]);

  useEffect(() => {
    if (adminToken && isKnownPortalSlug) {
      loadConsoleData(adminToken, portalSlug || 'admin');
    }
  }, [portalSlug]);

  const handleRequestAdminResetCode = async () => {
    setAuthError(null);
    const targetEmail = adminIdentifier.trim();
    if (!targetEmail) {
      setAuthError('Please enter your email address or username first.');
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
        setAuthError(data.error || 'Could not request verification code.');
        return;
      }
      if (data.verificationCode) {
        setRecoveryCodeInput(data.verificationCode);
      }
    } catch {
      setAuthError('Unable to request verification code.');
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const resp = await fetch('/api/admin/authenticate-portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        portalSlug: portalSlug || 'admin',
        identifier: adminIdentifier.trim() || undefined,
        roleCategory: selectedLoginRole === 'AUTO' ? undefined : selectedLoginRole,
        password: loginMode === 'SIGN_IN' ? passkeyCred.trim() : undefined,
        passkeyCredential: loginMode === 'SIGN_IN' ? passkeyCred.trim() : undefined,
        recoveryCode: loginMode === 'ACCOUNT_RESET' ? recoveryCodeInput.trim() : undefined,
        newPassword: adminNewPassword.trim() || undefined,
      }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      setAuthError(data.error || 'Authentication failed — Please verify your credentials.');
      return;
    }
    setAdminToken(data.adminSessionToken);
    setMustRotateOnFirstLogin(Boolean(data.mustRotateOnFirstLogin));
    await loadConsoleData(data.adminSessionToken, 'admin');
  };

  const handleExecuteRecommendedAction = async (actionId: string) => {
    if (!adminToken) return;
    const resp = await fetch('/api/admin/actions/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ actionId }),
    });
    const data = await resp.json();
    if (resp.ok) {
      await loadConsoleData(adminToken, 'admin');
      await onCatalogUpdated();
      setStatusNote(data.summaryMessage || `Executed action ${actionId}.`);
    }
  };

  const handleRotateAdminCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    setFreshRecoveryCodeOnce(null);
    const resp = await fetch('/api/admin/rotate-credential', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        targetRoleCategory: rotateTargetCategory,
        newPasskeyToken: newPasskeyToken.trim(),
        newTotpPin: newTotpPin.trim(),
      }),
    });
    const data = await resp.json();
    if (resp.ok) {
      setMustRotateOnFirstLogin(false);
      setNewPasskeyToken('');
      setNewTotpPin('');
      setFreshRecoveryCodeOnce(data.oneTimeNewRecoveryCode);
      setStatusNote(
        `Rotated Passkey + 6-digit MFA for ${data.rotatedCategory}. Save your new single-use recovery code shown below.`
      );
    } else {
      setStatusNote(data.error || 'Failed to rotate credential.');
    }
  };

  const handleUpdatePlanConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    const resp = await fetch('/api/admin/offers-pricing/update-plan-config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        planId: editingPlanId,
        inrBaseMinor: editInrBaseMinor,
        inrSlashedMinor: Math.max(editInrSlashedMinor, editInrBaseMinor),
        usdBaseMinor: editUsdBaseMinor,
        usdSlashedMinor: Math.max(editUsdSlashedMinor, editUsdBaseMinor),
        maxExportQualityPct: editQualityCap,
        maxExportDpi: editDpiCap,
        batchLimit: editBatchCap,
        dailyExportLimit: editDailyQuota,
        maxResolutionPx: editMaxResPx,
      }),
    });
    const data = await resp.json();
    if (resp.ok) {
      await loadConsoleData(adminToken, 'admin');
      await onCatalogUpdated();
      setStatusNote(
        `Updated plan ${editingPlanId} pricing & output caps (Quality ${editQualityCap}%, ${editDpiCap} DPI, Batch ${editBatchCap}).`
      );
    } else {
      setStatusNote(data.error || 'Failed to update plan configuration.');
    }
  };

  const handleCreateNewPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken || !newPlanName.trim()) return;
    const resp = await fetch('/api/admin/offers-pricing/create-plan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        id: newPlanCode.trim() || undefined,
        name: newPlanName.trim(),
        inrBaseMinor: newPlanInrMinor,
        inrSlashedMinor: Math.round(newPlanInrMinor * 1.4),
        usdBaseMinor: newPlanUsdMinor,
        usdSlashedMinor: Math.round(newPlanUsdMinor * 1.4),
        maxExportDpi: newPlanDpi,
        batchLimit: newPlanBatch,
      }),
    });
    const data = await resp.json();
    if (resp.ok) {
      setNewPlanCode('');
      setNewPlanName('');
      await loadConsoleData(adminToken, 'admin');
      await onCatalogUpdated();
      setStatusNote(`Added new subscription plan "${data.createdPlan?.name}" (${data.createdPlan?.id}).`);
    } else {
      setStatusNote(data.error || 'Could not create plan.');
    }
  };

  const handleDeletePlan = async (planId: string) => {
    if (!adminToken) return;
    const resp = await fetch('/api/admin/offers-pricing/delete-plan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ planId }),
    });
    const data = await resp.json();
    if (resp.ok) {
      await loadConsoleData(adminToken, 'admin');
      await onCatalogUpdated();
      setStatusNote(`Removed plan ${planId} from catalog.`);
    } else {
      setStatusNote(data.error || 'Could not remove plan.');
    }
  };

  const handlePublishOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
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
      await loadConsoleData(adminToken, 'admin');
      await onCatalogUpdated();
      setStatusNote(`Published offer "${offerTitle}".`);
    }
  };

  const handleToggleOfferStatus = async (offerId: string, nextStatus: 'PUBLISHED' | 'PAUSED') => {
    if (!adminToken) return;
    const resp = await fetch('/api/admin/offers-pricing/toggle-offer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ offerId, status: nextStatus }),
    });
    if (resp.ok) {
      await loadConsoleData(adminToken, 'admin');
      await onCatalogUpdated();
      setStatusNote(`Updated offer ${offerId} status to ${nextStatus}.`);
    }
  };

  const handleDeleteOffer = async (offerId: string) => {
    if (!adminToken) return;
    const resp = await fetch('/api/admin/offers-pricing/delete-offer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ offerId }),
    });
    if (resp.ok) {
      await loadConsoleData(adminToken, 'admin');
      await onCatalogUpdated();
      setStatusNote(`Deleted offer ${offerId}.`);
    }
  };

  const handleCreateTool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken || !newToolName.trim()) return;
    const resp = await fetch('/api/admin/tools-studios/create-tool', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        studioId: newToolStudioId,
        tier: newToolTier,
        name: newToolName.trim(),
        summary: newToolSummary.trim() || 'On-device studio processing tool.',
      }),
    });
    if (resp.ok) {
      setNewToolName('');
      setNewToolSummary('');
      await loadConsoleData(adminToken, 'admin');
      await onCatalogUpdated();
      setStatusNote(`Added new studio tool "${newToolName.trim()}" (${newToolTier}).`);
    }
  };

  const handleUpdateStudioTool = async (
    toolId: string,
    tier: 'FREE' | 'PAID' | 'PREMIUM',
    enabled: boolean
  ) => {
    if (!adminToken) return;
    const resp = await fetch('/api/admin/tools-studios/update-tool', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ toolId, tier, enabled }),
    });
    if (resp.ok) {
      await loadConsoleData(adminToken, 'admin');
      await onCatalogUpdated();
      setStatusNote(`Updated tool ${toolId}: Tier=${tier}, Enabled=${enabled}.`);
    }
  };

  const handleDeleteStudioTool = async (toolId: string) => {
    if (!adminToken) return;
    const resp = await fetch('/api/admin/tools-studios/delete-tool', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ toolId }),
    });
    if (resp.ok) {
      await loadConsoleData(adminToken, 'admin');
      await onCatalogUpdated();
      setStatusNote(`Removed studio tool ${toolId}.`);
    }
  };

  const handleUpsertGlobalPreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken || !newPresetName.trim()) return;
    const resp = await fetch('/api/admin/content-presets/upsert-preset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        studioId: newPresetStudioId,
        category: newPresetCategory,
        tier: newPresetTier,
        name: newPresetName.trim(),
        widthPx: newPresetWidthPx,
        heightPx: newPresetHeightPx,
        dpi: newPresetDpi,
      }),
    });
    if (resp.ok) {
      setNewPresetName('');
      await loadConsoleData(adminToken, 'admin');
      await onCatalogUpdated();
      setStatusNote(`Added global preset "${newPresetName.trim()}" (${newPresetTier}).`);
    }
  };

  const handleTogglePresetTier = async (preset: any) => {
    if (!adminToken) return;
    const nextTier = preset.tier === 'PAID' ? 'FREE' : 'PAID';
    const resp = await fetch('/api/admin/content-presets/upsert-preset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ id: preset.id, tier: nextTier }),
    });
    if (resp.ok) {
      await loadConsoleData(adminToken, 'admin');
      await onCatalogUpdated();
      setStatusNote(`Switched preset "${preset.name}" to ${nextTier} tier.`);
    }
  };

  const handleDeletePreset = async (presetId: string) => {
    if (!adminToken) return;
    const resp = await fetch('/api/admin/content-presets/delete-preset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ presetId }),
    });
    if (resp.ok) {
      await loadConsoleData(adminToken, 'admin');
      await onCatalogUpdated();
      setStatusNote(`Removed global preset ${presetId}.`);
    }
  };

  const handleManageUser = async (payload: Record<string, any>) => {
    if (!adminToken) return;
    const resp = await fetch('/api/admin/users/manage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();
    if (resp.ok) {
      await loadConsoleData(adminToken, 'admin');
      setStatusNote(`Completed user/subscriber operation: ${payload.operation}.`);
    } else {
      setStatusNote(data.error || 'User management action denied.');
    }
  };

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail.trim()) return;
    await handleManageUser({
      operation: 'CREATE_USER',
      identifier: newUserEmail.trim(),
      handle: newUserHandle.trim() || undefined,
      countryCode: newUserCountry,
      planId: newUserPlan,
    });
    setNewUserEmail('');
    setNewUserHandle('');
  };

  const handleManageNotice = async (payload: Record<string, any>) => {
    if (!adminToken) return;
    const resp = await fetch('/api/admin/notices/manage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(payload),
    });
    if (resp.ok) {
      setNewNoticeTitle('');
      setNewNoticeBody('');
      await loadConsoleData(adminToken, 'admin');
      await onCatalogUpdated();
      setStatusNote(`Updated site notice (${payload.operation}).`);
    }
  };

  const handleRefundOrder = async (orderId: string) => {
    if (!adminToken) return;
    const resp = await fetch('/api/admin/finance/refund-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ orderId }),
    });
    if (resp.ok) {
      await loadConsoleData(adminToken, 'admin');
      setStatusNote(`Order ${orderId} refunded and paid entitlements revoked to FREE.`);
    }
  };

  const handleRotateVaultSecret = async (keyName: string, enableToggle?: boolean) => {
    if (!adminToken) return;
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
      await loadConsoleData(adminToken, 'admin');
      await onCatalogUpdated();
      setStatusNote(`Updated encrypted Vault slot ${keyName} (Write-Only AES-256-GCM).`);
    }
  };

  const handleRecoveryTwoPersonAction = async (
    ticketId: string,
    step: 'VERIFY_CHECKLIST' | 'SUPER_USER_APPROVE'
  ) => {
    if (!adminToken) return;
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
      await loadConsoleData(adminToken, 'admin');
      setStatusNote(`Completed ${step} for recovery ticket ${ticketId}.`);
    } else {
      setStatusNote(data.error || 'Action denied by RBAC.');
    }
  };

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

  // Control Plane Sign In & Unified Password / Account Reset Box
  if (!adminToken || !consoleData) {
    return (
      <div className="max-w-md mx-auto px-4 py-12">
        <form
          onSubmit={handleAdminLogin}
          className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] space-y-4 shadow-sm"
        >
          <div className="text-xs font-mono text-[#B44C32]">
            Control Plane Access
          </div>
          <h1 className="text-xl font-bold">Varnank Studios Control Plane</h1>
          <p className="text-xs text-[#57534E] leading-relaxed">
            Sign in with your administrative, developer, or tester credentials, or use Password /
            Account Reset.
          </p>

          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA]">
            <button
              type="button"
              data-testid="admin-mode-signin"
              onClick={() => {
                setLoginMode('SIGN_IN');
                setAuthError(null);
              }}
              className={`min-h-[34px] text-xs font-medium rounded-md transition-colors ${
                loginMode === 'SIGN_IN' ? 'bg-[#181615] text-white' : 'text-[#57534E]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              data-testid="admin-mode-reset"
              onClick={() => {
                setLoginMode('ACCOUNT_RESET');
                setAuthError(null);
              }}
              className={`min-h-[34px] text-xs font-medium rounded-md transition-colors ${
                loginMode === 'ACCOUNT_RESET' ? 'bg-[#181615] text-white' : 'text-[#57534E]'
              }`}
            >
              Password / Account Reset
            </button>
          </div>

          {authError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-300 text-xs text-red-900">
              {authError}
            </div>
          )}

          <div>
            <label htmlFor="admin-identifier" className="block text-xs font-medium mb-1">
              Email Address or Username
            </label>
            <input
              id="admin-identifier"
              data-testid="admin-identifier-input"
              type="text"
              placeholder="Enter email or username"
              value={adminIdentifier}
              onChange={(e) => setAdminIdentifier(e.target.value)}
              className="w-full min-h-[40px] px-3 py-1.5 text-sm rounded-lg bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA]"
            />
          </div>

          <div>
            <label htmlFor="admin-role-select" className="block text-xs font-medium mb-1">
              Role Scope (Auto-Detected from Account or Select)
            </label>
            <select
              id="admin-role-select"
              data-testid="admin-role-select"
              value={selectedLoginRole}
              onChange={(e) => setSelectedLoginRole(e.target.value)}
              className="w-full min-h-[40px] px-3 py-1.5 text-xs font-mono rounded-lg bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA]"
            >
              <option value="AUTO">Auto-Detect Role from Account</option>
              <option value="SUPER_USER">SUPER_USER</option>
              <option value="OFFERS_PRICING">OFFERS_PRICING</option>
              <option value="TOOLS_STUDIOS">TOOLS_STUDIOS</option>
              <option value="CONTENT_PRESETS">CONTENT_PRESETS</option>
              <option value="FINANCE">FINANCE</option>
              <option value="SUPPORT">SUPPORT</option>
              <option value="SECURITY_AUDIT">SECURITY_AUDIT</option>
              <option value="INTEGRATIONS_VAULT">INTEGRATIONS_VAULT</option>
              <option value="DEVELOPER">DEVELOPER</option>
              <option value="QA_TESTER">QA_TESTER</option>
            </select>
          </div>

          {loginMode === 'SIGN_IN' && (
            <div>
              <label htmlFor="admin-passkey" className="block text-xs font-medium mb-1">
                Password
              </label>
              <input
                id="admin-passkey"
                data-testid="admin-password-input"
                type="password"
                required
                placeholder="Enter password"
                value={passkeyCred}
                onChange={(e) => setPasskeyCred(e.target.value)}
                className="w-full min-h-[40px] px-3 py-1.5 text-sm rounded-lg bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA]"
              />
            </div>
          )}

          {loginMode === 'ACCOUNT_RESET' && (
            <>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="admin-recovery-code" className="block text-xs font-medium">
                    Verification or Recovery Code
                  </label>
                  <button
                    type="button"
                    data-testid="admin-request-reset-code-btn"
                    onClick={handleRequestAdminResetCode}
                    className="text-[11px] font-semibold text-[#B44C32] hover:underline"
                  >
                    Request Verification Code
                  </button>
                </div>
                <input
                  id="admin-recovery-code"
                  data-testid="admin-recovery-input"
                  type="text"
                  required
                  placeholder="Enter verification or recovery code"
                  value={recoveryCodeInput}
                  onChange={(e) => setRecoveryCodeInput(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-1.5 text-xs font-mono rounded-lg bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA]"
                />
              </div>
              <div>
                <label htmlFor="admin-rec-new-pwd" className="block text-xs font-medium mb-1">
                  New Password
                </label>
                <input
                  id="admin-rec-new-pwd"
                  data-testid="admin-new-password-input"
                  type="password"
                  placeholder="Enter new password"
                  value={adminNewPassword}
                  onChange={(e) => setAdminNewPassword(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-1.5 text-sm rounded-lg bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA]"
                />
              </div>
            </>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onExitPortal}
              className="min-h-[40px] px-4 py-2 text-xs border border-[#E7E2DA] rounded-lg"
            >
              Return to Studios
            </button>
            <button
              data-testid="admin-verify-login-btn"
              type="submit"
              className="flex-1 min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-[#181615] hover:bg-[#B44C32] transition-colors rounded-lg"
            >
              {loginMode === 'ACCOUNT_RESET'
                ? 'Reset Password & Open Console'
                : 'Sign In to Control Plane'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  const metrics = consoleData.analysisAndActions?.metrics || {};
  const recommendedActions = consoleData.analysisAndActions?.recommendedActions || [];
  const allUsersList: any[] = consoleData.usersSubscribers?.users || [];
  const filteredUsersList = allUsersList.filter((u) => {
    if (userFilterRole === 'SUBSCRIBERS') {
      return u.roleCategory === 'USER' && u.planId !== 'FREE' && u.planId !== 'NONE';
    }
    if (userFilterRole === 'FREE') {
      return u.roleCategory === 'USER' && (u.planId === 'FREE' || u.planId === 'NONE');
    }
    if (userFilterRole === 'STAFF') {
      return u.roleCategory !== 'USER';
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 pb-24 space-y-6">
      {/* Header Bar */}
      <div className="pb-5 border-b border-[#E7E2DA] dark:border-[#2E2B28] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-mono text-[#B44C32]">
            Control Plane · Active Role: {consoleData.roleCategory}
          </div>
          <h1 className="text-2xl font-bold">
            Varnank Studios Management, Analysis &amp; Control Center
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setAdminToken(null);
              setConsoleData(null);
              onSwitchPortalSlug('admin');
            }}
            className="min-h-[40px] px-3.5 py-1.5 text-xs font-medium border border-[#E7E2DA] rounded-lg"
          >
            Switch Role / Re-Authenticate
          </button>
          <button
            type="button"
            onClick={onExitPortal}
            className="min-h-[40px] px-4 py-1.5 text-xs font-semibold text-white bg-[#181615] rounded-lg"
          >
            Return to Studios
          </button>
        </div>
      </div>

      {/* Console Section Navigation Tabs */}
      <div className="flex flex-wrap gap-2 p-1.5 rounded-xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28]">
        {(
          [
            { id: 'OVERVIEW', label: '1. Analysis & Actions to Take' },
            { id: 'PLANS_OFFERS', label: '2. Plans, Subscriptions & Offers' },
            { id: 'TOOLS_PRESETS', label: '3. Studios, Tools & Presets' },
            { id: 'USERS_SUBSCRIBERS', label: '4. Users & Subscribers' },
            { id: 'OPERATIONS_SECURITY', label: '5. Finance, Support, Vault & Audit' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            data-testid={`admin-tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === tab.id
                ? 'bg-[#181615] text-white dark:bg-[#F5F2EB] dark:text-[#121110]'
                : 'text-[#57534E] hover:text-[#181615]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {statusNote && (
        <div
          data-testid="admin-status-note"
          className="p-3.5 rounded-xl bg-white dark:bg-[#1C1A18] border border-[#B44C32] text-xs font-mono flex items-center justify-between"
        >
          <span>{statusNote}</span>
          <button
            type="button"
            onClick={() => setStatusNote(null)}
            className="text-[#57534E] hover:text-[#181615] ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* TAB 1: EXECUTIVE ANALYSIS, RECOMMENDED ACTIONS TO TAKE & SITE NOTICES */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6">
          {/* Executive KPI Grid */}
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28]">
              <div className="text-xs text-[#57534E]">Total Accounts</div>
              <div className="text-2xl font-bold font-mono mt-1">{metrics.totalAccounts ?? 0}</div>
              <div className="text-[11px] font-mono text-[#57534E] mt-1">
                {metrics.activeSubscribers ?? 0} Subscribers · {metrics.freeMembers ?? 0} Free
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28]">
              <div className="text-xs text-[#57534E]">Verified Paid Revenue</div>
              <div className="text-lg font-bold font-mono mt-1">
                {formatMinorCurrency(metrics.inrRevenueMinor || 0, 'INR')} ·{' '}
                {formatMinorCurrency(metrics.usdRevenueMinor || 0, 'USD')}
              </div>
              <div className="text-[11px] font-mono text-[#57534E] mt-1">
                {metrics.paidOrdersCount ?? 0} Paid Orders / {metrics.totalOrders ?? 0} Total
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28]">
              <div className="text-xs text-[#57534E]">Studio Tools &amp; Presets</div>
              <div className="text-2xl font-bold font-mono mt-1">
                {metrics.enabledToolsCount ?? 24}/{metrics.totalTools ?? 24} Tools
              </div>
              <div className="text-[11px] font-mono text-[#57534E] mt-1">
                {metrics.totalPresets ?? 0} Global Presets · {metrics.activeOffersCount ?? 0} Active Offers
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28]">
              <div className="text-xs text-[#57534E]">Sessions &amp; Support Queue</div>
              <div className="text-2xl font-bold font-mono mt-1">
                {metrics.activeSessionsCount ?? 0} Sessions
              </div>
              <div className="text-[11px] font-mono text-[#57534E] mt-1">
                {metrics.openTicketsCount ?? 0} Open Support/Recovery Tickets
              </div>
            </div>
          </section>

          {/* Actionable Analysis & "Actions to Take" Queue */}
          <section className="p-5 rounded-2xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] space-y-4">
            <div>
              <h2 className="text-base font-bold">
                Operational Analysis &amp; Recommended Actions to Take
              </h2>
              <p className="text-xs text-[#57534E]">
                Real-time administrative recommendations based on current user quotas, vault
                status, conversion metrics, and support queues.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {recommendedActions.map((act: any) => (
                <div
                  key={act.actionId}
                  className="p-4 rounded-xl bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA] dark:border-[#2E2B28] flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] font-semibold text-[#B44C32]">
                        [{act.priority} PRIORITY] · {act.category}
                      </span>
                    </div>
                    <div className="text-sm font-bold">{act.title}</div>
                    <p className="text-xs text-[#57534E] leading-relaxed">{act.analysis}</p>
                  </div>
                  <div>
                    <button
                      type="button"
                      data-testid={`exec-action-${act.actionId}`}
                      onClick={() => handleExecuteRecommendedAction(act.actionId)}
                      className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-[#181615] hover:bg-[#B44C32] text-white text-xs font-semibold transition-colors"
                    >
                      {act.buttonLabel}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Site-Wide Announcements & Notices Manager */}
          {consoleData.notices && (
            <section className="p-5 rounded-2xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] space-y-4">
              <div>
                <h2 className="text-base font-bold">
                  Site Announcements &amp; Member Notices (Add / Toggle / Remove)
                </h2>
                <p className="text-xs text-[#57534E]">
                  Publish or remove announcements shown in user dashboards and studio headers.
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newNoticeTitle.trim()) return;
                  handleManageNotice({
                    operation: 'CREATE',
                    title: newNoticeTitle,
                    body: newNoticeBody,
                  });
                }}
                className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 rounded-xl bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA]"
              >
                <input
                  type="text"
                  required
                  placeholder="Enter announcement title"
                  value={newNoticeTitle}
                  onChange={(e) => setNewNoticeTitle(e.target.value)}
                  className="min-h-[38px] px-3 py-1.5 text-xs rounded bg-white border border-[#E7E2DA]"
                />
                <input
                  type="text"
                  placeholder="Enter announcement summary"
                  value={newNoticeBody}
                  onChange={(e) => setNewNoticeBody(e.target.value)}
                  className="min-h-[38px] px-3 py-1.5 text-xs rounded bg-white border border-[#E7E2DA]"
                />
                <button
                  type="submit"
                  className="min-h-[38px] px-4 py-1.5 text-xs font-semibold text-white bg-[#181615] rounded"
                >
                  + Add Announcement
                </button>
              </form>

              <div className="space-y-2">
                {consoleData.notices.map((n: any) => (
                  <div
                    key={n.id}
                    className="p-3 rounded-xl border border-[#E7E2DA] flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <span className="font-bold">{n.title}</span> —{' '}
                      <span className="text-[#57534E]">{n.body}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleManageNotice({ operation: 'TOGGLE', noticeId: n.id })}
                        className={`px-2.5 py-1 rounded font-mono text-[11px] ${
                          n.active
                            ? 'bg-[#15803D] text-white'
                            : 'bg-gray-100 text-[#57534E] border border-[#E7E2DA]'
                        }`}
                      >
                        {n.active ? 'Active' : 'Hidden'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleManageNotice({ operation: 'DELETE', noticeId: n.id })}
                        className="px-2.5 py-1 rounded bg-red-50 text-red-800 border border-red-200 text-[11px]"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* TAB 2: PLANS, SUBSCRIPTIONS, PRICING & PROMOTIONAL OFFERS */}
      {(activeTab === 'PLANS_OFFERS' || activeTab === 'OVERVIEW') && consoleData.offersPricing && (
        <section className="p-5 rounded-2xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] space-y-6">
          <div>
            <h2 className="text-base font-bold">
              Plan Subscriptions, Pricing &amp; Output Quality/Quantity Caps Manager
            </h2>
            <p className="text-xs text-[#57534E]">
              Modify existing plans, add new custom subscription tiers, or remove custom plans.
            </p>
          </div>

          <form
            onSubmit={handleUpdatePlanConfig}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 rounded-xl bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA]"
          >
            <div>
              <label className="block text-xs font-medium mb-1">Target Plan Tier</label>
              <select
                data-testid="admin-plan-select"
                value={editingPlanId}
                onChange={(e) => {
                  const nextPlan = e.target.value as PlanId;
                  setEditingPlanId(nextPlan);
                  syncSelectedPlanEditor(consoleData.offersPricing.plans, nextPlan);
                }}
                className="w-full min-h-[38px] px-2.5 py-1 text-xs font-mono rounded bg-white border border-[#E7E2DA]"
              >
                {Object.keys(consoleData.offersPricing.plans).map((pid) => (
                  <option key={pid} value={pid}>
                    {pid} ({consoleData.offersPricing.plans[pid].name})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Base Price INR (Paise, e.g. 39900 = ₹399)
              </label>
              <input
                data-testid="admin-plan-inr-input"
                type="number"
                min={0}
                value={editInrBaseMinor}
                onChange={(e) => setEditInrBaseMinor(Number(e.target.value))}
                className="w-full min-h-[38px] px-2.5 py-1 text-xs font-mono rounded bg-white border border-[#E7E2DA]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Base Price USD (Cents, e.g. 900 = $9.00)
              </label>
              <input
                data-testid="admin-plan-usd-input"
                type="number"
                min={0}
                value={editUsdBaseMinor}
                onChange={(e) => setEditUsdBaseMinor(Number(e.target.value))}
                className="w-full min-h-[38px] px-2.5 py-1 text-xs font-mono rounded bg-white border border-[#E7E2DA]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Max Export Quality Cap (60%–100%)
              </label>
              <input
                data-testid="admin-plan-quality-input"
                type="number"
                min={60}
                max={100}
                value={editQualityCap}
                onChange={(e) => setEditQualityCap(Number(e.target.value))}
                className="w-full min-h-[38px] px-2.5 py-1 text-xs font-mono rounded bg-white border border-[#E7E2DA]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Max Output Print DPI</label>
              <select
                data-testid="admin-plan-dpi-select"
                value={editDpiCap}
                onChange={(e) => setEditDpiCap(Number(e.target.value))}
                className="w-full min-h-[38px] px-2.5 py-1 text-xs font-mono rounded bg-white border border-[#E7E2DA]"
              >
                <option value={72}>72 DPI</option>
                <option value={150}>150 DPI</option>
                <option value={300}>300 DPI</option>
                <option value={600}>600 DPI</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Batch Quantity Cap (1–200)</label>
              <input
                data-testid="admin-plan-batch-input"
                type="number"
                min={1}
                max={200}
                value={editBatchCap}
                onChange={(e) => setEditBatchCap(Number(e.target.value))}
                className="w-full min-h-[38px] px-2.5 py-1 text-xs font-mono rounded bg-white border border-[#E7E2DA]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Daily Export Quota (-1 = Unlim)</label>
              <input
                type="number"
                min={-1}
                max={5000}
                value={editDailyQuota}
                onChange={(e) => setEditDailyQuota(Number(e.target.value))}
                className="w-full min-h-[38px] px-2.5 py-1 text-xs font-mono rounded bg-white border border-[#E7E2DA]"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                data-testid="admin-save-plan-btn"
                type="submit"
                className="flex-1 min-h-[38px] px-4 py-1.5 text-xs font-semibold text-white bg-[#181615] rounded"
              >
                Save Plan &amp; Caps
              </button>
              {editingPlanId !== 'FREE' && editingPlanId !== 'NONE' && (
                <button
                  type="button"
                  onClick={() => handleDeletePlan(editingPlanId)}
                  className="min-h-[38px] px-3 py-1.5 text-xs font-semibold text-red-800 bg-red-50 border border-red-200 rounded"
                >
                  Remove
                </button>
              )}
            </div>
          </form>

          {/* Create New Plan Form */}
          <div className="border-t border-[#E7E2DA] pt-4 space-y-3">
            <h3 className="text-sm font-bold">+ Add New Custom Plan / Subscription Tier</h3>
            <form
              onSubmit={handleCreateNewPlan}
              className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 p-3.5 rounded-xl bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA] text-xs"
            >
              <div>
                <label className="block font-medium mb-1">Plan Code</label>
                <input
                  type="text"
                  placeholder="Enter plan code"
                  value={newPlanCode}
                  onChange={(e) => setNewPlanCode(e.target.value)}
                  className="w-full min-h-[36px] px-2 font-mono rounded bg-white border border-[#E7E2DA]"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Plan Name</label>
                <input
                  type="text"
                  required
                  placeholder="Enter plan name"
                  value={newPlanName}
                  onChange={(e) => setNewPlanName(e.target.value)}
                  className="w-full min-h-[36px] px-2 rounded bg-white border border-[#E7E2DA]"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">INR Paise</label>
                <input
                  type="number"
                  value={newPlanInrMinor}
                  onChange={(e) => setNewPlanInrMinor(Number(e.target.value))}
                  className="w-full min-h-[36px] px-2 font-mono rounded bg-white border border-[#E7E2DA]"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">USD Cents</label>
                <input
                  type="number"
                  value={newPlanUsdMinor}
                  onChange={(e) => setNewPlanUsdMinor(Number(e.target.value))}
                  className="w-full min-h-[36px] px-2 font-mono rounded bg-white border border-[#E7E2DA]"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Max DPI / Batch</label>
                <div className="grid grid-cols-2 gap-1">
                  <input
                    type="number"
                    value={newPlanDpi}
                    onChange={(e) => setNewPlanDpi(Number(e.target.value))}
                    className="w-full min-h-[36px] px-1.5 font-mono rounded bg-white border border-[#E7E2DA]"
                  />
                  <input
                    type="number"
                    value={newPlanBatch}
                    onChange={(e) => setNewPlanBatch(Number(e.target.value))}
                    className="w-full min-h-[36px] px-1.5 font-mono rounded bg-white border border-[#E7E2DA]"
                  />
                </div>
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full min-h-[36px] px-3 py-1 bg-[#181615] text-white font-semibold rounded"
                >
                  + Create Plan
                </button>
              </div>
            </form>
          </div>

          {/* Promotional Offer Builder & List */}
          <div className="border-t border-[#E7E2DA] pt-4 space-y-3">
            <h3 className="text-sm font-bold">
              Promotional Offer &amp; Discount Campaign Manager (Add / Pause / Remove)
            </h3>
            <form
              onSubmit={handlePublishOffer}
              className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 rounded-xl bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA]"
            >
              <div>
                <label className="block text-xs font-medium mb-1">Offer Template</label>
                <select
                  value={offerTemplate}
                  onChange={(e) => setOfferTemplate(e.target.value as OfferTemplateType)}
                  className="w-full min-h-[38px] px-2.5 py-1 text-xs rounded bg-white border border-[#E7E2DA]"
                >
                  <option value="PERCENTAGE">1. Percentage Discount</option>
                  <option value="FLAT_AMOUNT">2. Flat Amount Off</option>
                  <option value="FIRST_PURCHASE">3. First-Purchase Welcome</option>
                  <option value="SEASONAL">4. Seasonal / Festival Offer</option>
                  <option value="FLASH_COUNTDOWN">5. Time-Limited Flash Offer</option>
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
                <label className="block text-xs font-medium mb-1">Discount (INR % or Paise)</label>
                <input
                  type="number"
                  value={offerInrValue}
                  onChange={(e) => setOfferInrValue(Number(e.target.value))}
                  className="w-full min-h-[38px] px-2.5 py-1 text-xs font-mono rounded bg-white border border-[#E7E2DA]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Discount (USD % or Cents)</label>
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
                  Publish Offer
                </button>
              </div>
            </form>

            <div className="space-y-2">
              {consoleData.offersPricing.offers.map((off: any) => (
                <div
                  key={off.id}
                  className="p-3 rounded-lg border border-[#E7E2DA] flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <span className="font-mono font-semibold">{off.id}</span> ·{' '}
                    <span className="font-semibold">{off.title}</span> ({off.templateType}) ·
                    Status: <span className="font-mono">{off.status}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleToggleOfferStatus(
                          off.id,
                          off.status === 'PUBLISHED' ? 'PAUSED' : 'PUBLISHED'
                        )
                      }
                      className="min-h-[30px] px-2.5 py-1 rounded border border-[#E7E2DA] font-mono text-[11px]"
                    >
                      {off.status === 'PUBLISHED' ? 'Pause' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteOffer(off.id)}
                      className="min-h-[30px] px-2.5 py-1 rounded bg-red-50 text-red-800 border border-red-200 font-mono text-[11px]"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* TAB 3: STUDIO TOOLS & GLOBAL PRESETS (ADD / EDIT / ENABLE / PAUSE / REMOVE) */}
      {(activeTab === 'TOOLS_PRESETS' || activeTab === 'OVERVIEW') && (
        <div className="space-y-6">
          {consoleData.toolsStudios?.tools && (
            <section className="p-5 rounded-2xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] space-y-4">
              <div>
                <h2 className="text-base font-bold">
                  Studio Tools Manager ({consoleData.toolsStudios.tools.length} Tools · Add / Tier / Enable / Remove)
                </h2>
                <p className="text-xs text-[#57534E]">
                  Add new tools to any studio, switch tools between Free, Paid, and Premium tiers,
                  pause/enable tools, or remove tools.
                </p>
              </div>

              <form
                onSubmit={handleCreateTool}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 p-3.5 rounded-xl bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA] text-xs"
              >
                <div>
                  <label className="block font-medium mb-1">Studio</label>
                  <select
                    value={newToolStudioId}
                    onChange={(e) => setNewToolStudioId(e.target.value as StudioId)}
                    className="w-full min-h-[36px] px-2 rounded bg-white border border-[#E7E2DA]"
                  >
                    <option value="S1">Photo / Image Studio</option>
                    <option value="S2">PDF Studio</option>
                    <option value="S3">ID / Govt. ID Studio</option>
                    <option value="S4">Print &amp; Publication Studio</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Entitlement Tier</label>
                  <select
                    value={newToolTier}
                    onChange={(e) => setNewToolTier(e.target.value as 'FREE' | 'PAID' | 'PREMIUM')}
                    className="w-full min-h-[36px] px-2 rounded bg-white border border-[#E7E2DA]"
                  >
                    <option value="FREE">FREE</option>
                    <option value="PAID">PAID</option>
                    <option value="PREMIUM">PREMIUM</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Tool Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter tool name"
                    value={newToolName}
                    onChange={(e) => setNewToolName(e.target.value)}
                    className="w-full min-h-[36px] px-2 rounded bg-white border border-[#E7E2DA]"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Summary</label>
                  <input
                    type="text"
                    placeholder="Enter tool summary"
                    value={newToolSummary}
                    onChange={(e) => setNewToolSummary(e.target.value)}
                    className="w-full min-h-[36px] px-2 rounded bg-white border border-[#E7E2DA]"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full min-h-[36px] px-3 py-1 bg-[#181615] text-white font-semibold rounded"
                  >
                    + Add Studio Tool
                  </button>
                </div>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-96 overflow-y-auto pr-1">
                {consoleData.toolsStudios.tools.map((t: any) => (
                  <div
                    key={t.id}
                    className="p-3 rounded-xl bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA] flex items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <div className="font-mono text-[11px] text-[#57534E]">
                        {t.studioId} · {t.codeLabel}
                      </div>
                      <div className="font-semibold">{t.name}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <select
                        aria-label={`Tier for ${t.name}`}
                        value={t.tier}
                        onChange={(e) =>
                          handleUpdateStudioTool(
                            t.id,
                            e.target.value as 'FREE' | 'PAID' | 'PREMIUM',
                            t.enabled !== false
                          )
                        }
                        className="min-h-[30px] px-2 py-1 text-xs font-mono rounded bg-white border border-[#E7E2DA]"
                      >
                        <option value="FREE">FREE</option>
                        <option value="PAID">PAID</option>
                        <option value="PREMIUM">PREMIUM</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => handleUpdateStudioTool(t.id, t.tier, t.enabled === false)}
                        className={`min-h-[30px] px-2.5 py-1 rounded font-mono text-[11px] ${
                          t.enabled !== false
                            ? 'bg-[#15803D] text-white'
                            : 'bg-amber-100 text-amber-900 border border-amber-300'
                        }`}
                      >
                        {t.enabled !== false ? 'Enabled' : 'Paused'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteStudioTool(t.id)}
                        className="min-h-[30px] px-2 py-1 rounded bg-red-50 text-red-800 border border-red-200 text-[11px]"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {consoleData.contentPresets?.presets && (
            <section className="p-5 rounded-2xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] space-y-4">
              <div>
                <h2 className="text-base font-bold">
                  Global Presets Manager ({consoleData.contentPresets.presets.length} Presets · Add / Tier / Remove)
                </h2>
                <p className="text-xs text-[#57534E]">
                  Add new global studio presets, toggle between Free and Paid tiers, or remove presets.
                </p>
              </div>

              <form
                onSubmit={handleUpsertGlobalPreset}
                className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 p-3.5 rounded-xl bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA] text-xs"
              >
                <div>
                  <label className="block font-medium mb-1">Studio</label>
                  <select
                    value={newPresetStudioId}
                    onChange={(e) => setNewPresetStudioId(e.target.value as StudioId)}
                    className="w-full min-h-[36px] px-2 rounded bg-white border border-[#E7E2DA]"
                  >
                    <option value="S1">Photo / Image Studio</option>
                    <option value="S2">PDF Studio</option>
                    <option value="S3">ID / Govt. ID Studio</option>
                    <option value="S4">Print &amp; Publication Studio</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Category</label>
                  <select
                    value={newPresetCategory}
                    onChange={(e) =>
                      setNewPresetCategory(e.target.value as 'SIZE' | 'TEMPLATE' | 'EXPORT_PROFILE')
                    }
                    className="w-full min-h-[36px] px-2 rounded bg-white border border-[#E7E2DA]"
                  >
                    <option value="SIZE">SIZE</option>
                    <option value="TEMPLATE">TEMPLATE</option>
                    <option value="EXPORT_PROFILE">EXPORT_PROFILE</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Tier</label>
                  <select
                    value={newPresetTier}
                    onChange={(e) => setNewPresetTier(e.target.value as 'FREE' | 'PAID')}
                    className="w-full min-h-[36px] px-2 rounded bg-white border border-[#E7E2DA]"
                  >
                    <option value="FREE">FREE</option>
                    <option value="PAID">PAID</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Preset Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter preset name"
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    className="w-full min-h-[36px] px-2 rounded bg-white border border-[#E7E2DA]"
                  />
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <div>
                    <label className="block font-medium mb-1">W (px)</label>
                    <input
                      type="number"
                      value={newPresetWidthPx}
                      onChange={(e) => setNewPresetWidthPx(Number(e.target.value))}
                      className="w-full min-h-[36px] px-1.5 font-mono rounded bg-white border border-[#E7E2DA]"
                    />
                  </div>
                  <div>
                    <label className="block font-medium mb-1">H (px)</label>
                    <input
                      type="number"
                      value={newPresetHeightPx}
                      onChange={(e) => setNewPresetHeightPx(Number(e.target.value))}
                      className="w-full min-h-[36px] px-1.5 font-mono rounded bg-white border border-[#E7E2DA]"
                    />
                  </div>
                  <div>
                    <label className="block font-medium mb-1">DPI</label>
                    <input
                      type="number"
                      value={newPresetDpi}
                      onChange={(e) => setNewPresetDpi(Number(e.target.value))}
                      className="w-full min-h-[36px] px-1.5 font-mono rounded bg-white border border-[#E7E2DA]"
                    />
                  </div>
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full min-h-[36px] px-3 py-1 bg-[#181615] text-white font-semibold rounded"
                  >
                    + Add Preset
                  </button>
                </div>
              </form>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 max-h-80 overflow-y-auto pr-1">
                {consoleData.contentPresets.presets.map((p: any) => (
                  <div
                    key={p.id}
                    className="p-3 rounded-xl border border-[#E7E2DA] flex flex-col justify-between gap-2 text-xs"
                  >
                    <div>
                      <div className="font-mono text-[11px] text-[#57534E]">
                        {p.codeLabel} · {p.category}
                      </div>
                      <div className="font-semibold">{p.name}</div>
                      <div className="font-mono text-[11px] text-[#57534E]">{p.dimensionsLabel}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleTogglePresetTier(p)}
                        className={`flex-1 min-h-[30px] px-2 py-1 rounded font-mono text-[11px] font-semibold ${
                          p.tier === 'PAID'
                            ? 'bg-[#B44C32] text-white'
                            : 'bg-[#FAF8F5] border border-[#E7E2DA] text-[#181615]'
                        }`}
                      >
                        {p.tier} (Toggle)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePreset(p.id)}
                        className="min-h-[30px] px-2 py-1 rounded bg-red-50 text-red-800 border border-red-200 text-[11px]"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* TAB 4: USERS & SUBSCRIBERS DIRECTORY & ENTITLEMENT CONTROLLER */}
      {(activeTab === 'USERS_SUBSCRIBERS' || activeTab === 'OVERVIEW') &&
        consoleData.usersSubscribers && (
          <section
            data-testid="users-subscribers-management-section"
            className="p-5 rounded-2xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold">
                  Users, Subscribers &amp; Entitlement Directory ({allUsersList.length} Accounts)
                </h2>
                <p className="text-xs text-[#57534E]">
                  Add new accounts, upgrade/downgrade subscriptions, reset daily 3-file free quotas,
                  suspend/activate accounts, or remove accounts.
                </p>
              </div>
              <div className="flex gap-1.5">
                {(['ALL', 'SUBSCRIBERS', 'FREE', 'STAFF'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setUserFilterRole(f)}
                    className={`px-2.5 py-1 rounded text-xs font-mono ${
                      userFilterRole === f
                        ? 'bg-[#181615] text-white'
                        : 'bg-[#FAF8F5] border border-[#E7E2DA] text-[#57534E]'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Add New User / Subscriber Form */}
            <form
              onSubmit={handleCreateUserSubmit}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 p-3.5 rounded-xl bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA] text-xs"
            >
              <div>
                <label className="block font-medium mb-1">Email / Identifier</label>
                <input
                  type="text"
                  required
                  placeholder="Enter email or username"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full min-h-[36px] px-2 rounded bg-white border border-[#E7E2DA]"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Display Handle</label>
                <input
                  type="text"
                  placeholder="Enter display name"
                  value={newUserHandle}
                  onChange={(e) => setNewUserHandle(e.target.value)}
                  className="w-full min-h-[36px] px-2 rounded bg-white border border-[#E7E2DA]"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Country Code</label>
                <select
                  value={newUserCountry}
                  onChange={(e) => setNewUserCountry(e.target.value)}
                  className="w-full min-h-[36px] px-2 rounded bg-white border border-[#E7E2DA]"
                >
                  <option value="+91">+91 India (INR ₹)</option>
                  <option value="+1">+1 United States (USD $)</option>
                  <option value="+44">+44 United Kingdom (USD $)</option>
                </select>
              </div>
              <div>
                <label className="block font-medium mb-1">Initial Subscription Plan</label>
                <select
                  value={newUserPlan}
                  onChange={(e) => setNewUserPlan(e.target.value as PlanId)}
                  className="w-full min-h-[36px] px-2 font-mono rounded bg-white border border-[#E7E2DA]"
                >
                  {(consoleData.usersSubscribers.availablePlanIds || ['FREE', 'PASS_24H', 'PRO_MONTHLY', 'PREMIUM_ANNUAL'])
                    .filter((pid: string) => pid !== 'NONE')
                    .map((pid: string) => (
                      <option key={pid} value={pid}>
                        {pid}
                      </option>
                    ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full min-h-[36px] px-3 py-1 bg-[#181615] text-white font-semibold rounded"
                >
                  + Add User / Subscriber
                </button>
              </div>
            </form>

            {/* Users & Subscribers Table */}
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {filteredUsersList.map((u: any) => (
                <div
                  key={u.id}
                  className="p-3 rounded-xl bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA] flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold">{u.handle}</span>
                      <span className="font-mono text-[#B44C32]">{u.identifier}</span>
                      <span className="px-2 py-0.5 rounded bg-[#181615] text-white font-mono text-[10px]">
                        {u.roleCategory}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded font-mono text-[10px] ${
                          u.status === 'ACTIVE'
                            ? 'bg-[#15803D]/15 text-[#15803D]'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {u.status}
                      </span>
                    </div>
                    <div className="font-mono text-[11px] text-[#57534E]">
                      Plan: <strong>{u.planId}</strong> ({u.entitlementState}) · Currency:{' '}
                      {u.currency} ({u.countryCode}) · Daily Used: {u.dailyExportsUsed}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label={`Change plan for ${u.identifier}`}
                      value={u.planId}
                      onChange={(e) =>
                        handleManageUser({
                          operation: 'ASSIGN_PLAN',
                          targetUserId: u.id,
                          planId: e.target.value,
                          entitlementState: 'ACTIVE',
                        })
                      }
                      className="min-h-[30px] px-2 py-1 font-mono text-[11px] rounded bg-white border border-[#E7E2DA]"
                    >
                      {(consoleData.usersSubscribers.availablePlanIds || [
                        'FREE',
                        'PASS_24H',
                        'PRO_MONTHLY',
                        'PREMIUM_ANNUAL',
                      ])
                        .filter((pid: string) => pid !== 'NONE')
                        .map((pid: string) => (
                          <option key={pid} value={pid}>
                            Plan: {pid}
                          </option>
                        ))}
                    </select>

                    <button
                      type="button"
                      onClick={() =>
                        handleManageUser({
                          operation: 'RESET_DAILY_QUOTA',
                          targetUserId: u.id,
                        })
                      }
                      className="min-h-[30px] px-2.5 py-1 rounded border border-[#E7E2DA] bg-white font-mono text-[11px]"
                    >
                      Reset Quota
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleManageUser({
                          operation: 'TOGGLE_STATUS',
                          targetUserId: u.id,
                        })
                      }
                      className="min-h-[30px] px-2.5 py-1 rounded border border-[#E7E2DA] bg-white font-mono text-[11px]"
                    >
                      {u.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                    </button>

                    {u.roleCategory === 'USER' && (
                      <button
                        type="button"
                        onClick={() =>
                          handleManageUser({
                            operation: 'DELETE_USER',
                            targetUserId: u.id,
                          })
                        }
                        className="min-h-[30px] px-2.5 py-1 rounded bg-red-50 text-red-800 border border-red-200 font-mono text-[11px]"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

      {/* TAB 5: OPERATIONS, FINANCE, SUPPORT, VAULT, CREDENTIAL ROTATION & AUDIT */}
      {(activeTab === 'OPERATIONS_SECURITY' || activeTab === 'OVERVIEW') && (
        <div className="space-y-6">
          {/* Admin Passkey & MFA Credential Rotation */}
          <section className="p-5 rounded-2xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold">
                  Admin Passkey, 6-Digit MFA &amp; Single-Use Recovery Rotation
                </h2>
                <p className="text-xs text-[#57534E]">
                  Credentials are stored exclusively as SHA-256 hashes; rotating issues a fresh
                  one-time recovery code shown once below.
                </p>
              </div>
              {mustRotateOnFirstLogin && (
                <span className="px-2.5 py-1 rounded bg-[#B44C32]/15 text-[#B44C32] text-xs font-mono font-semibold">
                  First-Login Rotation Required
                </span>
              )}
            </div>

            <form
              onSubmit={handleRotateAdminCredential}
              className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 rounded-xl bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA]"
            >
              <div>
                <label className="block text-xs font-medium mb-1">Target Role Category</label>
                <select
                  value={rotateTargetCategory}
                  disabled={consoleData.roleCategory !== 'SUPER_USER'}
                  onChange={(e) => setRotateTargetCategory(e.target.value as AdminCategory)}
                  className="w-full min-h-[38px] px-2.5 py-1 text-xs font-mono rounded bg-white border border-[#E7E2DA]"
                >
                  {Object.keys(ADMIN_PORTAL_SLUGS).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">
                  New Credential / Password
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="Enter new credential"
                  value={newPasskeyToken}
                  onChange={(e) => setNewPasskeyToken(e.target.value)}
                  className="w-full min-h-[38px] px-2.5 py-1 text-xs font-mono rounded bg-white border border-[#E7E2DA]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Verification PIN</label>
                <input
                  type="password"
                  required
                  maxLength={6}
                  placeholder="Enter verification PIN"
                  value={newTotpPin}
                  onChange={(e) => setNewTotpPin(e.target.value)}
                  className="w-full min-h-[38px] px-2.5 py-1 text-xs font-mono rounded bg-white border border-[#E7E2DA]"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full min-h-[38px] px-4 py-1.5 text-xs font-semibold text-white bg-[#181615] rounded"
                >
                  Rotate Hash &amp; Issue Recovery Code
                </button>
              </div>
            </form>

            {freshRecoveryCodeOnce && (
              <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#B44C32] text-xs font-mono space-y-1">
                <div className="font-bold text-[#B44C32]">
                  Shown Once — New Single-Use Recovery Code ({rotateTargetCategory}):
                </div>
                <div className="text-sm font-bold select-all">{freshRecoveryCodeOnce}</div>
              </div>
            )}
          </section>

          {/* Tier 2 Encrypted Secrets Vault */}
          {consoleData.vault && (
            <section className="p-5 rounded-2xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] space-y-4">
              <h2 className="text-base font-bold">
                Tier 2 Encrypted Secrets Vault (Write-Only AES-256-GCM)
              </h2>
              <p className="text-xs text-[#57534E]">
                Enable or rotate Payment, Email OTP, Google OAuth, or Password Pepper provider keys.
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

          {/* Support Desk & Two-Person Recovery Verification */}
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
                            onClick={() =>
                              handleRecoveryTwoPersonAction(tkt.id, 'SUPER_USER_APPROVE')
                            }
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

          {/* Finance Ledger & Refund Revocation */}
          {consoleData.finance && (
            <section className="p-5 rounded-2xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] space-y-3">
              <h2 className="text-base font-bold">
                Finance Orders, Webhook Activation Ledger &amp; Immediate Refund Revocation
              </h2>
              <div className="text-xs font-mono text-[#57534E]">
                Total Orders: {consoleData.finance.orders.length} · Anonymized Retained Tax
                Records: {consoleData.finance.anonymizedTaxLedger.length}
              </div>
              {consoleData.finance.orders.length > 0 && (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {consoleData.finance.orders.map((ord: any) => (
                    <div
                      key={ord.id}
                      className="p-3 rounded-xl bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA] flex flex-wrap items-center justify-between gap-2 text-xs font-mono"
                    >
                      <div>
                        <span className="font-bold">{ord.id}</span> · Plan: {ord.planId} ·{' '}
                        {formatMinorCurrency(ord.finalMinor, ord.currency)} · Status:{' '}
                        <span className="font-bold">{ord.state}</span>
                      </div>
                      {ord.state === 'PAID' && (
                        <button
                          type="button"
                          onClick={() => handleRefundOrder(ord.id)}
                          className="min-h-[30px] px-2.5 py-1 rounded bg-red-700 text-white text-[11px] font-semibold"
                        >
                          Refund &amp; Revoke Entitlement
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Security Audit & Developer Diagnostics */}
          {(consoleData.securityAudit || consoleData.developerDiagnostics) && (
            <section
              data-testid="developer-diagnostics-section"
              className="p-5 rounded-2xl bg-white dark:bg-[#1C1A18] border border-[#E7E2DA] dark:border-[#2E2B28] space-y-4"
            >
              <h2 className="text-base font-bold">
                Security Audit Trail, Quotas &amp; Developer/Tester Diagnostics
              </h2>

              {consoleData.developerDiagnostics && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
                  <div className="p-3 rounded-xl bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA]">
                    <div className="text-[#57534E]">Entitlement Engine</div>
                    <div className="font-bold mt-1">
                      {consoleData.developerDiagnostics.entitlementEngineSource}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA]">
                    <div className="text-[#57534E]">Webhook Verifier</div>
                    <div className="font-bold mt-1">
                      {consoleData.developerDiagnostics.webhookVerifierStatus}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA]">
                    <div className="text-[#57534E]">Active Users &amp; Sessions</div>
                    <div className="font-bold mt-1">
                      {consoleData.developerDiagnostics.registeredUsersCount} Users ·{' '}
                      {consoleData.developerDiagnostics.activeSessionsCount} Sessions
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#FAF8F5] dark:bg-[#262320] border border-[#E7E2DA]">
                    <div className="text-[#57534E]">RBAC Roles Active</div>
                    <div className="font-bold mt-1">
                      {consoleData.developerDiagnostics.registeredAdminRoles?.length || 10} Roles
                    </div>
                  </div>
                </div>
              )}

              {consoleData.securityAudit?.auditLogs && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold">
                    Tamper-Evident Hash-Chained Audit Trail (Latest Entries)
                  </div>
                  <div className="max-h-60 overflow-auto space-y-1.5 font-mono text-[11px]">
                    {consoleData.securityAudit.auditLogs.slice(0, 15).map((log: any) => (
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
      )}
    </div>
  );
};
