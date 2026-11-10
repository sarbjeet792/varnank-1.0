# Varnank Studios — Master Blueprint & Phase 1 Architecture Plan

**Varnank Studios** is a privacy-first, zero-upload browser-side web platform spanning four specialized studios (**Photo/Image Studio**, **PDF Studio**, **ID/Govt. ID Studio**, and **Print & Publication Studio**). Every file, preview, and export is processed 100% locally on the user's device, paired with a minimal Cloudflare Free Plan edge control plane strictly for accounts, sessions, country-code currency lock (`INR` / `USD`), server-computed offers and pricing, webhook-verified entitlements, gated paid-bundle delivery, hidden category-isolated admin consoles, and an encrypted secrets vault.

---

## User Review & Critical Decisions (Phase 0 Complete Decision Log: Categories A–S)

> [!IMPORTANT]
> All 19 discovery categories (**A through S**) from Phase 0 are locked below based on your confirmed selections. Review this Phase 1 Master Blueprint and click **Proceed** (or reply **APPROVED**) to authorize Phase 2 implementation.

| ID | Category | Confirmed Decision |
| :--- | :--- | :--- |
| **A1–A3** | **A. Identity & Purpose** | **Varnank Studios** \| Plain-language tagline (*"Private, instant creative and document studios on your device"*) \| Global launch with **multi-language UI pack from day one** (`en`, `hi`, `es`, `fr`, `de`, `ja`, `ar`). |
| **B1–B3** | **B. Theme & Branding** | **Light-first warm minimal workspace** (with instant Dark/System switch in preferences), text-led public layout (strictly no hero picture and no pane directly below it), original **VS** geometric vector monogram + full favicon set, **mobile-first responsive web app without offline PWA caching**. |
| **C1–C2** | **C. User Scope** | **18+ global users** (self-declared at signup), **B2C primary with optional GST invoice fields** for Indian business buyers, engineered for **2,000–10,000 DAU** within Cloudflare Free Tier limits. |
| **D1** | **D. Studios** | **4 Browser-Side Studios**: **1. Photo/Image Studio** (`S1`), **2. PDF Studio** (`S2`), **3. ID/Govt. ID Studio** (`S3`), **4. Print & Publication Studio** (`S4`). |
| **E1–E2** | **E. Tools & Limits** | **Free (Public Bundle)**: Single-file core tools (5 exports/day Guest, 20 exports/day Freemium). **Paid (Gated Server-Delivered Bundles)**: Batch processing, PDF redaction & metadata scrubbing, multi-ID print sheet generator, and pro publication bleed/crop-mark imposition. |
| **F1** | **F. Presets** | **Sizes, templates, and export profiles** (`P1..Pn`). Content/Presets Admins manage global free & gated paid presets; signed-in users can save custom personal presets locally on their device. |
| **G1** | **G. Functionings** | **20-step Undo/Redo stack**, local-only dashboard recent activity, **automatic memory wipe of ID/Govt. ID Studio buffers on close**, and chunked Web Worker batch mode. |
| **H1** | **H. Work Area** | **3-zone responsive workspace** (Top bar: file/undo/export; Center: drag-and-drop canvas with pinch-zoom/pan; Bottom on mobile / Side on desktop: tool & preset controls), keyboard shortcuts, auto-wipe temporary buffers on close. |
| **I1–I2** | **I. Input & Output** | **Input**: JPG, PNG, WebP, SVG, PDF, CSV/TXT via file picker, drag-and-drop, camera capture, or clipboard paste, protected by an **adaptive device-RAM guard** (50 MB mobile / 250 MB desktop warning). **Output**: JPG, PNG, WebP, SVG, PDF, print-ready A4/4x6/Letter sheets with crop/bleed marks, and ZIP (batch), saved via direct download or native mobile share. |
| **J1–J2** | **J. Privacy Options** | **Zero file or metadata telemetry**, strictly necessary HttpOnly session cookies only, explicit **DPDP Act 2023 (India) & GDPR consent** at signup, one-click local device wipe, immediate account erasure, **zero user analytics**. |
| **K1** | **K. Security Baseline** | **OWASP ASVS Level 2 alignment**, mandatory **Passkey + TOTP MFA for all Admins and Super User** (optional for users), concurrent session limits (**2 devices** for Per-Day/Paid, **4 devices** for Premium). |
| **L1** | **L. Admin Categories** | **7 Specialized Admin Categories** (*Finance*, *Support*, *Content/Presets*, *Tools/Studios*, *Security/Audit*, *Integrations/Secrets*, *Offers/Pricing*) + **1 Super User** with mandatory two-person approval for destructive actions and recovery approvals. |
| **M1–M2** | **M. User Plans** | **5 Tiers**: `Guest` (`NONE`), `Freemium` (`FREE`), `Paid Per-Day` (`PASS_24H`, 0h grace), `Paid` (`PRO_MONTHLY`, 48h renewal grace), `Premium` (`PREMIUM_ANNUAL`, 48h renewal grace). Paid features unlock **only after webhook confirms `ACTIVE`**. |
| **N1–N2** | **N. Payments** | **INR (`₹`) + USD (`$`) at launch**, tax-inclusive pricing display, sequential GST-compliant invoices, immediate revocation on refund/dispute webhook, **no coupon codes at launch**. |
| **O1** | **O. Repositories & Deploy** | **4-repo logical isolation** (`PUBLIC-APP`, `CONTROL-PLANE`, `PAID-BUNDLES`, `ADMIN-CONSOLE`), `main` → Production, other branches → Preview, deployment restricted to Owner / Super User. |
| **P1–P2** | **P. Sign-In & Recovery** | Unified **"Sign in / Sign up"** button (default Sign In). **Passkeys (WebAuthn)** active immediately; **Email OTP**, **Google OAuth (PKCE)**, and **Client-Hashed Password** ( plus optional Apple/SMS/X adapters) remain **off/hidden until keyed in the Admin Vault**. All **4 layered recovery paths** enabled. |
| **Q1** | **Q. User Area** | Full **Section U User Area** (Home/Dashboard, Profile, Account with read-only currency note, Billing hidden until first purchase, Upgrade hidden on top plan) + **Admin Notices** + **Help/Support ticket section**. |
| **R1** | **R. Currency & Offers** | `+91 (IN)` → **INR (`₹`)**; all other country codes → **USD (`$`)** fallback. **Indicative prices shown to guests before signup** (with clear plain-language note that final account currency is fixed from the country code selected at signup). **5 non-coupon Offer Templates** included. |
| **S1** | **S. Brand & Visuals** | Original **VS** geometric vector monogram + favicon pack, abstract non-human animated vector visuals, **Lucide Icons (ISC License)** recorded in Admin Technical Registry, and **alphanumeric placeholders** (`Studio S1..S4`, `Tool T1..Tn`, `Preset P1..Pn`, `ID-P1`, `Plan L1..L4`). |

---

## 1. Overview & Core Concept

