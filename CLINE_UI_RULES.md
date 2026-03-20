# Cline UI Rules for Bingra

## Purpose
These rules tell Cline how to design and implement UI for Bingra.

Cline must follow `BINGRA_DESIGN_SYSTEM.md` for all visual decisions.

The goal is visual consistency across the app. Cline should not invent a new design language from page to page.

---

## Primary Rule

When generating or editing UI for Bingra:
- follow `BINGRA_DESIGN_SYSTEM.md`
- preserve visual consistency with existing high-quality pages
- prefer simple, reusable patterns over one-off styling

If a styling decision is unclear, choose the option that is:
- cleaner
- more restrained
- more readable
- more consistent with the design system

---

## Color Rules

Cline must only use colors that align with the Bingra design system.

### Allowed Color Behavior
Use:
- primary blue for primary actions and active states
- green for success
- amber for warnings
- red for destructive/error states
- slate/navy neutrals for backgrounds, surfaces, borders, and text

### Do Not
- introduce random Tailwind colors
- mix unrelated color palettes
- use bright colors for decoration
- invent gradients unless explicitly requested
- change page color strategy without a strong reason

If unsure, default to dark slate-based neutrals with a blue accent.

---

## Component Rules

Cline should prefer consistent reusable components over ad hoc markup.

### Prefer
- `Card`
- `Button`
- `Input`
- `Label`
- shared layout wrappers
- shared badge styles
- reusable section headers

### Avoid
- raw `div` soup for everything
- one-off styling when an existing component pattern can be reused
- multiple button styles solving the same problem
- inconsistent form field presentation

Before creating a new visual pattern, Cline should first look for an existing one in the codebase.

---

## Layout Rules

Cline should create pages that feel structured and breathable.

### Prefer
- clear page headers
- grouped sections
- cards for major content areas
- predictable spacing
- consistent max widths
- simple responsive layouts

### Avoid
- cramped layouts
- inconsistent spacing
- unnecessary nested containers
- too many visual boxes competing for attention
- oversized empty space without purpose

Default spacing should generally use:
- `p-4` or `p-6`
- `gap-4` or `gap-6`
- `space-y-4` or `space-y-6`

---

## Typography Rules

Cline should keep typography clean and consistent.

### Prefer
- a strong page title
- clear section headings
- readable body text
- muted supporting text for descriptions/metadata

### Avoid
- too many font sizes
- too many font weights
- oversized headings without reason
- very small body text
- decorative typography

Typography should support clarity first.

---

## Dark Mode Rules

Bingra is dark-mode first.

When generating new UI:
- default to dark surfaces
- use slate/navy neutrals
- ensure strong text contrast
- keep surfaces distinct but subtle

Do not randomly create light-mode sections inside dark pages unless intentionally designed.

---

## Interaction Rules

Cline should keep interactions polished but restrained.

### Use
- subtle hover states
- clear focus states
- short transitions where helpful
- clean active and selected states

### Avoid
- flashy animation
- bouncing effects
- dramatic scaling
- distracting movement
- excessive hover styling

Bingra should feel calm and fast, not flashy.

---

## Page Consistency Rules

When editing an existing page:
- match the page’s established structure if it already fits the design system
- improve consistency without unnecessary redesign
- do not restyle unrelated parts of the page

When creating a new page:
- base it on the closest existing Bingra pattern
- use the same card, spacing, header, and action conventions
- make it feel like it already belongs in the app

---

## Forms

Forms should feel guided and uncluttered.

### Prefer
- grouped related fields
- clear labels
- helper text when useful
- obvious primary action
- consistent input sizes and spacing

### Avoid
- dense walls of fields
- inconsistent field widths
- unclear button hierarchy
- excessive inline styling differences

---

## Tables and Data Views

Bingra will likely have many schedules, standings, divisions, and admin tables. These should be clean and functional.

### Prefer
- clear headers
- readable spacing
- subtle borders or row separators
- badges only where useful
- muted secondary metadata

### Avoid
- overly decorative tables
- too many colors inside tables
- cluttered rows
- tiny text

---

## Empty States and Status States

Cline should make empty states intentional.

Each empty state should usually include:
- a concise title or message
- a short explanation
- a next action if appropriate

Status indicators should be:
- easy to scan
- consistent across pages
- color-coded according to the design system

---

## Reuse Rules

Before inventing a new UI treatment, Cline must:
1. inspect similar pages/components in the repo
2. reuse the best existing pattern
3. only create a new pattern if none exists

Consistency is more valuable than novelty.

---

## Restraint Rules

Cline should show visual restraint.

That means:
- fewer colors
- fewer component variants
- fewer decorative effects
- fewer one-off layout ideas

Good Bingra UI should look intentional, not experimental.

---

## What Cline Must Not Do

Cline must not:
- introduce random new colors
- use inconsistent border radius values across similar elements
- create multiple competing card styles
- use several different page header patterns for similar pages
- add gradients, glows, or shadows without a reason
- make a page feel crowded
- make a page feel childish or gimmicky
- redesign unrelated working UI during a focused task

---

## Decision Rule When Unsure

If uncertain about a styling choice, Cline should choose the option that is:
1. more consistent with `BINGRA_DESIGN_SYSTEM.md`
2. more consistent with existing Bingra UI
3. simpler
4. more readable
5. more restrained

---

## Output Rule

When making UI changes, Cline should be able to explain them in terms of:
- consistency
- readability
- hierarchy
- spacing
- component reuse
- alignment with the Bingra design system

If it cannot explain the choice clearly, it should probably not introduce that styling change.