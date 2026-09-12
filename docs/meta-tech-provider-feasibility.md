# Feasibility: Meta Tech Provider status + a "one-page WhatsApp setup" for client SaaS apps

**Status: research/decision doc — no implementation started.**
**Branch:** `feature/meta-tech-provider` (created, empty — implementation waits on sign-off of this doc).

## The question being answered

> Can a clinic SaaS platform embed a single WhatsApp setup page where a clinic enters its
> details, submits, and can then send appointment reminders/confirmations/follow-ups/reports —
> **without that clinic completing Meta Business Verification** — using the same architecture
> as `notify-sdk`?

**Short answer: Yes, with a caveat.** A clinic can send real WhatsApp messages without ever
completing Meta's formal Business Verification. What it *cannot* skip, verified or not, is
getting its own WhatsApp Business Account (WABA) and phone number provisioned under Meta —
verification and provisioning are two different things, and the doc below keeps them separate
because conflating them is where this kind of plan usually goes wrong.

---

## 1. Three things that get conflated under "Meta Business Verification" — keep them apart

| # | Thing | Mandatory to send at all? | What it unlocks |
|---|---|---|---|
| A | **A WABA + phone number exists**, registered to *some* Business Manager | **Yes, always** — no WABA, no sending, verified or not | Baseline ability to send any message |
| B | **Meta Business Verification** (the formal KYB doc-upload process — legal name, address, registration docs) | **No** — you can send without it | Lifts the default messaging tier ceiling, unlocks official/green-tick eligibility, required for Advanced Access permissions at the *platform* level |
| C | **Your app's own Tech Provider status** (business verification + App Review + Advanced Access, from the earlier console screenshot) | No — only needed if *you* want to programmatically onboard many clients via Embedded Signup instead of manual token paste | Lets clients onboard via OAuth instead of each one hand-creating a Meta app; raises your onboarding-throughput cap (10 → 200 new clients/7 days) |

So: a clinic can absolutely send messages under an **unverified** WABA. It just starts capped
at Meta's default tier:

| Tier (unverified, default) | Limit |
|---|---|
| Unique customers messaged | 250 / rolling 24h |
| Phone numbers | 2 |
| Templates | 250 |

That cap scales up automatically based on quality rating and volume even without formal
verification, but the ceiling is much higher and the climb is faster once verified. For most
small-to-mid clinics (a few dozen appointments/day), the unverified default tier is likely
sufficient on day one. It becomes a real constraint only once a clinic's daily unique-patient
contact volume approaches 250/day.

**What "partner-led business verification" (from the earlier research) actually buys you**: not
an exemption — it lets *you*, once you're a Select/Premier Solution Partner (a tier above plain
Tech Provider, requiring an established volume track record), submit a client's KYB documents
on their behalf so Meta decides in minutes instead of days. It's still verification, just with
you as the intermediary, capped at 3 submission attempts before the client must self-verify.

---

## 2. Does the *current* notify-sdk architecture already support the clinic scenario?

**Mostly yes — a "clinic" is structurally identical to a "tenant" in the existing system.**
Reuse is high:

**Directly reusable, no changes needed:**
- `TenantClientRegistry` — one isolated `NotifyClient` per clinic, cached, own credentials/token
- `TemplateEngine` — appointment reminders, confirmations, follow-ups are exactly the
  session-message and HSM-template patterns already built (`registerTemplate`, `hsmTemplate`)
- `GuardEngine` — opt-in/quiet-hours/mute enforcement per clinic, already multi-tenant safe
- `PostgresAdapter`'s per-tenant scoping, `CredentialCipher`'s per-tenant key derivation
- Webhook inbound handling (`TenantWebhookRouter`) for patient replies/STOP-START, already
  resolves tenant from `phone_number_id` per message
- Bulk/broadcast sending (`BulkSender`, campaigns) for "send to today's appointment list"
- Reports/notifications = same `send()` path with a different template — no new primitive needed