### What It Does
Varnank Studios provides instant, studio-grade creative and document tools directly in the user's browser across four specialized workspaces:
1. **Photo/Image Studio (`S1`)**: Crop, resize, aspect-ratio frame, compress, format-convert, color-balance, and batch-watermark images.
2. **PDF Studio (`S2`)**: Merge, split, reorder, rotate, compress, convert images-to-PDF, and (in gated Paid bundles) permanently redact sensitive regions, scrub metadata, and batch-stamp documents.
3. **ID/Govt. ID Studio (`S3`)**: Format photo & signature dimensions using standard alphanumeric size presets (`ID-P1` Passport size, `ID-P2` Pan/Card size, `ID-P3` Signature strip), apply compliant neutral backgrounds, and (in gated Paid bundles) generate ready-to-print multi-copy A4 / 4×6 photo sheets with cut guides. All buffers auto-wipe on close.
4. **Print & Publication Studio (`S4`)**: Compose vector badges, flyers, cards, and multi-page layouts using neutral templates (`Preset P1..Pn`), and (in gated Paid bundles) export print-ready imposition sheets with bleed, trim, registration marks, and CMYK-safe contrast previews.

### Why a Minimal Control Plane Is Mandatory (Honest Security Proof — Principle 2)
Browser code runs on hardware controlled by the user. Anyone can open DevTools, edit `localStorage`, intercept network responses, or patch JavaScript conditionals. Therefore, **six critical functions cannot be made secure with browser code alone** and must live in the Edge Control Plane:
1. **Payment Confirmation**: A browser redirect URL (`/payment-success`) can be visited or forged by anyone. Only a cryptographic HMAC-verified server-to-server webhook from the payment gateway proves money was paid.
2. **Plan Enforcement & Paid Feature Delivery**: If paid tool code is shipped inside the public bundle behind an `if (isPaid)` check, any user can flip that boolean in DevTools. Paid tools must live outside the public bundle and be delivered by the server only after verifying an `ACTIVE` entitlement token.
3. **Sign-In & MFA Verification**: WebAuthn challenge verification, OAuth 2.0 PKCE client-secret token exchange, one-time code hashing, and TOTP verification require server-held state and secrets so attackers cannot mint their own sessions.
4. **Pricing & Offer Computation**: If the browser calculates discounts or currency conversions, a user can tamper with the request payload to pay `0.01`. The server must compute the final price from its database and sign the order snapshot.
5. **Hidden Admin Console & RBAC**: Shipping admin UI in the public bundle leaks internal routes, capabilities, and technical schemas. Admin console modules must be served dynamically only after category-specific Passkey + MFA authentication.
6. **Permanent Account Erasure & Revocation**: Revoking stolen refresh tokens, enforcing concurrent device caps, and erasing server-side identity records require authoritative server state.

---

## 2. User Experience & Visual Design

### Visual Identity & Theme (`frontend-design` Compliant)
- **Aesthetic Direction**: **Light-First Warm Minimal Editorial Workspace** with a full **Dark Mode (`@custom-variant dark`)** counterpart selectable in user preferences.
- **No Hero Image & No Pane Below It (Section D)**: The public landing page opens with a clean, text-led typographic header and immediate studio selector—no hero photography, no decorative banner pane below it, no human/AI portraits, and no status/telemetry tickers.
- **60-30-10 Color Token System**:
  - *Light Mode*: **60% Canvas** Warm Alabaster (`#FAF8F5`), **30% Structural Surface** Pure Ivory (`#FFFFFF`) with subtle Warm Stone borders (`#E7E2DA`), **10% Primary Accent** Deep Terracotta Ink (`#B44C32`) and Charcoal Ink (`#181615`) for primary typography (WCAG AAA contrast).
  - *Dark Mode*: **60% Canvas** Obsidian Warm Slate (`#121110`), **30% Structural Surface** Charcoal Surface (`#1C1A18`) with hairline borders (`#2E2B28`), **10% Primary Accent** Warm Amber Coral (`#E06D53`) and Crisp Bone text (`#F5F2EB`).
  - *Semantic Status Pairs (Icon + Text + Color)*: Active/Verified (`#15803D`), Pending/Warning (`#B45309`), Error/Revoked (`#B91C1C`).
- **Typography & Tabular Discipline (2+1 Self-Hosted Permissive Fonts)**:
  - *Display & Headings*: **Plus Jakarta Sans** (OFL-1.1, SemiBold 600 / Bold 700, `text-wrap: balance`).
  - *Body & Plain-Language Controls*: **DM Sans** (OFL-1.1, Regular 400 / Medium 500).
  - *Metrics, Usage Counters, Invoices & Dimensions*: **JetBrains Mono** (`tabular-nums`, OFL-1.1).
- **Top Bar Contract & Mobile Ergonomics**:
  - Strict 3-zone header: **Zone 1**: `VS` vector monogram + `Varnank Studios` single-line wordmark; **Zone 2**: 4 single-line links (`Studios`, `Presets`, `Plans`, `Help`); **Zone 3**: Single primary CTA (`Sign in / Sign up` for guests, or `Dashboard` for signed-in users).
  - All interactive touch targets enforce $\ge 44 \times 44\text{px}$ hitboxes, and sticky headers stay under **15% of mobile viewport height**.
- **Strict Hidden Technical Details (Principle 5)**:
  - Guest and user screens never mention WebAssembly, Web Workers, Cloudflare, D1, SQLite, WebAuthn, OAuth, PKCE, Razorpay, SHA-256, or library names/versions.
  - Errors display a calm plain-language message with a short reference code only (e.g., *"We couldn't complete that step. Please try again. Ref: ERR-7F3A"*), which Support/Security Admins can look up in the Admin Console.

---

## 3. Phase 1 Blueprint Deliverables (Items 1–18)

### Blueprint Item 1: Architecture & Zero-Upload Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                    USER DEVICE (100% ZERO-UPLOAD BROWSER SANDBOX)                       │
│                                                                                         │
│  ┌──────────────────────┐    Local File / Camera / Paste     ┌───────────────────────┐  │
│  │  User Files & Media  │ ─────────────────────────────────► │  In-Memory / OPFS     │  │
│  │ (NEVER leaves device)│                                    │  Temp Buffer (AutoWipe)│  │
│  └──────────────────────┘                                    └───────────┬───────────┘  │
│                                                                          │              │
│  ┌───────────────────────────────────────────────────────────────────────▼───────────┐  │
│  │                  SANDBOXED WEB WORKERS (Zero Network Access)                      │  │
│  │  • Studio S1: Photo/Image Engine        • Studio S3: ID/Govt. ID Sheet Engine     │  │
│  │  • Studio S2: PDF Merge/Split/Redact    • Studio S4: Print & Publication Engine   │  │
│  └──────────────────┬────────────────────────────────────────────────────▲───────────┘  │
│                     │ Direct Local Blob Download / Native Share          │              │
│                     ▼                                                    │              │
│  ┌──────────────────────┐                                    ┌───────────┴───────────┐  │
│  │  Exported Output     │                                    │ Gated Paid Bundle RAM │  │
│  │ (Saved to User Disk) │                                    │ Loader (Session-Bound)│  │
│  └──────────────────────┘                                    └───────────▲───────────┘  │
└──────────────────────────────────────────────────────────────────────────┼──────────────┘
                                                                           │
              ONLY Account/Session, Country->Currency, Price Snapshot,     │ Short-Lived
              Webhook Status, & Signed Paid-Bundle Code Cross Network      │ Signed Token
              (ZERO User Files, ZERO File Names, ZERO Previews/Metadata)   │ (HTTPS Only)
                                                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                     MINIMAL EDGE CONTROL PLANE (CLOUDFLARE FREE PLAN)                   │
