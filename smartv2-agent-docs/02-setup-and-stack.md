# 02. Setup and Stack

## Initial project command

Use Vite with React and TypeScript:

```bash
npm create vite@latest smartv2 -- --template react-ts
cd smartv2
npm install
```

## Development command

```bash
npm run dev
```

## Main dependencies

Install the preferred production stack:

```bash
npm install antd @ant-design/icons firebase react-router-dom highcharts highcharts-react-official framer-motion react-countup dayjs lucide-react @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities i18next react-i18next
```

## Preferred frontend stack

- React + Vite + TypeScript.
- Ant Design latest stable version.
- Ant Design Icons.
- Firebase latest stable SDK.
- Highcharts + Highcharts React.
- dnd-kit for drag and drop.
- Framer Motion for subtle animations.
- react-countup for animated metric values.
- dayjs for date handling.
- lucide-react where extra icons are useful.
- react-router-dom for routing.
- i18next or a clean custom translation context for language support.

## Environment variables

Firebase configuration must be read from Vite environment variables:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Do not hardcode Firebase credentials directly in source files.

## Expected source structure

```txt
src/
  app/
    App.tsx
    AppProviders.tsx
  config/
    firebase.ts
    routes.tsx
    roles.ts
    theme.ts
    languages.ts
  contexts/
    ThemeProvider.tsx
    LanguageProvider.tsx
    AgentProvider.tsx
    IdentityProvider.tsx
  layouts/
    SystemLayout.tsx
  pages/
    dashboard/
      DashboardPage.tsx
    users/
      UsersPage.tsx
  services/
    users.service.ts
    dashboard.service.ts
  shared/
    components/
    hooks/
    utils/
    types/
  styles/
    global.css
    system-layout.css
```

Keep imports clean and avoid circular dependencies.
