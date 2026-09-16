# 05. Page Build Pattern

Every new page should follow this pattern.

## 0. Preserve the supplied workflow

When a legacy page, pasted skeleton, screenshot, or reference implementation is supplied, treat it as a functional specification.

The goal is to improve the design and architecture without oversimplifying the workflow or discarding useful information.

- Preserve the information, workflow stages, user decisions, actions, and review states represented in the supplied skeleton.
- Improve layout, responsiveness, wording, component structure, fields, and Firestore collections when that produces a cleaner system.
- Fields may be renamed, combined, split, or moved when the same business information remains available.
- Collections and document shapes may be redesigned when the new model is typed, avoids duplication, and supports the complete workflow.
- Do not replace a multi-step workflow with a thin form, text area, placeholder, or summary-only screen unless the user explicitly requests that simplification.
- Before declaring a restored page complete, compare it against the supplied skeleton and confirm that each meaningful capability has an intentional destination in the new design.

## 1. Define the data model

Create or update a type file for the domain.

Example:

```ts
export type UserRecord = {
  id: string
  displayName: string
  email: string
  role: UserRole
  status: 'active' | 'disabled'
  createdAt?: string
  updatedAt?: string
}
```

Do not show raw internal IDs in the UI unless explicitly required for debugging.

## 2. Create the service file

Create a service under `src/services`.

The service should own all Firestore access.

Expected functions:

```ts
listUsers()
getUserById(id)
createUser(payload)
updateUser(id, payload)
archiveUser(id)
subscribeUsers(callback)
```

Use typed payloads. Avoid `any` unless there is no realistic alternative.

## 3. Add route registry entry

Add the page to the central route config.

The route should define:

- Path.
- Label translation key.
- Icon.
- Allowed roles.
- Navigation visibility.
- Breadcrumb metadata.
- Agent action metadata.

## 4. Add translation keys

All user-facing labels should use translation keys.

Add keys for:

- Navigation label.
- Page title.
- Buttons.
- Table columns.
- Status labels.
- Empty states.
- Error messages.
- Filter labels.

## 5. Build responsive UI

Desktop:

- Use tables when appropriate.
- Keep layout spacious.
- Use metric cards and filters clearly.

Mobile:

- Show two metrics without subtitles.
- Convert dense tables into equal-height cards/lists, with five records per page and centered pagination.
- Keep primary filters minimal and move secondary filters into the shared advanced-filter modal.
- Use full-width buttons where needed.
- Make segmented controls fill their available width.
- Avoid horizontal overflow.
- Keep touch targets large enough.

Authenticated feature pages should use the shell-level Agent FAB and register page-aware context. Use a compact `FilterBar` instead of a large dashboard header.

## 6. Add loading, error, and empty states

Each page must handle:

- Initial loading.
- Refresh loading.
- Friendly errors.
- Empty data.
- Missing required fields.

Do not expose Firebase/internal/backend terminology to end users.

## 7. Register agent page context

Use a shared hook such as `useRegisterAgentPageContext`.

Context should include:

- Page name.
- Purpose.
- Visible metrics.
- Current filters.
- Active record/table data summary.
- Allowed user actions.
- Available CRUD functions.
- Role permissions.

## 8. Confirm destructive actions

Actions such as delete, archive, reject, remove, disable, and reset must require confirmation.

This applies to both UI actions and agent-triggered actions.

## 9. Definition before done

A page is not done until it has:

- Real data integration.
- No dummy data.
- Responsive layout.
- Translation keys.
- Theme support.
- Permission checks.
- Agent context.
- Loading/error/empty states.
- Clean TypeScript.