│                                                                                         │
│  ┌──────────────────────┐   ┌────────────────────────┐   ┌───────────────────────────┐  │
│  │ Identity & Session   │   │ Pricing, Offers &      │   │ Entitlement & Gated       │  │
│  │ Engine (Passkey/OTP/ │   │ Order Engine           │   │ Bundle Delivery Service   │  │
│  │ OAuth PKCE/Recovery) │   │ (+91->INR / USD Lock)  │   │ (ACTIVE Plan Check Only)  │  │
│  └──────────┬───────────┘   └───────────┬────────────┘   └─────────────┬─────────────┘  │
│             │                           │                              │                │
│             ▼                           ▼                              ▼                │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐  │
│  │          CLOUDFLARE D1 (SQLite) + ENCRYPTED SECRETS VAULT (AES-256-GCM)           │  │
│  │   Users, Sessions, Country-Currency Map, Plans, Offers, Orders, Append-Only Audit │  │
│  └──────────────────────────────────────▲────────────────────────────────────────────┘  │
│                                         │                                               │
│  ┌──────────────────────────────────────┴────────────────────────────────────────────┐  │
│  │       CATEGORY-ISOLATED HIDDEN ADMIN CONSOLES (7 Admin Roles + Super User)        │  │
│  │   Unguessable Entry Route + Mandatory Passkey & TOTP MFA + 2-Person Approval      │  │
│  └───────────────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### Blueprint Item 2: Cloudflare Free-Plan Fit Report (Verified Current Quotas)

| Cloudflare Service | Verified Current Free Limit | Expected Usage (at 2k–10k DAU) | What Breaks at the Limit | Risk Note & Mitigation / Exit Path |
| :--- | :--- | :--- | :--- | :--- |
| **Cloudflare Pages** (Public App Hosting) | **Unlimited** static requests & bandwidth; **500 builds/month**; 20,000 files/deploy; 25 MiB max per file | 100% of public HTML/CSS/JS/WASM assets and free tools served by Pages CDN (0 Worker calls for Guest/Free tool execution) | Exceeding 500 Git pushes/month pauses automated builds until next billing month | **Low Risk**: Batch commits on feature branches; static traffic is unlimited and free. |
| **Cloudflare Workers** (Control Plane API) | **100,000 requests/day** (resets 00:00 UTC); **10 ms CPU time/request**; 128 MB RAM per isolate | ~15k–45k req/day (invoked only for sign-in, session refresh, price quotes, webhooks, and gated bundle fetches) | Requests past 100k/day return HTTP error until 00:00 UTC; CPU >10ms terminates isolate | **Medium Risk (CPU)**: Server-side Argon2 exceeds 10ms CPU; mitigated by WebAuthn passkeys + client-side WebCrypto PBKDF2 pre-hashing + server HMAC-SHA256 (<1ms CPU). |
| **Cloudflare D1** (Relational SQLite DB) | **500 MB** per DB (5 GB total); **5,000,000 row reads/day**; **100,000 row writes/day**; 7-day Time Travel | ~80k row reads/day, ~10k writes/day, ~25 MB/year storage (zero files stored) | Unindexed table scans burn the 5M row-read quota rapidly; >100k writes/day rejects writes | **Medium Risk (Row Reads)**: Every query uses strict primary/composite indexes (`idx_sessions_token`, `idx_orders_user`). Audit logs archive/export monthly to stay well under 500 MB. |
| **Cloudflare R2** (Gated Paid Bundles & Backups) | **10 GB-month storage**; **1M Class A writes/mo**; **10M Class B reads/mo**; **$0 egress** | <50 MB total for compiled paid tool bundles + encrypted DB backups | Requests above 10M reads/mo pause until reset | **Very Low Risk**: Paid bundles are tiny (<2 MB total) and served via Worker stream. |
| **Workers KV** (Rate Limits & Nonces) | **100,000 reads/day**; **1,000 writes/day**; 1 GB storage | Used sparingly for public config cache; high-frequency OTP/nonce state uses D1 (100k writes/day) instead of KV (1k writes/day) | KV fails fast if used for per-login write counters (>1,000/day) | **Critical Mitigation**: Store OTP challenges, OAuth `state`/`nonce`, and rate-limit buckets in **D1** (100,000 writes/day) or isolate memory rather than KV's 1,000 write/day limit. |

---

### Blueprint Item 3: Open-Source Stack Table (Permissive Licenses Only)

| Library / Package | License | Purpose | Free-Tier Impact | Permissive Alternative |
| :--- | :--- | :--- | :--- | :--- |
| **React 19 + Vite** | MIT | Client UI & modular studio code-splitting | Compiles to static assets on Pages ($0 runtime cost) | Preact (MIT) |
| **Tailwind CSS v4** | MIT | Design tokens, warm-minimal light/dark styling | Zero runtime JS overhead | Vanilla CSS / UnoCSS (MIT) |
| **Lucide React** | ISC | Single permissive icon pack across studios | Tree-shaken SVG paths (<15 KB) | Phosphor Icons (MIT) |
| **pdf-lib** | MIT | Browser-side PDF merge, split, page reorder, stamp, print sheet generation | Runs 100% in client Web Worker (0 server CPU) | jsPDF (MIT) |
| **fflate** | MIT | Ultra-fast browser-side ZIP compression for paid batch exports | Runs 100% in client Web Worker (~8 KB bundle) | JSZip (MIT) |
| **Web Crypto API + Native Canvas / OffscreenCanvas** | W3C Standard | Client-side AES-256-GCM, SHA-256, PBKDF2, image resize/crop/format/redaction | Zero bundle size, hardware-accelerated on device | `@noble/hashes` (MIT) |
| **SimpleWebAuthn (or Native WebAuthn + CBOR helper)** | MIT | Passkey registration & assertion verification in under 1ms Worker CPU | Minimal Worker CPU (<1.5ms per verify) | Custom WebCrypto P-256 verifier |

*(Note: All licenses and version records are stored in the Admin Technical Registry and stripped from the public bundle).*

---

### Blueprint Item 4: 4-Repository Logical Isolation Architecture (Section G)

To maximize Cloudflare Free Plan efficiency while maintaining strict security boundaries, the platform is organized into **4 isolated logical repositories/packages** with automated CI isolation gates:

