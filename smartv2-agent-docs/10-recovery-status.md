# 10. Recovery Status

## Purpose

This file is the live recovery ledger for the reconstructed Smartv2 workspace. Update it after each implementation batch. Do not mark a feature as restored until its imports resolve and the relevant validation command passes.

Last updated: 2026-06-04

## Current state summary

The repository contains a valid Vite React TypeScript package and the preferred dependencies are installed locally. The active app now renders the recovered Smartv2 public shell through shared providers and a central public route registry.

Several Smartv2 files were salvaged from chats, but they are partial and come from more than one attempted folder layout. Treat them as source material until they are wired into the application and validated.

## Restored and active

- `src/App.tsx`
- `src/main.tsx`
- `src/config/firebase.ts`
- `src/config/agent.ts`
- `src/config/languages.ts`
- `src/config/permissions.ts`
- `src/config/roles.ts`
- `src/config/routes.tsx`
- `src/config/theme.ts`
- `src/providers/AppProvider.tsx`
- `src/providers/ThemeProvider.tsx`
- `src/providers/LanguageProvider.tsx`
- `src/providers/AgentProvider.tsx`
- `src/contexts/IdentityProvider.tsx`
- `src/contexts/AssignedInterventionsContext.tsx`
- `src/contexts/SystemSettingsContext.tsx`
- `src/layouts/SystemLayout.tsx`
- `src/components/shared/DashboardPage.tsx`
- `src/components/shared/DashboardHeader.tsx`
- `src/components/shared/DashboardMetricCard.tsx`
- `src/components/shared/MotionCard.tsx`
- `src/components/shared/Header.tsx`
- `src/components/shared/FilterBar.tsx`
- `src/components/shared/ResponsiveDataView.tsx`
- `src/components/shared/LoadingOverlay.tsx`
- `src/components/agent/AgentFab.tsx`
- `src/hooks/useActiveProgramId.ts`
- `src/hooks/useFullIdentity.ts`
- `src/hooks/useWindowSize.ts`
- `src/pages/landing/LandingPage.tsx`
- `src/pages/auth/AuthPage.tsx`
- `src/pages/welcome/WelcomePage.tsx`
- `src/pages/system/ComingSoonPage.tsx`
- `src/pages/system/NotFoundPage.tsx`
- `src/services/authService.ts`
- `src/services/onboardingService.ts`
- `src/services/agentService.ts`
- `src/services/applicationsService.ts`
- `src/services/applicantService.ts`
- `src/services/firestoreList.ts`
- `src/services/departmentsService.ts`
- `src/services/assignedInterventionsService.ts`
- `src/services/interventionsDatabaseService.ts`
- `src/services/participantService.ts`
- `src/services/complianceService.ts`
- `src/types/agent.ts`
- `src/types/identity.ts`
- `src/types/applicant.ts`
- `src/types/interventions.ts`
- `src/types/participant.types.ts`
- `src/utils/authErrors.ts`
- `src/utils/roleRouting.ts`
- `src/styles/global.css`
- `src/styles/landing/LandingPage.css`
- `src/styles/auth/auth.css`
- `.env.example`

## Recovered and usable as source material

- `src/styles/system-layout.css`
- `src/navigation/operations.tsx`
- `src/navigation/incubatee.tsx`
- `src/pages/dashboards/operations/rom/ROMDashboardPage.tsx`
- `src/pages/interventions/InterventionsMonitoringPage.tsx`
- `src/pages/interventions/InterventionsAssignmentsPage.tsx`
- `src/pages/interventions/AllocatedInterventionsPage.tsx`
- `functions/src/index.ts`

## Present but incomplete or inactive

- `src/index.css`: still the default Vite stylesheet.
- `src/navigation/operations.tsx` and `src/navigation/incubatee.tsx`: recovered menus still use hardcoded labels and must move into the central route registry.
- `src/pages/dashboards/operations/rom/ROMDashboardPage.tsx` and `src/pages/interventions/InterventionsMonitoringPage.tsx`: recovered feature pages compile, but are not routed yet and retain strict-lint cleanup work.
- `functions/src/index.ts`: recovered Cloud Functions source exists. Its manifest now lists `cors`, `nodemailer`, and related types and targets ES2021, but `functions/package-lock.json` and installed modules still need regeneration before it can compile.

