# Binga Design System

## Purpose
This document defines the visual design system for Binga. All new pages, components, and UI updates must follow this system so the product feels cohesive, intentional, and branded.

Binga should feel:
- modern
- clean
- slightly playful
- energetic without being loud
- sports-adjacent, but not juvenile
- polished enough for coaches, tournament directors, and admins

The design should avoid feeling:
- overly corporate
- cluttered
- childish
- overly colorful
- generic startup blue with no personality

---

## Brand Personality

Binga is a tool for organizing sports-related information and workflows. The UI should reflect:
- clarity
- confidence
- speed
- structure
- momentum

Visual tone:
- dark-mode first
- crisp surfaces
- bold but controlled accents
- simple layouts
- strong readability

Think:
- a clean modern SaaS product
- subtle sports energy
- practical and fast, not flashy

---

## Color System

Use a restrained palette. Do not introduce random Tailwind colors outside this system unless explicitly approved.

### Primary Brand Colors
- Primary / Brand Blue: `#2563EB`
- Primary Hover: `#1D4ED8`
- Primary Soft: `#DBEAFE`

### Accent Colors
- Success Green: `#10B981`
- Warning Amber: `#F59E0B`
- Danger Red: `#EF4444`

### Neutrals - Dark Mode
- App Background: `#0F172A`
- Secondary Background: `#111827`
- Card Background: `#1E293B`
- Card Border: `#334155`
- Input Background: `#0B1220`
- Primary Text: `#E2E8F0`
- Secondary Text: `#94A3B8`
- Muted Text: `#64748B`

### Neutrals - Light Usage (only where needed)
- White: `#FFFFFF`
- Light Surface: `#F8FAFC`
- Light Border: `#E2E8F0`
- Dark Text: `#0F172A`

---

## Color Usage Rules

### Primary Blue
Use for:
- primary buttons
- active states
- links
- selected tabs
- important highlights

Do not use primary blue for large background fills unless intentional and limited.

### Success Green
Use for:
- completed states
- success badges
- positive outcomes
- validation indicators

### Warning Amber
Use for:
- cautions
- things needing attention
- highlighted metadata
- schedule concerns or incomplete states

### Danger Red
Use for:
- destructive actions
- major warnings
- errors

### Neutral Colors
Use slate-based neutrals for:
- backgrounds
- cards
- borders
- table rows
- muted UI

Do not mix in unrelated purples, pinks, teals, yellows, or random Tailwind colors.

---

## Logo Guidance

Until a final logo system is established, use this direction:

### Logo Feel
- simple
- geometric
- bold
- memorable
- easily readable at small sizes
- not overly literal

### Logo Direction
The logo should feel like:
- motion
- organization
- game pieces / boards / structure
- modern sports-tech

Avoid:
- cartoon mascots
- heavy gradients
- detailed illustrations
- generic swooshes
- clip-art sports icons

### Wordmark Guidance
- clean sans serif
- medium or bold weight
- slight personality through spacing or shape
- easy to read in navbar and browser tab contexts

---

## Typography

### Font
Default font should be:
- `Inter`

If a secondary display font is ever introduced, it should be used sparingly and only for branding moments.

### Type Hierarchy
#### Page Title
- large
- bold
- high contrast
- clear and compact

#### Section Title
- medium-large
- semibold
- strong but not oversized

#### Body Text
- regular weight
- highly readable
- not too small

#### Supporting Text
- muted color
- smaller than body text
- used for descriptions, metadata, and helper text

### Typography Rules
- prioritize readability
- avoid excessive font sizes
- avoid too many font weights
- keep hierarchy obvious
- use line-height generously enough for clarity

---

## Spacing and Layout

Use consistent spacing. Binga should feel structured and breathable.

### Default Layout Behavior
- prefer centered content with a max width
- use predictable section spacing
- align to clear grids
- avoid cramped forms and crowded cards

### Preferred Container Widths
- page content: `max-w-6xl mx-auto`
- narrower forms/settings: `max-w-3xl mx-auto`
- dashboards/lists can go wider when appropriate

### Standard Spacing
- section padding: `py-6` to `py-10`
- card padding: `p-4` or `p-6`
- gaps between stacked items: `gap-4` or `gap-6`
- use `space-y-4` / `space-y-6` consistently