**What does *not* yet exist and would gate the "one simple setup page" experience:**
- `CredentialsForm.tsx` today requires the clinic to have *already* gone and manually created
  their own Meta Business app, WABA, and System User token *before* they ever see your setup
  page — that's real friction disguised as "verification," even though it isn't verification
  per se. It's the operational provisioning step (row A in the table above), and it's currently
  100% self-service outside your product.
- No Embedded Signup / OAuth flow anywhere in the repo — this is the piece that would actually
  deliver "clinic enters details on one page and submits," because Embedded Signup handles WABA
  + phone number creation *inside your UI* via a Facebook-hosted flow, rather than sending the
  clinic off to developers.facebook.com to build their own app first.
- No shared platform-level Meta App ID/Secret — each tenant currently brings their own Meta
  app. Embedded Signup requires the inverse: one Azentis-owned Meta app that every clinic's WABA
  gets attached to.

## 3. What's additional, per clinic, regardless of which onboarding path is used

These are inherent to WhatsApp's platform, not something any architecture choice avoids:
- A dedicated phone number capable of receiving an OTP/call for WhatsApp registration (can't be
  a number already active on personal WhatsApp)
- A WABA of their own — even under Embedded Signup, Meta creates a distinct WABA per business,
  just attached to your Business Manager instead of theirs
- Their own message-quality rating and tier ceiling — one clinic's spam reports/blocks don't
  affect another's tier, but each starts at the same default cap independently
- At least one Meta-approved HSM template if they want to message patients outside the 24h
  session window (appointment reminders sent proactively are the common case that needs this)
- A credit card on file at some point — Meta bills WhatsApp conversations to whoever owns the
  Business Manager the WABA sits under (you, if Embedded Signup; them, if self-service)

## 4. Does this work properly in a multi-tenant SaaS model?

Yes — this is the shape the codebase is already built around (see `CLAUDE.md`'s architecture
notes on tenant isolation, `onClientReady`, per-tenant encrypted credentials). Nothing about
serving clinics instead of the current tenant types requires a different multi-tenancy model.
The only architectural gap is *how a tenant's WABA gets attached* (manual paste today vs.
Embedded Signup), not whether multiple clinics can be safely isolated once attached.

---

## 5. Exact details required from each clinic

Two onboarding paths, two different field lists. Both are "one setup page" from the clinic's
point of view — they differ in whether the clinic does Meta console work *before* reaching that
page (Path A) or *inside* it (Path B).

### Path A — manual entry (works today, zero new engineering)

The clinic (or whoever sets up their Meta side — could be their IT person, could be your CS
team walking them through it once) must first obtain these from Meta, then paste them into the
setup page:

| Field | Required? | Where it comes from |
|---|---|---|
| Phone Number ID | Yes | Meta App → WhatsApp → API Setup |
| WhatsApp Business Account ID (WABA ID) | Recommended (needed for template sync) | Same screen |
| Permanent access token | Yes | Business Settings → System Users, scoped to `whatsapp_business_messaging` + `whatsapp_business_management` |
| App Secret | Needed for inbound replies/STOP-START | App Settings → Basic |

Plus business-side fields entered directly, no Meta trip needed:

| Field | Required? | Purpose |
|---|---|---|
| Clinic/business display name | Yes | Branding in admin, portal, message previews |
| Admin contact email (+ password or SSO) | Yes | Their login to the setup page and portal |
| Timezone | Yes | Quiet-hours enforcement, reporting windows |
| Logo, brand color | Optional | Cosmetic, portal/admin theming |
| WhatsApp sender display name | Yes | Shown to patients — goes through Meta's separate display-name review, independent of business verification |