## Missing foundation files

These are required by the project guide or by recovered imports:

- No known missing frontend foundation files from the current recovery batch.

The roadmap also expects shared component, hook, utility, type, dashboard service, and users service folders as the platform foundation grows.

## Known inconsistencies to resolve

- Firebase is intentionally lazy-initialized so public pages render before local credentials exist. Local credentials now live in ignored `.env.local`; `.env.example` remains a safe template.
- English and isiZulu contexts are active and persisted locally. Additional languages can be restored after the core copy stabilizes.
- The route registry now models the applicant, active incubatee, operations, and platform journeys. Unbuilt modules render a safe placeholder page.
- `SystemLayout` filters navigation by identity audience and redirects signed-out system visits to `/auth`.
- `src/index.css`, `src/App.css`, and starter assets remain unused cleanup candidates.

## Validation baseline

Run validation with the normal commands when `npm` is available:

```bash
npm run build
npm run lint
```

On the current recovery machine, `npm` and `git` are not exposed on the PowerShell `PATH`. TypeScript and ESLint were run through the bundled Node executable instead.

Current result:

- TypeScript build and Vite production build: passing.
- ESLint: the restored foundation passes; the two recovered feature pages retain strict-lint debt, mainly explicit `any` values and effect cleanup.
- Build warning: the initial JavaScript bundle is larger than 500 kB and should be split as the route surface grows.
- Browser verification: landing page, `/auth`, and `/dashboard` render; `/dashboard` uses the responsive system shell.
- Firebase workflow verification: local Firebase configuration loads correctly and email/password auth reaches Firebase; successful login and social-provider flows still need end-to-end verification.
- Cloud Functions build: pending dependency installation in `functions`; the recovered manifest now includes the missing packages.

## Restore order

### Batch 1: Compile-ready public shell

Completed on 2026-06-01.

### Batch 2: Authentication foundation

- Expand friendly auth errors where needed.
- Verify login, signup, password reset, Google login, and Facebook login flows against configured Firebase providers.

### Batch 3: Role-aware system shell

- Derive menu visibility from identity role permissions.
- Add route guards and mobile navigation behavior.

### Batch 4: First real platform pages

- Add shared loading, error, empty-state, page-header, metric-card, and responsive-list components.
- Build the dashboard.
- Build the first typed Firestore CRUD module through a service.
- Register page-aware agent context and explicit permitted actions.

## Change log

### 2026-06-01

- Audited the reconstructed workspace against agent docs `01` through `09`.
- Recorded recovered files, missing files, compile failures, lint failures, and the restore order.
- Restored the compile-ready public shell, alias configuration, providers, public routes, theme config, language config, agent types, roles, guarded Firebase setup, auth service, auth helpers, and environment template.
- Restored baseline responsive styling for the landing and auth pages.
- Verified production build, ESLint, landing render, auth render, and landing-to-auth navigation.
- Audited the new recovery drop containing Cloud Functions, system layout, navigation fragments, ROM dashboard, and intervention monitoring files.
- Added centralized permissions, identity context, compatibility hooks, shared dashboard components, typed intervention and participant models, and Firestore-backed service modules.
- Restored the active `/dashboard` route through `SystemLayout` and verified the frontend production build.
- Recorded Cloud Functions dependency gaps and feature-page strict-lint cleanup as follow-up work.
- Updated the Cloud Functions manifest and TypeScript target for the recovered mail and HTTP function source; dependency installation remains pending because `npm` is not available on the current PowerShell path.

### 2026-06-02