| Logical Repository | Visibility | Deployment Target | Contents & Strict Isolation Rule |
| :--- | :--- | :--- | :--- |
| **1. `PUBLIC-APP`** | Public or Private | Cloudflare Pages | Public landing, 4 Studio shells, Free tool workers, Unified Sign-in/up UI, User Area. **Contains ZERO paid tool logic, ZERO admin UI, ZERO technical docs, and ZERO secrets.** |
| **2. `CONTROL-PLANE`** | Private | Cloudflare Workers + D1 | Identity/Passkey/OTP/OAuth PKCE, Country->Currency lock, Server Price/Offer calculator, Payment Webhook verifier, Entitlement Token signer, Encrypted Secrets Vault, Audit Logger. |
| **3. `PAID-BUNDLES`** | Private | Private R2 / Control-Plane Gated Store | Compiled Web Worker & UI modules for Paid/Premium tools (Batch engine, PDF Redactor/Metadata Scrubber, Multi-ID Sheet Imposition, Pro Print Bleed/Marks). **Never publicly addressable.** |
| **4. `ADMIN-CONSOLE`** | Private | Delivered dynamically by Control-Plane | Role-scoped Admin UI modules for the 7 Admin categories + Super User. **Served only after category-specific unguessable route + Passkey + TOTP MFA verification.** |

---

### Blueprint Item 5: Sitemap & End-to-End User Flows

- **Public & Guest Routes**:
  - `/` — Text-led home workspace & Studio launcher (Photo/Image, PDF, ID/Govt. ID, Print & Publication)
  - `/studio/:studioId` — 3-Zone Studio Editor (Free tools active; Paid tools show plain *"Upgrade to unlock"* card)
  - `/presets` — Browse standard sizes, templates, and export profiles (`P1..Pn`)
  - `/plans` — Plan comparison with **indicative prices shown to guests** and a plain note: *"Final billing currency (INR or USD) is fixed once when you select your country code at sign-up."*
  - `/auth` — Unified **"Sign in / Sign up"** screen (default mode: Sign In) + Complete Sign-Up step + Recovery flows
  - `/legal/privacy`, `/legal/terms`, `/legal/consent` — Plain-language DPDP Act 2023 & GDPR notices
- **Authenticated User Area Routes (`/app/*`)**:
  - `/app/dashboard` — Current plan status, expiry/renewal date, daily usage meters, quick studio launch, local-only recent activity (with Clear button), conditional Upgrade prompt, conditional Admin Notices
  - `/app/profile` — Display name/handle, abstract geometric or initial avatar (no photo upload), UI language selector, Light/Dark/System theme, default studio preferences, linked sign-in methods
  - `/app/account` — Plan & Billing (hidden if user has never purchased), read-only locked currency + explanation, Security (Passkeys, active device sessions with remote logout, MFA, 10-code Recovery Kit), Privacy (consent toggles, export my data JSON, wipe local device data, immediate Delete Account)
  - `/app/support` — Help & Support ticket submission and status tracker
- **Payment Verification Route**:
  - `/app/payment-status?order=...` — Displays *"Payment verification in progress..."* and polls server plan state; **never activates any entitlement itself**.
- **Hidden Admin Console Routes (Zero links in public bundle)**:
  - `/_cp/portal/:categorySlug` — Separate unguessable entry per Admin Category (`finance`, `support`, `content-presets`, `tools-studios`, `security-audit`, `integrations-vault`, `offers-pricing`, and `super-authority`). Any unauthenticated or mismatched request returns a generic `404 Not Found`.

---

### Blueprint Item 6: Control Plane Data Model (Cloudflare D1 / SQLite)

1. **`users`**: `id` (UUID), `handle`, `avatar_code`, `country_code` (locked at signup, e.g., `+91`), `currency` (locked `INR` or `USD`), `language`, `theme`, `mfa_enabled`, `mfa_secret_enc`, `role_category` (`USER`, or Admin category), `status` (`ACTIVE`, `SUSPENDED`), `consent_version`, `created_at`, `updated_at`.
2. **`auth_identities`**: `id`, `user_id`, `provider` (`PASSKEY`, `EMAIL_OTP`, `GOOGLE`, `APPLE`, `X`, `PASSWORD_HASH`, `SMS_OTP`), `provider_uid` (indexed), `credential_data_enc` (public key or derived verifier), `verified_at`, `last_used_at`.
3. **`recovery_codes`**: `id`, `user_id`, `code_sha256`, `used_at`.
4. **`sessions`**: `id`, `user_id`, `scope` (`USER` or specific Admin category), `refresh_token_sha256`, `device_label`, `ip_hash`, `expires_at`, `revoked_at`.
5. **`country_currency_map`**: `country_code` (PK, e.g., `+91`, `+1`, `+44`, `DEFAULT`), `country_name`, `currency_code` (`INR` or `USD`), `updated_by`, `updated_at`.
6. **`plans`**: `id` (`NONE`, `FREE`, `PASS_24H`, `PRO_MONTHLY`, `PREMIUM_ANNUAL`), `code_label` (`L0`..`L4`), `display_name`, `duration_hours`, `grace_hours`, `max_devices`, `daily_limit`, `batch_limit`, `is_active`.
7. **`plan_prices`**: `plan_id`, `currency_code` (`INR`, `USD`), `base_price_minor` (paise/cents), `slashed_base_price_minor` (verified historical listed price), `tax_inclusive` (boolean), `updated_by`, `updated_at`.
8. **`offers`**: `id`, `template_type` (`PERCENTAGE`, `FLAT_AMOUNT`, `FIRST_PURCHASE`, `SEASONAL`, `FLASH_COUNTDOWN`), `title`, `plain_explanation`, `badge_text`, `target_plan_ids_json`, `discount_type`, `discount_value_inr`, `discount_value_usd`, `starts_at`, `ends_at`, `max_uses`, `current_uses`, `stacking_rule`, `status` (`DRAFT`, `PENDING_APPROVAL`, `PUBLISHED`, `PAUSED`, `REVOKED`), `created_by`, `approved_by`.
9. **`orders`**: `id`, `user_id`, `plan_id`, `offer_id`, `currency_code`, `base_amount_minor`, `discount_amount_minor`, `tax_amount_minor`, `final_amount_minor`, `price_snapshot_sig` (HMAC-SHA256), `buyer_gstin` (optional), `gateway_order_id`, `state` (`PENDING`, `PAID`, `FAILED`, `REFUNDED`, `DISPUTED`), `created_at`.
10. **`entitlements`**: `user_id` (PK), `plan_id`, `state` (`NONE`, `PENDING`, `ACTIVE`, `GRACE`, `EXPIRED`, `CANCELLED`, `REFUNDED`, `REVOKED`), `activated_at`, `expires_at`, `grace_ends_at`, `last_order_id`, `updated_by`.
11. **`webhook_events`**: `event_id` (PK, idempotency key), `gateway_type`, `order_id`, `payload_sha256`, `signature_valid`, `processed_at`, `outcome`.
12. **`anonymized_tax_ledger`**: `invoice_number`, `financial_year`, `country_code`, `currency_code`, `net_amount_minor`, `gst_amount_minor`, `total_amount_minor`, `buyer_gstin`, `recorded_at` *(Retained on account deletion per Indian tax law; contains zero `user_id`, email, or personal identifiers)*.
13. **`secrets_vault`**: `key_name` (PK), `tier` (`TIER_2`), `provider_group`, `ciphertext_b64`, `iv_b64`, `key_version`, `is_enabled`, `mode` (`MOCK`, `TEST`, `LIVE`), `rotated_by`, `rotated_at`.
14. **`support_tickets` & `recovery_requests`**: `id`, `user_id`, `subject`, `status`, `checklist_verified_by` (Support Admin), `approved_by` (Super User), `unlock_after` (cooling-off timestamp).
15. **`audit_logs` (Append-Only)**: `id`, `timestamp`, `actor_id`, `actor_role`, `action_type`, `target_type`, `target_id`, `reason`, `ip_hash`, `prev_entry_sha256`, `entry_sha256` (hash-chained tamper-evident log).