This is real friction (steps 1–4 require someone who can navigate Meta's console), but it does
**not** require Business Verification, and it needs **no new code** — it's exactly today's
`CredentialsForm.tsx` flow, just embedded inside the clinic app's UI instead of your ops admin.

### Path B — Embedded Signup (the actual "just fill one page and submit" UX — requires the build)

Clinic never leaves your app or touches developers.facebook.com. They provide:

| Field | Required? | Collected where |
|---|---|---|
| Facebook login (personal or business account with rights to create/own a Business Portfolio) | Yes | Facebook-hosted popup, triggered from your page |
| Business name, category, phone number to register | Yes | Inside the same popup, OTP-verified live |
| Clinic/business display name, admin email, timezone, logo, brand color | Yes/optional (same as Path A) | Your own setup page, before or after the popup |

Everything in rows 1–2 of Path A's Meta table (Phone Number ID, WABA ID, access token, App
Secret) is generated and attached **automatically** by Meta during the popup flow and retrieved
by your backend via the OAuth code exchange — the clinic never sees or handles them.

---

## 6. Making it scale and stay flexible

- **Support both paths from the same data model.** Add an `onboarding_method` column
  (`manual` | `embedded_signup`) to `tenant_wa_credentials`. Both paths terminate in the same
  four Meta values stored the same way, so `TenantClientRegistry` and everything downstream
  doesn't care which path produced them. This also gives you a graceful fallback: enterprise
  clinics with their own security policies or existing Meta setup can stay on Path A even after
  Path B ships — you're not forced to rip one out for the other.
- **Per-tenant isolation already scales horizontally.** Onboarding clinic #1000 costs the same
  as clinic #1 — `TenantClientRegistry` caches one `NotifyClient` per tenant on demand, nothing
  in the architecture is shared or contended across tenants except the database, which is
  already indexed on `tenant_id`.
- **Ship a shared HSM template library**, not a blank editor: pre-drafted, pre-categorized
  templates for `appointment_reminder`, `appointment_confirmation`, `follow_up`, `report_ready`
  that a clinic customizes (clinic name, time slot variables) and submits via the existing
  `syncTemplates()`/HSM path, instead of writing template copy from scratch. This is what
  actually determines how fast a new clinic goes from signup to first real send — template
  approval, not credential setup, is usually the long pole.
- **Surface each clinic's tier/quality-rating**, not just their credentials — a small
  dashboard indicator (current tier ceiling, messages sent today) in admin and portal so a
  clinic approaching the 250/24h default cap knows to pursue verification before it becomes an
  outage rather than after.
- **One phone number and one WABA per clinic is a hard platform constraint, not a design
  choice** — Meta ties a WABA to a single business identity, and patients would see the same
  WhatsApp number representing multiple unrelated clinics if numbers were pooled. Budget for
  "one dedicated number per clinic" as a fixed per-tenant cost in both onboarding paths.

---

## 7. Recommendation

1. **Don't block the clinic use case on Tech Provider status.** The current manual-credential
   architecture already supports "clinic sends appointment reminders without Business
   Verification" today, at the default tier — that part needs no new engineering.
2. **Tech Provider + Embedded Signup is what buys the "one simple setup page" UX**, not the
   verification exemption (which already doesn't require exemption). Frame the build around
   *onboarding friction*, not around verification bypass — the latter is a red herring, the
   former is real and worth fixing.
3. If greenlit, the build is: shared platform Meta App → Facebook Login for Business + Embedded
   Signup flow in `apps/admin` replacing `CredentialsForm.tsx`'s manual fields → server-side
   OAuth code exchange + System User/WABA provisioning → same downstream pipeline
   (`TenantClientRegistry`, `TemplateEngine`, etc.) untouched.
4. Complete the 4 remaining Meta console checklist items (Facebook Login for Business, Business
   and access verification, App Review, Publish) regardless — they're required for Embedded
   Signup to work at all, independent of the clinic scenario.

**Open question for sign-off before implementation starts:** do we build Embedded Signup now,
or ship the clinic integration on the existing manual-paste flow first (zero new engineering,
works today under default tier limits) and treat Embedded Signup as a UX upgrade later once
onboarding volume justifies it?
