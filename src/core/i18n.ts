export type SupportedLocale = 'en' | 'hi' | 'es' | 'fr' | 'de' | 'ja' | 'ar';

export interface LocaleMeta {
  code: SupportedLocale;
  label: string;
  nativeLabel: string;
  dir: 'ltr' | 'rtl';
}

export const SUPPORTED_LOCALES: LocaleMeta[] = [
  { code: 'en', label: 'English', nativeLabel: 'English', dir: 'ltr' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', dir: 'ltr' },
  { code: 'es', label: 'Spanish', nativeLabel: 'Español', dir: 'ltr' },
  { code: 'fr', label: 'French', nativeLabel: 'Français', dir: 'ltr' },
  { code: 'de', label: 'German', nativeLabel: 'Deutsch', dir: 'ltr' },
  { code: 'ja', label: 'Japanese', nativeLabel: '日本語', dir: 'ltr' },
  { code: 'ar', label: 'Arabic', nativeLabel: 'العربية', dir: 'rtl' },
];

export const UI_DICTIONARY: Record<
  SupportedLocale,
  {
    brandTagline: string;
    navStudios: string;
    navPresets: string;
    navPlans: string;
    navHelp: string;
    signInSignUp: string;
    dashboard: string;
    zeroUploadNotice: string;
    upgradeToUnlock: string;
    proceedToPayment: string;
    wipeLocalData: string;
  }
> = {
  en: {
    brandTagline: 'Private, instant creative and document studios right on your device.',
    navStudios: 'Studios',
    navPresets: 'Presets',
    navPlans: 'Plans',
    navHelp: 'Help',
    signInSignUp: 'Sign in / Sign up',
    dashboard: 'Dashboard',
    zeroUploadNotice: 'Your files stay on your device and are never uploaded anywhere.',
    upgradeToUnlock: 'Upgrade to unlock',
    proceedToPayment: 'Proceed to Secure Payment',
    wipeLocalData: 'Wipe Local Device Data',
  },
  hi: {
    brandTagline: 'आपके डिवाइस पर निजी और त्वरित क्रिएटिव एवं डॉक्यूमेंट स्टूडियो।',
    navStudios: 'स्टूडियो',
    navPresets: 'प्रीसेट',
    navPlans: 'प्लान',
    navHelp: 'सहायता',
    signInSignUp: 'साइन इन / साइन अप',
    dashboard: 'डैशबोर्ड',
    zeroUploadNotice: 'आपकी फ़ाइलें आपके डिवाइस पर ही रहती हैं और कहीं अपलोड नहीं होतीं।',
    upgradeToUnlock: 'अनलॉक करने के लिए अपग्रेड करें',
    proceedToPayment: 'सुरक्षित भुगतान के लिए आगे बढ़ें',
    wipeLocalData: 'डिवाइस का लोकल डेटा मिटाएं',
  },
  es: {
    brandTagline: 'Estudios privados e instantáneos de documentos e imagen en tu dispositivo.',
    navStudios: 'Estudios',
    navPresets: 'Ajustes',
    navPlans: 'Planes',
    navHelp: 'Ayuda',
    signInSignUp: 'Iniciar sesión / Registro',
    dashboard: 'Panel',
    zeroUploadNotice: 'Tus archivos permanecen en tu dispositivo y nunca se suben.',
    upgradeToUnlock: 'Mejorar plan para desbloquear',
    proceedToPayment: 'Proceder al pago seguro',
    wipeLocalData: 'Borrar datos locales',
  },
  fr: {
    brandTagline: 'Studios créatifs et documentaires privés directement sur votre appareil.',
    navStudios: 'Studios',
    navPresets: 'Modèles',
    navPlans: 'Forfaits',
    navHelp: 'Aide',
    signInSignUp: 'Connexion / Inscription',
    dashboard: 'Tableau de bord',
    zeroUploadNotice: 'Vos fichiers restent sur votre appareil et ne sont jamais envoyés.',
    upgradeToUnlock: 'Passer au forfait supérieur',
    proceedToPayment: 'Procéder au paiement sécurisé',
    wipeLocalData: 'Effacer les données locales',
  },
  de: {
    brandTagline: 'Private, sofortige Kreativ- und Dokument-Studios direkt auf Ihrem Gerät.',
    navStudios: 'Studios',
    navPresets: 'Vorlagen',
    navPlans: 'Tarife',
    navHelp: 'Hilfe',
    signInSignUp: 'Anmelden / Registrieren',
    dashboard: 'Übersicht',
    zeroUploadNotice: 'Ihre Dateien bleiben auf Ihrem Gerät und werden nie hochgeladen.',
    upgradeToUnlock: 'Upgrade zum Freischalten',
    proceedToPayment: 'Weiter zur sicheren Zahlung',
    wipeLocalData: 'Lokale Gerätedaten löschen',
  },
  ja: {
    brandTagline: 'お使いの端末内で完結する、プライベートな画像・文書・ID・印刷スタジオ。',
    navStudios: 'スタジオ',
    navPresets: 'プリセット',
    navPlans: 'プラン',
    navHelp: 'サポート',
    signInSignUp: 'サインイン / 登録',
    dashboard: 'マイページ',
    zeroUploadNotice: 'ファイルは端末内でのみ処理され、外部へ送信されることはありません。',
    upgradeToUnlock: 'アップグレードして解除',
    proceedToPayment: '安全な決済へ進む',
    wipeLocalData: '端末内データを消去',
  },
  ar: {
    brandTagline: 'استوديوهات خاصة وفورية للصور والمستندات والبطاقات والطباعة على جهازك مباشرة.',
    navStudios: 'الاستوديوهات',
    navPresets: 'القوالب',
    navPlans: 'الخطط',
    navHelp: 'المساعدة',
    signInSignUp: 'تسجيل الدخول / إنشاء حساب',
    dashboard: 'لوحة التحكم',
    zeroUploadNotice: 'تبقى ملفاتك على جهازك ولا يتم رفعها إلى أي خادم أبداً.',
    upgradeToUnlock: 'قم بالترقية للفتح',
    proceedToPayment: 'المتابعة للدفع الآمن',
    wipeLocalData: 'مسح البيانات المحلية',
  },
};
