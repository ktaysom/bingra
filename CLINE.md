# Cline Instructions for Binga

You are working on the Binga codebase.

Your job is to produce clean, consistent, production-quality UI and code that aligns with the Binga product.

---

## Always Follow

- BINGA_DESIGN_SYSTEM.md
- CLINE_UI_RULES.md
- BINGA_UI_PATTERNS.md

These define how the UI should look and behave.

When building UI, prefer existing canonical patterns from BINGA_UI_PATTERNS.md instead of inventing new layouts.
---

## Core Principles

- Consistency > creativity
- Reuse > reinvent
- Simple > clever
- Match existing patterns whenever possible

---

## Workflow Rules

Before making changes:
1. Read relevant files
2. Identify existing patterns
3. Follow those patterns exactly

When making changes:
- Keep changes minimal and focused
- Do not rewrite unrelated code
- Do not restructure files unnecessarily

After making changes:
- Ensure imports resolve
- Ensure UI matches design system
- Ensure code is clean and readable

---

## UI Rules (Critical)

- Use only colors from BINGA_DESIGN_SYSTEM.md
- Prefer existing components (Card, Button, Input, etc.)
- Use consistent spacing (gap-4, p-4, etc.)
- Maintain a clean, modern SaaS layout
- Default to dark mode styling

Do NOT:
- introduce random colors
- create inconsistent layouts
- invent new design patterns unnecessarily

---

## Component Reuse

Before creating new UI:
1. Check if a similar component already exists
2. Reuse or extend it
3. Only create new patterns if necessary

---

## When Uncertain

Choose the option that is:
1. More consistent with existing UI
2. Simpler
3. More readable
4. More restrained

---

# Event resources
Before making any changes, treat the following files as canonical sources of truth for Binga event behavior:

- `lib/bingra/event-catalog.ts`
- `lib/bingra/event-logic.ts`

Requirements:
1. Do not hardcode event names, point values, rarity, or team-scoping anywhere else in the app.
2. Any host scoring UI must be generated from `event-catalog.ts` / `event-logic.ts`.
3. Any card generation logic must use `event-catalog.ts` / `event-logic.ts`.
4. Any event validation must use helpers from `event-logic.ts`.
5. If an existing page or component currently hardcodes event buttons or labels, refactor it to consume these shared files instead of duplicating logic.
6. Prefer importing and reusing helpers over creating new parallel event logic.

First, inspect the current codebase and identify every place where event names, scoring controls, or card-generation assumptions are currently hardcoded. Then refactor those places to use the shared Bingra event files.

## Goal

Every page should feel like it belongs to the same product.

No page should look like it was designed differently than the others.

Do not run git checkout, git restore, or any git command.
Do not rewrite files unless I explicitly ask.
Only diagnose and propose minimal patches.
Do not inspect git history unless I explicitly ask.
