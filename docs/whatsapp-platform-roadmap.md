# Roadmap: proactive, trustworthy WhatsApp engagement for any business

**Status: planning doc — no implementation started.**
**Branch:** `feature/meta-tech-provider`.
**Companion doc:** [`meta-tech-provider-feasibility.md`](./meta-tech-provider-feasibility.md) —
the technical feasibility analysis this roadmap sequences into phases.
**Mockups:** [`mockups/wa-platform-mockups.html`](./mockups/wa-platform-mockups.html) — five
annotated screens (chooser, manual setup, Embedded Signup, template library, sending health)
that serve as the Phase 1/2 build spec.

## Vision

Give any business — a solo clinic, a small shop, a business launching its first promotion, or a
large multi-location brand — automated, proactive WhatsApp communication (reminders,
confirmations, follow-ups, alerts, announcements) that requires no manual per-message effort,
reads as sent by a real, verified business, and keeps their customers engaged and confident.
One platform, one onboarding experience, scaling from a single-clinic tenant to a large
enterprise tenant without re-architecture.

Four things that vision actually demands, each mapped to a phase below:

| Demand | What satisfies it |
|---|---|
| "Automate updates / proactive alerts / real-time" | Already built: `TemplateEngine`, event-driven `onClientReady` hooks, queue adapters, campaigns/bulk send |
| "Any kind of business, small to large" | Multi-tenant isolation already generic — needs onboarding + template UX to stop being clinic-specific |
| "Without extra manual effort" | The onboarding-friction gap identified in the feasibility doc — Path A closes it partially, Path B (Embedded Signup) closes it fully |
| "Looks like sent from authentic users, builds trust" | WhatsApp sender display-name approval + message-quality rating + opt-in compliance — a Meta-governed process, not something either onboarding path bypasses |

---

## Design commitment: two entry points, one platform, permanently

Both onboarding paths from the feasibility doc stay live forever — Path B is not a replacement
for Path A, it's an additional door:

| Tenant persona | Path | Why |
|---|---|---|
| Already has a Meta Business Manager, WABA, verification done | **Path A** (manual entry) | They already hold the 4 credential values — pasting them in is *less* friction than routing them through an OAuth flow, and some enterprise tenants will require keeping their own Meta app for their own compliance reasons regardless |
| Fresh business, no Meta account, wants minimal effort | **Path B** (Embedded Signup) | Minimal details (business name, phone, Facebook login) — Meta provisions the WABA behind the scenes, nothing to copy-paste |

Both write to the same `tenant_wa_credentials` shape and the same `TenantClientRegistry`
construction path, distinguished only by an `onboarding_method` column — so `TemplateEngine`,
`GuardEngine`, analytics, and every other downstream piece is identical regardless of which door
a tenant came through. Path A is not deprecated once Path B ships; a tenant is never forced
through Embedded Signup if they'd rather bring their own Meta app.

---

## Phase 1 — Generalize what already exists (no new integration surface)

**Goal:** any business type — not just clinics — can be onboarded and sending proactively
today, on the current manual-credential architecture (Path A from the feasibility doc).

- Generalize the setup page/flow from "clinic" language to business-agnostic fields (business
  name, category, timezone, brand identity) — the underlying `tenant_wa_credentials` schema and
  `TenantClientRegistry` already don't care what kind of business a tenant is.
- Build a **shared, categorized HSM template library** covering the stated use cases —
  appointment/booking reminders, order/shipping confirmations, follow-ups, promotional
  announcements, generic alerts — so a new tenant picks and customizes instead of authoring
  template copy from scratch. This is the actual lever on "automated, no manual effort," since
  template-approval turnaround (not credential setup) is the longest step in getting a new
  business to its first real send.
- Surface each tenant's messaging tier and quality rating in admin/portal (today it's invisible
  until a send starts failing) — the first building block of "confident, trustworthy" at the
  ops level: know a tenant's ceiling before they hit it.
- No new Meta-facing integration in this phase — ships fastest, proves the template-library and
  generalized-onboarding UX before investing in Embedded Signup.

**Exit criteria:** a non-clinic business (e.g. a small shop) can go from signup to a live
promotional send using only in-product steps + a Meta credential handoff, with zero ops
engineering intervention beyond what `CredentialsForm.tsx` already supports today.