### Layout Rules
- use grids for dashboards and cards
- avoid arbitrary spacing values unless necessary
- maintain consistent vertical rhythm
- do not make pages feel crowded

---

## Border Radius and Shadows

### Border Radius
Use rounded corners consistently:
- cards: moderately rounded
- buttons/inputs: slightly rounded
- modals/dropdowns: consistent with card system

Recommended feel:
- modern, soft, but not bubbly

### Shadows
Use subtle shadows only.
- cards may have soft shadows
- avoid dramatic floating effects
- avoid stacking heavy border + heavy shadow + heavy glow all at once

---

## Components

All reusable UI should feel like part of one product family.

### Cards
Cards are the default content container.
Use cards for:
- settings groups
- dashboard panels
- summaries
- forms
- status blocks

Card style should feel:
- clean
- separated from background
- readable
- slightly elevated

### Buttons
Use a small set of button styles:

#### Primary Button
Use for:
- save
- create
- continue
- generate
- main actions

Should use primary blue background.

#### Secondary / Outline Button
Use for:
- less prominent actions
- cancel
- back
- alternate actions

#### Destructive Button
Use for:
- delete
- remove
- reset destructive items

### Inputs
Inputs should:
- be easy to scan
- have enough padding
- have strong contrast
- feel consistent across pages

### Tables and Lists
For data-heavy pages:
- prioritize readability
- use subtle row separation
- avoid clutter
- use muted text for secondary metadata
- use badges sparingly for important statuses

### Badges
Badges should be used for:
- status
- format tags
- counts
- warnings
- labels

Do not overuse badges as decoration.

### Empty States
Every empty state should feel intentional.
Include:
- a concise message
- one sentence of helpful context
- a clear next action if appropriate

---

## Interaction Style

Binga should feel fast and calm.

### Hover States
- subtle
- slightly brighter or darker
- no exaggerated movement

### Focus States
- always accessible
- clearly visible
- use the primary color system

### Transitions
- short and subtle
- avoid flashy animation
- use motion only where it improves clarity

### Loading States
- use restrained spinners, skeletons, or loading text
- avoid dramatic loading animations

---

## Iconography

Use simple, modern icons.
Preferred style:
- clean line icons
- consistent stroke widths
- minimal visual noise

Use icons to support meaning, not decorate unnecessarily.

---

## Page Types

### Dashboard Pages
Should feel:
- organized
- high-signal
- easy to scan

Use:
- summary cards
- clear sections
- restrained color
- obvious primary actions

### Form Pages
Should feel:
- guided
- uncluttered
- easy to complete

Use:
- grouped sections
- clear labels
- helpful descriptions
- obvious save/continue actions

### Detail Pages
Should feel:
- structured
- layered
- easy to review

Use:
- section headers
- cards or panels
- clear metadata hierarchy

### Tables / Admin Pages
Should feel:
- efficient
- readable
- functional

Do not overload with decorative styling.

---

## Dark Mode Default

Binga should default to a dark, slate-based UI unless a page has a strong reason not to.

Dark mode should feel:
- premium
- legible
- calm
- focused

Do not use pure black unless intentionally needed.
Prefer deep slate/navy neutrals.

---

## Mobile and Responsive Behavior

Design should remain clean on smaller screens.

Rules:
- stack layouts cleanly
- avoid dense multi-column UI on mobile
- primary actions should remain visible
- tables may require simplified treatment on small screens
- maintain generous touch targets

---

## Accessibility

All UI must remain accessible.

Requirements:
- sufficient contrast
- visible focus states
- readable text sizes
- color should not be the only signal
- buttons and inputs should be clearly identifiable

---

## What to Avoid

Do not introduce:
- random colors
- mismatched button styles
- overcrowded forms
- decorative gradients everywhere
- excessive animation
- inconsistent card styling
- tiny text
- overly bright backgrounds
- multiple competing accent colors
- childish sports graphics
- generic stock “game” visuals

Avoid making Binga feel like:
- a school project
- a toy app
- a crypto dashboard
- a casino site
- a flashy marketing landing page with no structure

---

## Visual North Star

Every Binga page should feel like it belongs to the same product.

If unsure, choose:
- simpler layout
- fewer colors
- clearer hierarchy
- stronger spacing
- more restrained styling

Consistency is more important than novelty.