---

### Blueprint Item 7: Role & Permission Matrix (Every Role × Every Action)

| Action / Module | Guest | Freemium User | Paid / Premium User | Finance Admin | Support Admin | Content / Presets Admin | Tools / Studios Admin | Security / Audit Admin | Integrations / Vault Admin | Offers / Pricing Admin | Super User |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Use Free Studio Tools (100% Browser) | Yes (5/d) | Yes (20/d) | Unlimited | — | — | — | — | — | — | — | Yes |
| Fetch & Run Gated Paid Tool Bundles | **No** | **No** | **Yes (`ACTIVE`)** | — | — | — | Preview | — | — | — | Yes |
| Save Local Custom Presets | No | Yes | Yes | — | — | — | — | — | — | — | Yes |
| Manage Own Profile, Passkeys, Wipe Data, Delete Account | — | Yes | Yes | Own | Own | Own | Own | Own | Own | Own | Yes |
| View Orders, Invoices, GST & Issue Refunds | No | Own | Own | **Yes** | Read-Only | No | No | Audit Only | No | No | **Yes** |
| Handle Support Tickets & Admin Notices | No | Own | Own | No | **Yes** | No | No | No | No | No | **Yes** |
| Verify Recovery Checklist (Step 1 of 2) | No | No | No | No | **Yes (Step 1)** | No | No | Audit Only | No | No | **Approves (Step 2)** |
| Manage Global Sizes, Templates, Export Profiles & Translations | No | No | No | No | No | **Yes** | No | No | No | No | **Yes** |
| Toggle Studio/Tool Visibility, Limits & Asset License Registry | No | No | No | No | No | No | **Yes** | No | No | No | **Yes** |
| View Hash-Chained Audit Logs, Error Ref IDs & Session Lockouts | No | No | No | No | Ref ID Lookup | No | No | **Yes** | No | No | **Yes** |
| Add/Rotate/Revoke Encrypted Vault Keys & Run Test Checks | No | No | No | No | No | No | No | Audit Only | **Yes (MFA)** | No | **Yes (MFA)** |
| Manage Base Prices, Offers, Templates & Country-Currency Map | No | No | No | Read-Only | No | No | No | No | No | **Yes (MFA)** | **Yes (MFA)** |
| Create/Suspend Admins, Grant Time-Limited Roles, Kill Switches | No | No | No | No | No | No | No | No | No | No | **Super User Only** |

---

### Blueprint Item 8: Plan & Entitlement Matrix (Every Plan × Tool/Preset/Limit × State)

| Plan Tier (`code`) | Required State to Unlock | Daily Export Limit | Batch Mode Limit | Free Tools (`S1`–`S4`) | Gated Paid Tools (Redaction, Multi-ID Sheets, Bleed/Crop Marks) | Premium Automation & Priority Support | Grace Period (`GRACE`) | Max Concurrent Devices | Entitlement Token Lifetime |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Guest (`NONE`)** | Any | 5 / day | Disabled (1 file) | Included | **Locked** | **Locked** | 0 hours | 1 browser | N/A |
| **Freemium (`FREE`)** | Signed In | 20 / day | Disabled (1 file) | Included | **Locked** | **Locked** | 0 hours | 2 devices | Session |
| **Paid Per-Day (`PASS_24H`)** | **`ACTIVE` only** *(Never `PENDING`)* | Unlimited | Up to 20 files | Included | **Unlocked (24h)** | **Locked** | **0 hours** | 2 devices | **15 minutes** (rolling until 24h expiry) |
| **Paid (`PRO_MONTHLY`)** | **`ACTIVE` or `GRACE`** *(Never `PENDING`)* | Unlimited | Up to 50 files | Included | **Unlocked (30d)** | **Locked** | **48 hours** (renewal retry only) | 2 devices | **30 minutes** (rolling) |
| **Premium (`PREMIUM_ANNUAL`)** | **`ACTIVE` or `GRACE`** *(Never `PENDING`)* | Unlimited | Up to 100 files | Included | **Unlocked (365d)** | **Unlocked** | **48 hours** (renewal retry only) | 4 devices | **30 minutes** (rolling) |

*(Note: Any plan in `PENDING`, `EXPIRED`, `CANCELLED`, `REFUNDED`, or `REVOKED` state is immediately denied paid-bundle delivery and token refresh).*

---

### Blueprint Item 9: Entitlement Enforcement Design & Honest Residual Risk Analysis (Section E)

1. **How Gated Delivery Works**:
   - Paid tools (`T-Paid-1..n`) and paid preset packs (`P-Paid-1..n`) are compiled into separate module chunks stored in `PAID-BUNDLES` and served only by `/api/entitlements/bundle/:bundleId`.
   - Every request requires a valid `HttpOnly` session cookie **and** a short-lived HMAC-signed `X-Entitlement-Token` bound to `(user_id, session_id, plan_id, exp)`.
   - Before streaming the bundle, the Control Plane queries `entitlements` in D1 to confirm `state IN ('ACTIVE', 'GRACE')` and `expires_at > now()`.
2. **Honest List of What Can and Cannot Be Bypassed (Per Plan)**:
   - **Guest (`NONE`) Daily Counter (5/day)**: Enforced via signed server allowance cookie + client storage. *Honest limitation*: Because Guests are anonymous and we do not use invasive device fingerprinting or IP blocking (which breaks shared home/college Wi-Fi), a determined Guest who clears all site data/cookies in an incognito window can reset their 5-action counter. However, they can **never** access Paid tools or Paid presets because that code does not exist in the public bundle.
   - **Freemium (`FREE`) Daily Counter (20/day)**: Bound to the authenticated `user_id` on the Control Plane. Clearing browser cookies does **not** reset a Freemium user's counter.
   - **Paid Per-Day (`PASS_24H`) & Paid/Premium (`PRO_MONTHLY` / `PREMIUM_ANNUAL`)**:
     - *Cannot be bypassed by free/pending/expired users*: Calling `/api/entitlements/bundle/*` directly without a webhook-verified `ACTIVE` plan returns `403 Forbidden`.
     - *Honest residual risk once delivered to an entitled user*: While a user's `PASS_24H` plan is `ACTIVE`, their browser receives the JavaScript/WASM code for the paid tool to execute locally. A technically skilled user who paid for a 24-hour pass could keep their browser tab open without refreshing or save the raw JS chunk from DevTools before the 24 hours expire.
     - *Mitigations Implemented*:
       1. Paid bundles are loaded into volatile JavaScript memory (Blob/Function execution) with `Cache-Control: no-store, no-cache, max-age=0` (and zero Service Worker caching per your B3 choice).
       2. Every paid export action verifies a live 15-minute signed entitlement token timestamped by the Control Plane before finalizing batch/pro output packaging.
       3. Concurrent sessions are capped (2 devices for Per-Day/Paid) and abnormal token-refresh velocity across IPs triggers an automatic Security Admin flag.

