# 03. Architecture Rules

## General rules

- TypeScript must be strict and clean.
- No undefined variables.
- No broken imports.
- No placeholder or dummy data unless explicitly requested.
- No incomplete components.
- No emojis in production UI.
- Prefer complete, copy-paste-ready implementations.
- Keep components readable and maintainable.
- Avoid overengineering, but build foundations properly.

## Folder separation

Pages must not become dumping grounds. Separate responsibilities clearly:

- `pages/` contains route-level screens.
- `services/` contains Firestore access and domain operations.
- `contexts/` contains shared providers.
- `config/` contains routes, roles, themes, languages, and Firebase setup.
- `shared/components/` contains reusable UI.
- `shared/hooks/` contains reusable hooks.
- `shared/utils/` contains pure helper functions.
- `shared/types/` contains shared type definitions.

## Firestore access rule

Firestore access must go through service files.

Do not query Firestore directly inside page components unless there is a strong reason. The default pattern is:

```txt
Page component -> hook/service function -> Firebase service -> Firestore
```

Service files should expose clean functions:

- `list`
- `getById`
- `create`
- `update`
- `remove` or `archive`
- `subscribe`

## Route rule

Routes must come from a central route registry.

Each route should define:

- `path`
- `labelKey`
- `icon`
- `allowedRoles`
- `layout group`
- `breadcrumb metadata`
- `agent permissions/context`

Role menus must be derived from this route registry. Do not duplicate route labels manually across layouts and menus.

## Permission rule

Role checks must be centralized.

Do not scatter role checks randomly throughout pages. The same permission model should control:

- Navigation visibility.
- Route access.
- Page actions.
- CRUD service actions.
- Agent tool/action permissions.

## Identity rule

User identity should come from a shared identity hook/context.

Pages should not manually decode auth state or duplicate user-role fetching. A future hook such as `useFullIdentity` should provide role, user id, display name, email, branch/program context, and permissions.

## UI state rule

Every page must include:

- Loading state.
- Friendly error state.
- Empty state.
- Mobile layout behavior.
- Filter state where relevant.
- Safe handling for missing data.

Missing required fields should be treated as data issues, not silently hidden.

## Responsive surface rule

- Mobile metric sections show two metric cards per page. Metric subtitles are hidden on mobile.
- Dense desktop tables become equal-height record cards on mobile, paginated five records at a time with centered pagination.
- Use `DashboardMetricCard`, `MotionCard`, `SunkenPanel`, `FilterBar`, and `ResponsiveDataView` before creating page-specific variants.
- Keep primary filters minimal. Place secondary filters in the shared advanced-filter modal.
- Segmented controls should fill their available container width.
- Authenticated pages receive the shell-level Agent FAB. Register page context so the assistant can describe the active page honestly.
- Avoid large dashboard headers inside feature pages. Prefer a compact filter bar or a filter bar embedded in a motion card.
- First-login wizards must keep a stable visible step list for the full session. Mark steps complete without removing them after save.
- Verification-code inputs use separate digit boxes with whole-code paste and `autocomplete="one-time-code"` support. Real OTP issuance and validation belongs on a server endpoint configured through `VITE_EMAIL_CODE_VERIFICATION_URL`.
