# 07. UI, UX, Mobile, Theme, and Language Rules

## UI style

The UI should be simple, polished, and practical.

Use Ant Design as the main component system. Use subtle Framer Motion animations where they improve feel without slowing the interface down.

Avoid overloaded screens. Prefer summaries, filters, and clear actions.

## Metric cards

Metric cards should include:

- Clear title.
- Main value.
- Optional icon.
- Optional delta comparison.
- Optional count-up animation.
- Semantic color usage.

Semantic colors:

- Green: completed/success.
- Amber/orange: pending/in progress/warning.
- Red: failed/overdue/declined/error.
- Blue: neutral/info/unassigned.

## Charts

Use Highcharts.

Charts must:

- Be responsive.
- Respect the current theme.
- Use current filters and date ranges.
- Use numeric labels where useful.
- Avoid legends when direct labels are clearer.
- Support drilldowns where practical.
- Support delta comparisons where relevant.

## Mobile behavior

Every page must be mobile-ready.

Mobile rules:

- Navigation auto-closes after route change.
- Header stays clean and not overcrowded.
- Dense tables become cards/lists where needed.
- Filters collapse into compact filter panel, modal, or bottom sheet.
- Use full-width buttons and segmented controls where needed.
- Touch targets must be large enough.
- Avoid horizontal overflow.
- Do not rely on browser zoom to fix density.

## Layout expectations

Desktop:

- Spacious layout.
- Clear top-level metrics.
- Filters near the data they affect.
- Tables are acceptable when readable.

Mobile:

- Compact layout.
- Fewer columns.
- Cards instead of dense tables.
- Important actions visible.
- Secondary actions inside menus or modals.

## Theme support

Use a `ThemeProvider` or `ThemeContext`.

Requirements:

- Light mode.
- Dark mode.
- Centralized Ant Design theme tokens.
- Avoid hardcoded colors where possible.
- Use semantic CSS variables or theme tokens.
- Charts must respect current theme.

## Language support

Use `LanguageProvider`, `LanguageContext`, i18next, or a clean custom translation system.

All user-facing strings should use translation keys where possible.

Translate at least:

- Navigation labels.
- Buttons.
- Statuses.
- Empty states.
- Metric titles.
- Table labels.
- Filter labels.
- Common messages.

Initial languages:

- English.
- isiZulu.
- Sepedi/Northern Sotho.
- Setswana.
- Tshivenda.

## Error messages

Errors must be friendly and actionable.

Do not expose Firebase/internal/backend terminology to normal users.

Bad:

```txt
FirebaseError: permission-denied at collection users
```

Good:

```txt
You do not have permission to view these records. Contact an administrator if this seems wrong.
```