---

### Blueprint Item 10: Identity Design, Account Linking & Recovery Architecture (Section A)

- **Unified Entry**: Single **"Sign in / Sign up"** button (default mode: **Sign In**).
- **Anti-Enumeration**: Submitting an email or initiating sign-in always returns the same neutral message (*"If this account is ready or requires verification, follow the next step shown"*). New accounts smoothly transition to the **Complete Sign-Up** screen (Country Code selection + DPDP/GDPR Terms checkbox) only after cryptographic proof (Passkey signature, verified OTP, or verified OAuth callback).
- **Vault-Gated Providers (Per Your P1 Decision)**:
  - **Passkeys (WebAuthn)**: Enabled out-of-the-box (free, zero third-party keys).
  - **Email OTP, Google OAuth 2.0 (PKCE), Client-Hashed Password, Apple, SMS, X**: Built with complete mock adapters in development and Vault-backed adapters in production; each method remains **automatically hidden on the Sign-In screen until an Integrations/Secrets Admin or Super User enables its key in the Vault**.
- **Safe Account Linking**: A user can link an additional sign-in method from `/app/profile` only after re-authenticating their current session and proving ownership of the new method. Unverified social emails never auto-merge accounts.
- **4-Layer Recovery**:
  1. Secondary linked login or backup Passkey device.
  2. **10-Code One-Time Recovery Kit** generated at signup (stored only as `SHA-256` hashes).
  3. **Admin-Assisted Recovery**: Support Admin completes identity verification checklist → Super User approves → 24-hour cooling-off delay with active session banner alerts.
  4. **Verified Email OTP** (when Email provider is active in Vault).

---

### Blueprint Item 11: STRIDE Threat Model & Mitigations

| Threat Scenario | STRIDE Category | Concrete Mitigation in Varnank Studios |
| :--- | :--- | :--- |
| **1. Forged Payment Success Page** | Elevation of Privilege / Tampering | Redirect URL (`/app/payment-status`) is read-only and never mutates DB state. Only `/api/webhooks/payment` with valid gateway HMAC signature sets `state = ACTIVE`. |
| **2. Replayed Payment Webhook** | Tampering / Repudiation | Every webhook `event_id` and timestamp is recorded in `webhook_events` (PK constraint). Duplicate `event_id` or stale timestamp (>5 min drift) is rejected and audit-logged. |
| **3. Token Theft (XSS / Network)** | Information Disclosure | Refresh tokens use `HttpOnly; Secure; SameSite=Strict` cookies; strict CSP blocks inline scripts and external origins; short 15–30 min access tokens. |
| **4. Token / Account Sharing** | Elevation of Privilege | `sessions` table enforces max 2 devices (`PASS_24H`/`PRO_MONTHLY`) or 4 devices (`PREMIUM_ANNUAL`). Exceeding limit revokes oldest session and flags Security Admin. |
| **5. Tampered Client / DevTools Edit** | Tampering / Elevation | Paid tools do not exist in the public bundle. Editing client state only changes UI labels; calling `/api/entitlements/bundle/*` still fails with `403` on the server. |
| **6. Expired-Plan Reuse** | Elevation of Privilege | Paid bundles use `Cache-Control: no-store`, zero offline PWA caching, and require a live 15-minute signed token check before pro/batch export completion. |
| **7. OAuth `state` / Redirect Tampering** | Spoofing | Server generates cryptographic `state`, `nonce`, and PKCE `code_verifier` stored in D1 with 10-min TTL and exact redirect URI allowlist matching. |
| **8. Account Takeover via Recovery** | Spoofing / Elevation | Recovery codes are 128-bit entropy hashed with SHA-256; Admin recovery requires 2-person approval (Support Admin + Super User) + 24h cooling-off window + session alerts. |
| **9. Social Account Hijack / Duplicate Accounts** | Spoofing | OAuth identities bind by immutable provider `sub` ID, never mutable display names or unverified emails. Linking requires active re-authentication. |
| **10. Account Enumeration** | Information Disclosure | Unified Sign-in/Sign-up endpoint returns identical response timing and neutral copy whether an identifier exists or is new. |
| **11. Country-Code / Currency Abuse** | Tampering | Currency is mapped once at Complete Sign-Up from the selected country code and locked (`readonly`) in `users.currency`. Gateway order currency must match `users.currency`. |
| **12. Price or Offer Tampering** | Tampering | Checkout endpoint accepts only `(plan_id, offer_id)`. Server computes final price from D1 `plan_prices` + `offers` and signs `price_snapshot_sig`. Client numbers are ignored. |
| **13. Technical-Detail Leakage to Users** | Information Disclosure | Production build strips comments/sourcemaps; error handler catches all exceptions and returns plain user message + short `ERR-XXXX` reference ID only. |

---

### Blueprint Item 12: User Area Map & Conditional Show/Hide Rules (Section U)

| User Area Section | Core Functions Included | Conditional Show / Hide Rule (UX Only — Server Enforced) |
| :--- | :--- | :--- |
| **Home / Dashboard** | Plan badge & status, expiry/renewal date, daily export meter (`tabular-nums`), quick launch to all 4 Studios, local-only recent activity list + *"Clear Activity"* button | **Upgrade Prompt**: Shown for `Guest`, `Freemium`, `PASS_24H`, and `PRO_MONTHLY`; **automatically hidden for `PREMIUM_ANNUAL` (top plan)**. **Admin Notices**: **Hidden when no active notice exists**. |
| **Profile** | Display handle, abstract geometric or initial-letter avatar picker (no photo upload), UI language switcher (`en`, `hi`, `es`, `fr`, `de`, `ja`, `ar`), Light/Dark/System theme toggle, default export format & unit preferences (`mm`/`in`/`px`), linked sign-in methods | Unconfigured Vault sign-in providers are **hidden** until enabled by Admin in the Vault. |
| **Account — Plan & Billing** | Current plan details, upgrade/downgrade controls, renewal/cancel toggle, payment history & downloadable GST/standard invoices in locked account currency | **Billing History & Invoices sub-panel is hidden for users who have never made a purchase**. **Upgrade button is hidden on top plan (`PREMIUM_ANNUAL`)**. |
| **Account — Currency Lock** | Read-only display of locked currency (`INR ₹` or `USD $`) with plain explanation: *"Prices are shown in [INR/USD] because you selected [Country Code] at sign-up. This is permanently set for your account."* | Read-only for all users; editable only by an eligible Admin with MFA re-auth, mandatory reason, and audit log entry. |
| **Account — Security** | Passkey management (register/remove), active sessions/devices list with *"Log out device"* button, optional TOTP MFA setup, 10-code Recovery Kit regeneration | Always visible to signed-in users. |
| **Account — Privacy & Erasure** | DPDP Act / GDPR consent status, *"Download My Account Data (JSON)"*, *"Wipe Local Device Data"*, and **"Delete Account"** with re-authentication | Immediate permanent erasure of personal data on confirmation (retaining only anonymized tax ledger rows if purchase history exists). |
| **Help & Support** | Submit support or recovery assistance ticket, view ticket replies and status | Included for all signed-in users (per your Q1 confirmation). |