---

## Phase 2 — Embedded Signup (Tech Provider build, Path B)

**Goal:** true "no manual effort" onboarding — a business clicks through a Facebook-hosted flow
inside your product and is sending within minutes, no Meta console visit, no copy-pasted
tokens.

- Complete the 4 remaining Meta console checklist items (Facebook Login for Business, Business
  and access verification, App Review for Advanced Access, Publish) — prerequisite, not
  optional, for any of this phase.
- Stand up one platform-owned Meta App + Business Manager that every tenant's WABA attaches to.
- Build the OAuth code-exchange + System User/WABA provisioning backend, and swap the setup
  page's manual fields for the Embedded Signup flow, gated behind the `onboarding_method`
  column proposed in the feasibility doc — Path A stays available as a fallback for tenants
  with existing/enterprise Meta setups, not ripped out.
- Raises your own onboarding throughput ceiling (10 → 200 new tenants/7 days) as a side effect
  of completing business verification + App Review.

**Exit criteria:** a new tenant of any business type can self-serve from signup to first send
without any ops-side credential handling, on either onboarding path, indistinguishably to
everything downstream (`TemplateEngine`, `GuardEngine`, analytics).

---

## Phase 3 — Trust and scale hardening

**Goal:** the "authentic, confident, trust-building" half of the vision, which is a Meta-governed
and operational-discipline problem, not a one-time build.

- **Display name authenticity:** every WABA's sender display name goes through Meta's own
  review, independent of business/Tech Provider verification status — bake expected review
  turnaround and rejection-handling (fallback to phone number display) into onboarding UX so a
  tenant isn't surprised mid-flow.
- **Opt-in and compliance discipline stays load-bearing at scale:** `GuardEngine`'s opt-in/STOP-
  START handling is what keeps quality ratings (and therefore tier ceilings) healthy across
  hundreds of tenants — this doesn't change with volume, but monitoring for tenants trending
  toward quality degradation (rising block/report rate) becomes necessary once tenant count is
  large enough that ops can't eyeball it.
- **Partner-led business verification** (once you qualify for Select/Premier Solution Partner
  status — a volume-based bar, not available at launch): lets you submit a tenant's verification
  documents on their behalf for faster approval when they outgrow the default tier, rather than
  sending them off to self-verify. Revisit eligibility once Phase 2 has real onboarding volume
  behind it.
- **Reliability of "real-time" and "proactive":** confirm `BullQueueAdapter` (genuinely async,
  Redis-backed) is the default for any tenant doing meaningful volume — `InlineQueueAdapter`
  (synchronous) is fine for demos/small tenants but doesn't hold up as a "keeps customers
  confident" guarantee under load or partial failure.

**Exit criteria:** tenant growth doesn't require proportional ops effort to keep message quality
and delivery reliability high — the platform surfaces risk (tier ceilings, quality drops) before
it becomes an outage, rather than after.

---

## Sequencing and dependencies

```
Phase 1 (generalize + template library)  →  ships independently, no Meta dependency
Phase 2 (Embedded Signup)                →  hard-blocked on the 4 Meta console items
Phase 3 (trust/scale hardening)          →  partner-led verification sub-item hard-blocked
                                             on Solution Partner eligibility (volume-gated
                                             by Meta, not something this team controls timing on)
```

Phase 1 and the Meta console checklist items (start of Phase 2) can run in parallel — neither
blocks the other. Phase 2's actual OAuth/provisioning build should not start until the console
checklist (Business Verification + App Review) is approved, since Advanced Access is a
prerequisite for Embedded Signup to function at all.

## Open decisions before implementation starts

1. Confirm Phase 1 scope: which business-category templates go in the initial shared library
   (appointment reminder, order confirmation, promotional announcement, generic alert — any
   others expected on day one)?
2. Confirm who owns the Meta console checklist items (business verification docs, App Review
   demo videos) — this has a real-world turnaround time outside engineering's control and should
   start now if Phase 2 is in scope for the near term.
3. Confirm whether `BullQueueAdapter`/Redis is already provisioned in the target deployment
   environment, since Phase 3's reliability exit criteria depends on it being the default, not
   an opt-in.