- Moved live Firebase values from `.env.example` into ignored `.env.local` so Vite loads them without exposing values in the template.
- Added English and isiZulu translation contexts with local language persistence.
- Added the full known navigation registry with nested operations and incubatee destinations, using translated placeholder pages for modules still under restoration.
- Added a standalone translated Ant Design `Result` 404 page outside `SystemLayout`.
- Improved the auth social sign-in divider and added a pre-login language selector.
- Restarted Vite with `.env.local` and verified that invalid credentials reach Firebase and return the friendly credential error instead of the local configuration guard.
- Verified translated placeholder routes, nested navigation, isiZulu switching, and the standalone 404 page in the in-app browser.
- Adjusted the mobile auth layout spacing below the floating controls and removed the social sign-in divider badge background for a cleaner inline treatment.
- Replaced the custom auth separator with Ant Design `Divider`, restored the mobile auth card to full viewport width, centered the desktop system search trigger, and changed workspace search from route navigation into a record-search helper for participants, evidence, tasks, and reports.
- Added typed application-presence lookup so an `incubatee` account with no application document is treated as an applicant workspace without creating a second Firebase role.
- Routed authenticated applicants to `/applicant/profile`, active incubatees to `/incubatee`, operations users to `/operations`, and remaining roles to `/dashboard`.
- Replaced the broad recovery menu with identity-aware applicant, active-incubatee, operations, and platform route sets; added the corresponding English and isiZulu navigation labels.
- Removed the mobile workspace-search icon while retaining desktop `Ctrl K` search and verified the compact header and mobile drawer in the in-app browser.
- Restored the first applicant module slice from recovered skeletons: editable participant profile, Firestore-backed program discovery, and application tracker pages.
- Added typed applicant models and a shared applicant service for participant, program, and application reads plus core profile saves.
- Connected Firebase logout from the responsive sidebar, redirected successful sign-out to `/auth`, and added a system-layout auth guard for manual signed-out route visits.
- Added reusable motion cards, sunken filter panels, compact filter bars with advanced-filter modals, responsive table-to-card lists, and shell-level Agent FAB with animated avatar, typing state, and full-screen mode.
- Updated applicant pages to use translated English and isiZulu copy, page-aware agent context, two mobile metrics without subtitles, full-width segmented controls, minimal primary filters, and centered five-record pagination.
- Added a small mobile gutter around the auth card so the login form no longer touches the viewport edges.
- Recorded the responsive surface contract in the architecture and page-build docs for future modules.
- Wired the Agent FAB to the recovered `POST /api/agent` backend contract through `VITE_AGENT_API_BASE_URL`, with recent message history, request-only typing state, latest-message auto-scroll, page-aware starter prompts, enter-to-send, and friendly failures.
- Added frontend and AI-backend environment templates while keeping provider credentials and optional backend shared secret outside browser code.
- Added the local Vite `4173` origins to the recovered FastAPI backend CORS defaults.
- Restored a focused first-login welcome wizard from recovered source material with a stable four-step sequence: welcome, email verification, password security, and completion.
- Added a centered reusable six-box verification modal with whole-code paste distribution and browser `one-time-code` autofill support. Firebase email verification remains link-based; server-issued digit-code validation is isolated behind `VITE_EMAIL_CODE_VERIFICATION_URL`.
- Routed accounts without `firstLoginComplete` through `/welcome` after email, Google, or Facebook authentication and persisted completion in the user profile.
- Recorded the fixed-step onboarding and OTP ownership rules in the architecture docs.
- Validation after the welcome-flow batch: frontend production build and foundation lint pass; Vite serves `/welcome` with `200 OK`. Automated visual QA could not be completed because the refreshed in-app browser plugin blocked local URL navigation by policy.

### 2026-06-04

- Added the recovered intervention assignment management page and assigned-interventions tracking page under the operations workspace route registry.
- Added `AssignedInterventionsProvider` for `assignedInterventions` reads and identity-based `isMine` filtering.
- Added `SystemSettingsProvider` for `systemSettings` values used by intervention assignment mode, SME division mode, and consultant labels.
- Routed Operations to both `/operations/interventions/assign` and `/operations/interventions/assigned`.
- Routed Consultants into the operations workspace for navigation; consultants see `/operations/interventions/assigned` with `track_interventions` and only see `/operations/interventions/assign` when `assign_interventions` is granted.
- Documented the intervention assignment Firestore collections and fields in `08-firebase-services-permissions.md`.
- Validation: `npm.cmd run build` passes on 2026-06-04. PowerShell still blocks `npm.ps1`; use `npm.cmd` on this machine.
