# 04. Implementation Roadmap

## Phase 1: Foundation

### 1. Project setup

Create the Vite React TypeScript app and install the preferred stack.

Expected outcome:

- App runs with `npm run dev`.
- TypeScript is working.
- Ant Design is installed.
- Firebase SDK is installed.
- Routing is available.

### 2. Theme provider

Create a centralized `ThemeProvider`.

Expected outcome:

- Light mode works.
- Dark mode works.
- Ant Design tokens are centralized.
- `document.documentElement.dataset.theme` updates when theme changes.
- Charts can later read the current mode.

### 3. Language provider

Create a centralized `LanguageProvider`.

Expected outcome:

- Language can switch between English, isiZulu, Sepedi/Northern Sotho, Setswana, and Tshivenda where practical.
- Navigation labels, buttons, statuses, empty states, metric titles, and common table labels use translation keys.

### 4. Route registry

Create a central route configuration.

Expected outcome:

- Routes define path, label key, icon, allowed roles, layout group, breadcrumbs, and agent metadata.
- Navigation menus are generated from route config.
- Route names are standardized across roles.

### 5. Role-aware layout

Create `SystemLayout`.

Expected outcome:

- Sidebar supports role-aware menus.
- Header supports breadcrumbs, theme switch, language switch, profile/logout actions.
- Mobile navigation opens and closes cleanly.
- Mobile nav auto-closes after route change.
- Header remains clean and not overcrowded.

### 6. Firebase setup

Create Firebase config and exports.

Expected outcome:

- Firebase App initialized once.
- Auth, Firestore, and Storage are exported.
- Environment variables are used.

### 7. Shared services pattern

Create the first typed service file.

Expected outcome:

- Firestore collection access is isolated.
- Service functions are typed.
- Pages consume services instead of raw Firestore calls.

### 8. Agent context provider

Create shared agent page context.

Expected outcome:

- Pages can register context.
- Active page context can be read by the assistant.
- Allowed actions are explicit.
- Destructive actions can be flagged for confirmation.

### 9. Reusable dashboard components

Create shared dashboard building blocks.

Expected outcome:

- Metric cards.
- Chart cards.
- Responsive table/card list wrapper.
- Empty state component.
- Loading overlay/skeleton component.
- Page header component.

### 10. First real CRUD page

Build the first production-ready page using the full pattern.

Expected outcome:

- Typed data model.
- Service file.
- Page component.
- Responsive UI.
- Translated labels.
- Theme-aware styling.
- Agent page context.
- Role permissions.
- Loading/error/empty states.

## Phase 2: Core platform pages

Recommended order:

1. Dashboard.
2. Users and roles.
3. Settings.
4. Programs/branches if needed.
5. Domain-specific CRUD modules.
6. Reports and analytics.
7. Assistant interface.

## Phase 3: Agentic workflows

After stable CRUD pages exist, add agent-controlled actions.

Expected outcome:

- Assistant can explain current page.
- Assistant can answer based on registered page data.
- Assistant can call approved CRUD functions.
- Assistant asks for confirmation before destructive actions.
- Assistant does not hallucinate unavailable data.
