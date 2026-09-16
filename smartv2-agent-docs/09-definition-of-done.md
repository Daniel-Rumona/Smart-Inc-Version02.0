# 09. Definition of Done

A feature or page is only complete when it meets these requirements.

## Code quality

- TypeScript compiles cleanly.
- No undefined variables.
- No broken imports.
- No unused major logic.
- No dummy data unless explicitly requested.
- No incomplete placeholder components.
- No random role checks scattered across the page.
- Firestore access is inside service files.

## UI and UX

- Desktop layout is clean and spacious.
- Mobile layout is compact and usable.
- No horizontal overflow on mobile.
- Tables become cards/lists where needed.
- Filters are usable on small screens.
- Buttons and touch targets are large enough.
- Loading state exists.
- Error state exists.
- Empty state exists.

## Theme and language

- Uses theme tokens or semantic classes.
- Works in light mode.
- Works in dark mode.
- User-facing labels use translation keys where practical.
- Navigation labels come from translation system.

## Permissions

- Route access respects role permissions.
- Menu visibility respects role permissions.
- Page actions respect role permissions.
- Agent actions respect role permissions.
- Destructive actions require confirmation.

## Data integration

- Uses real Firebase/Firestore data.
- Uses typed service functions.
- Handles missing or malformed records safely.
- Does not show raw internal IDs unless debugging is explicitly required.
- Uses real-time subscriptions where live data matters.

## Agent readiness

- Page registers structured agent context.
- Context includes page purpose, filters, metrics, data summary, and allowed actions.
- Agent can explain the page using registered context.
- Agent can only perform approved actions.
- Agent uses the same service functions as the UI.
- Agent does not hallucinate data that is not available.

## Final check before sending code

Before returning code, verify:

1. Imports are correct.
2. Types are defined.
3. Component names match exports.
4. CSS class names exist or are included.
5. Required providers are used.
6. Route path and label key are registered.
7. Mobile behavior is handled.
8. Loading, error, and empty states are included.
9. Agent context is registered.
10. No raw internal IDs are shown unnecessarily.
11. Supplied skeletons and reference pages were checked capability-by-capability; no meaningful information, workflow stage, action, or review state was dropped during redesign.
