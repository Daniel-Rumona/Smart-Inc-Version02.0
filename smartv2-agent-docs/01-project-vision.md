# 01. Project Vision

## Goal

Smartv2 is a modern React + Firebase platform built with production-ready architecture from the beginning.

The platform must support multiple user roles, clean navigation, responsive dashboards, Firebase-backed data, and an AI assistant that understands each page and can perform approved actions safely.

## Core priorities

- Complete mobile responsiveness across every page.
- Light and dark theme support.
- Language switching through a shared translation system.
- Standardized route names and navigation labels across all roles.
- Centralized role-aware navigation and permissions.
- Agentic support across all pages.
- Every page must expose enough structured context for an AI assistant to explain the page, answer questions, and perform allowed CRUD actions.
- No raw internal IDs should be shown in the UI unless explicitly required for debugging.
- UI must be simple, polished, practical, and not overloaded.

## Product direction

Smartv2 should feel like a clean enterprise dashboard, not a rough prototype.

The foundation matters more than rushing pages. Build the platform in layers:

1. Project setup.
2. Theme provider.
3. Language provider.
4. Route registry.
5. Role-aware layout.
6. Firebase setup.
7. Shared services pattern.
8. Agent context provider.
9. Reusable dashboard components.
10. First real CRUD page.

After these are stable, every new page should follow the same repeatable pattern.

## Design philosophy

The UI should be modern but practical. Use Ant Design as the base system, with subtle Framer Motion animations, clear metric cards, readable tables, and mobile-friendly cards/lists.

Avoid dense pages. Avoid showing everything at once. Give the user filters, summaries, and clear actions.