---

### Blueprint Item 13: Country-Code → Currency Table, Guest Indicative Display & Lock Rules (Section C)

- **No Automatic Detection & No Currency Selector (Principle 10)**: We never read IP geolocation, `navigator.language`, or timezone to pick currency, and there is no currency switcher dropdown anywhere in the UI.
- **Guest Indicative Pricing (Per Your R1 Selection)**: On the public `/plans` screen, Guests see plan features and clearly labeled **indicative launch pricing (`INR ₹ / USD $`)** accompanied by a plain-language notice: *"Your account billing currency is set once when you choose your country code during sign-up (+91 India → INR ₹; all other country codes → USD $)."*
- **Country-Code Mapping Table (Admin-Managed in Console)**:
  - `+91 (India)` → **`INR` (`₹`)** (Tax-inclusive, GST invoice enabled).
  - `+1 (US/CA)`, `+44 (UK)`, `+61 (AU)`, `+65 (SG)`, `+971 (UAE)`, and `DEFAULT (All other codes)` → **`USD` (`$`)** (Fallback currency).
- **Signup Disclosure & Permanent Lock**: During Complete Sign-Up, selecting a country code immediately previews: *"Prices will be shown in [INR ₹ / USD $] because you selected [+91 / code]. This is set for your account."* Once submitted, `users.currency` is locked.

---

### Blueprint Item 14: Plans, Offers & Server-Side Pricing Engine (Section O)

- **Initial Admin-Managed Plan Table (Editable in Console)**:
  - `L0` **Guest**: Free (5 exports/day, single file, free tools).
  - `L1` **Freemium**: Free with account (20 exports/day, local presets & history).
  - `L2` **Paid Per-Day (`PASS_24H`)**: 24-hour full access to all 4 Studios' Paid bundles (Admin default seed: ₹49 / $1.99, slashed from ₹99 / $2.99).
  - `L3` **Paid Monthly (`PRO_MONTHLY`)**: 30-day full access + 50-file batch mode (Admin default seed: ₹299 / $6.99, slashed from ₹499 / $9.99).
  - `L4` **Premium Annual (`PREMIUM_ANNUAL`)**: 365-day full access + 100-file batch + Pro Print/ID automation + 4 devices (Admin default seed: ₹1,999 / $39.99, slashed from ₹3,499 / $69.99).
- **5 Predefined Non-Coupon Offer Templates (Per Your N2 & R1 Decisions)**:
  1. **Percentage Savings Template** (e.g., *"Save 40% on Annual Plan"*)
  2. **Flat Amount Off Template** (e.g., *"Flat ₹200 / $3 Off Monthly Plan"*)
  3. **First-Purchase Welcome Offer** (Automatically eligible only when user has 0 prior `PAID` orders)
  4. **Seasonal / Festival Offer** (Scheduled start/end window with tasteful ribbon badge)
  5. **Time-Limited Countdown Flash Offer** (Live expiry countdown + usage cap)
- **Consumer-Protection Discount Honesty (India Consumer Protection Act / E-Commerce Rules)**: The Offer Builder enforces that `slashed_base_price` must match a genuine recorded base price in `plan_prices`—never an inflated fictitious number.

---

### Blueprint Item 15: Brand Pack, Abstract Visuals & Alphanumeric Placeholder Scheme (Section D)

- **Logo & Favicon Set**: Custom geometric vector monogram **`VS`** for **Varnank Studios** rendered in crisp SVG across the header, favicon (`favicon.svg`, `icon-192.png`, `icon-512.png`), and invoice header, with an Admin upload slot to swap in a custom SVG brand mark anytime.
- **Abstract Non-Human Visuals**: Studio cards and empty-state illustrations use pure geometric SVG diagrams (crop grids, page-fold vectors, ID dimension guides, print trim marks)—zero human photos, zero AI portraits.
- **Alphanumeric Sample & Seed Scheme**:
  - Studios: `Studio S1` (Photo/Image), `Studio S2` (PDF), `Studio S3` (ID/Govt. ID), `Studio S4` (Print & Publication)
  - Tools: `Tool T1..T16`
  - Presets: `Preset P1` (35×45mm ID Standard), `Preset P2` (50×50mm Square ID), `Preset P3` (A4 8-up ID Sheet), `Preset P4` (A4 Print Bleed 3mm), `Preset P5` (Web High-Efficiency Export)
  - Plans: `Plan L0..L4`

---

### Blueprint Item 16: Keys & Environment Map (Two-Tier Architecture — Section K)

| Key / Binding Name | Tier | Purpose | Who Sets It & Where | Behavior When Missing (Zero-Secret Build) |
| :--- | :--- | :--- | :--- | :--- |
| `VAULT_MASTER_KEY` | **Tier 1 (Deployment)** | 256-bit AES-GCM master key that encrypts Tier 2 secrets in D1 | Owner sets in Cloudflare Worker Secrets (`wrangler secret put`) in Phase 8 | Vault runs in safe read-only/mock development state; app builds & deploys cleanly |
| `SESSION_HMAC_SECRET` | **Tier 1 (Deployment)** | Signs session tokens, CSRF tokens, and order price snapshots | Owner sets in Cloudflare Worker Secrets in Phase 8 | Ephemeral per-boot random key used in local dev; warning shown in Admin Technical status |
| `ENTITLEMENT_SIGNING_KEY` | **Tier 1 (Deployment)** | Signs short-lived gated bundle access tokens | Owner sets in Cloudflare Worker Secrets in Phase 8 | Ephemeral dev signing key used in local dev |
| `PAYMENT_GATEWAY_KEY_ID` & `SECRET` | **Tier 2 (Admin Vault)** | Creates payment orders behind the provider-agnostic checkout adapter | **Integrations/Secrets Admin** or **Super User** enters in Admin Vault (starts in `TEST` mode) | Checkout uses the **Safe Mock Payment Adapter** (simulates success/pending/fail/refund webhooks) |
| `PAYMENT_WEBHOOK_SECRET` | **Tier 2 (Admin Vault)** | Verifies HMAC signature on incoming server-to-server payment webhooks | **Integrations/Secrets Admin** or **Super User** enters in Admin Vault | Verified against Mock Webhook Signer in dev/test mode |
| `GOOGLE_CLIENT_ID` & `SECRET` | **Tier 2 (Admin Vault)** | Google OAuth 2.0 + PKCE login | **Integrations/Secrets Admin** or **Super User** enters in Admin Vault | *"Continue with Google"* button stays **hidden** on Sign-In screen |
| `EMAIL_PROVIDER_API_KEY` | **Tier 2 (Admin Vault)** | Sends 6-digit Email OTP verification codes | **Integrations/Secrets Admin** or **Super User** enters in Admin Vault | Email OTP option stays **hidden** on Sign-In screen (or uses Mock Inbox in dev mode) |
| `PASSWORD_PEPPER_SECRET` | **Tier 2 (Admin Vault)** | Server-side HMAC pepper for client-prehashed passwords | **Integrations/Secrets Admin** or **Super User** enables in Admin Vault | Password login option stays **hidden** on Sign-In screen until enabled |
| `APPLE_*` / `SMS_*` / `X_*` | **Tier 2 (Admin Vault)** | Optional social/SMS adapters | Kept **disabled/unconfigured** per P1 decision unless added later | Corresponding buttons stay **hidden** |

