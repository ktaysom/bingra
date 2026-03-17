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

## Goal

Every page should feel like it belongs to the same product.

No page should look like it was designed differently than the others.