# Spotter UI Kit

## Primary reference

The living, rendered reference is the admin-only route **`/app/admin/ui`**, implemented in `src/pages/UiKitPage.tsx`. Before creating or substantially changing a screen, CTA, sheet, empty state, or navigation pattern, inspect it and a nearby existing product screen.

The detailed enforced conventions are in `.cursor/rules/spotter-ui-kit.mdc`; this document is the shorter map for people and agents.

Technical sources of truth:

- `src/styles/color-themes.css` — production color, typography and layout tokens.
- `src/styles/global.css` — global primitives and responsive shell behavior.
- `src/styles/sheets.css` — shared sheet chrome and accessibility behavior.
- `src/components/` — reusable elements such as `SectionTitle`, `SubpageHeader`, `SoftLoader`, `SoftFlash`, `MomentFX` and cards.

## Visual identity

- Dark green-black product chrome; lime is the primary brand/action color.
- `Unbounded`: display titles, gym/profile names only.
- `Syne`: the Latin SPOTTER brand only.
- `Onest`: all body text and UI.
- Do not add a fourth font, light-mode default, purple dating aesthetic, glassmorphism, or decorative neon.
- Use `--accent` for primary actions and selected states; `--online` for presence; warning/danger only for their semantic states.

## Reusable decisions

- One screen has one primary action. Secondary actions are visually quieter.
- Use `SubpageHeader` for nested pages; root tabs have no back button. Do not use `navigate(-1)` for product navigation flows.
- Use `SectionTitle` for sections instead of local heading styles.
- Use `.seg` / `.seg-item.is-active` for mutually exclusive segmented choices, not ad-hoc chips or toggles.
- Use `.app-sheet*` shared chrome for sheets; place feature-specific styling in the feature CSS.
- Empty state: `.empty-copy`, a clear title/lead, one primary CTA.
- Loading: `SoftLoader` within the future content area; do not shift stable page chrome or CTA placement.
- Routine confirmation uses `SoftFlash`; `MomentFX` is reserved for check-in/out and rare meaningful moments.

## Responsive and accessibility baseline

- The product is mobile-first from 360px. Keep the existing `app-shell`, page padding and safe-area variables.
- Preserve visible focus, semantic buttons/links, labels, tap-target sizing and keyboard behavior.
- Do not hide an error as an empty state. Async user flows need loading, empty, error and retry treatment.

## When to update this document

Update this file and the living UI Kit screen together when you introduce a durable shared visual primitive, token, navigation convention, or interaction rule. Do not document one-off page decoration.