---

### Blueprint Item 17: Finalized Master Flowcharts (Section F — Confirmed Source of Truth)

All 8 flowcharts from Section F (**Chart 1: Phase Flow**, **Chart 2: Unified Sign-In / Sign-Up**, **Chart 3: Pricing, Payment & Webhook Activation**, **Chart 4: Paid Bundle Access & Expiry**, **Chart 5: Hidden Admin Console Access**, **Chart 6: Admin Offer Lifecycle**, **Chart 7: Account Deletion & Anonymized Tax Retention**, and **Chart 8: Guided Keys Setup Procedure**) are verified without contradiction against your Phase 0 decisions:

```
[CHART 2 & 3 & 4 INTEGRATED RUNTIME SEQUENCE]

Guest Opens App ──► Sees 4 Studios + Indicative Prices (INR/USD)
       │
       ▼
Clicks "Sign in / Sign up" (Default: Sign In)
       │
       ├──► Existing User ──► Passkey / Enabled Vault Method ──► Session Created
       │
       └──► New User ──► Complete Sign-Up: Pick Country Code (+91 -> INR, Others -> USD)
                              + Accept DPDP/GDPR Consent
                              │
                              ▼
                   Currency Locked Forever + 10-Code Recovery Kit Generated
                              │
                              ▼
                   User Selects Plan (L2 Per-Day / L3 Paid / L4 Premium)
                              │
                              ▼
                   Control Plane Computes Price + Active Offer in Locked Currency
                   ──► Creates Order (State = PENDING, Signed Snapshot)
                              │
                              ▼
                   "Proceed to Secure Payment" ──► Return Page Polls Plan State
                              │                    (NEVER unlocks on redirect)
                              ▼
                   Server-to-Server Webhook Arrives ──► Verify HMAC + Idempotency
                   + Amount + Currency + Order + User Match
                              │
                              ▼
                   Set Entitlement = ACTIVE + Audit Log ──► Issue Short-Lived Token
                              │
                              ▼
                   Paid Studio Bundles Delivered to Browser RAM (Zero Offline Cache)
```

---

### Blueprint Item 18: Phase-Wise Execution Roadmap (Phases 2–8)

1. **Phase 2: Foundation**: Edge Control Plane (`server.ts` / Cloudflare Worker compatible API + SQLite/D1 schema), encrypted Secrets Vault, WebAuthn Passkey + Vault-gated Identity adapters, RBAC engine, Country-Currency lock service, Server Pricing & Entitlement service, hash-chained Audit Log, strict CSP headers, warm-minimal design tokens, `VS` vector monogram pack, and one-time Super User bootstrap.
2. **Phase 3: Public Site & User Area**: Text-led landing page, unified Sign-In/Sign-Up & Recovery flows, indicative guest pricing + signup currency lock disclosure, and full Section U User Area (Dashboard, Profile, Account, Admin Notices, Help/Support, Data Export, Local Wipe, Immediate Account Deletion).
3. **Phase 4: Studios, Tools & Presets (100% Browser-Side)**:
   - **Photo/Image Studio (`S1`)**, **PDF Studio (`S2`)**, **ID/Govt. ID Studio (`S3`)**, and **Print & Publication Studio (`S4`)**.
   - Free tools in public bundle; Paid tools (Batch engine, PDF Redaction & Metadata Scrubber, Multi-ID Print Sheet Generator, Print Bleed/Crop-Mark Imposition) isolated in gated server-delivered bundles with adaptive device-RAM guard and automatic ID-buffer cleanup.
4. **Phase 5: Pricing, Offers & Payments**: Server-side price snapshot engine, 5 Offer Templates, provider-agnostic Checkout ("Proceed to Secure Payment"), polling verification screen, and idempotent Webhook simulator/adapter for `ACTIVE`, `FAILED`, `REFUNDED`, and `DISPUTED` transitions + GST invoices.
5. **Phase 6: Hidden Admin System**: 7 category-isolated unguessable admin portals + Super User portal, Offer & Pricing Manager, Vault Manager, Support Recovery Checklist + 2-person Super User approval, and Admin-only Technical Area (free-plan quota monitor, `ERR-XXXX` reference lookup, hash-chained audit viewer, asset license registry).
6. **Phase 7: Hardening & Automated Testing**: Automated tests for RBAC escalation, webhook replay/tampering, price tampering, account enumeration, direct paid-bundle URL denial for Free/`PENDING`/`EXPIRED`/`REFUNDED` users, and public bundle technical-leakage inspection.
7. **Phase 8: Guided Keys Setup & Go-Live**: Step-by-step interactive walkthrough for Cloudflare & GitHub deployment and one-key-at-a-time Vault configuration.

---

## 4. Phase 1 Test & Verification Checklist
- [x] **Zero-Upload Guarantee**: All 4 Studios process files 100% in browser memory/Web Workers; zero file bytes or filenames ever touch the Control Plane.
- [x] **Cloudflare Free Plan Quotas Verified**: Workers (100k req/day, 10ms CPU), D1 (500 MB, 5M reads/day, 100k writes/day), Pages (unlimited static bandwidth, 500 builds/mo), R2 (10 GB) verified and respected (OTP/nonces placed in D1 rather than KV's 1k write cap; client pre-hashing respects 10ms CPU limit).
- [x] **Section D & Principle 5 Enforced**: No hero image, no pane below hero, no portraits, alphanumeric sample placeholders, and zero technical jargon on user/guest screens.
- [x] **Section E & Principle 6 Enforced**: Paid tools are isolated from the public bundle and delivered only when entitlement state is `ACTIVE` after webhook verification.

**Reply APPROVED (or click Proceed) to continue to Phase 2.**
