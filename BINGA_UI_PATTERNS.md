# Binga UI Patterns

## Purpose
This document defines the canonical UI patterns for Binga.

When building new pages or updating existing pages, Cline should prefer these patterns over inventing new layouts.

These patterns exist to improve:
- visual consistency
- component reuse
- speed of implementation
- product cohesion

All patterns must also follow:
- `BINGA_DESIGN_SYSTEM.md`
- `CLINE_UI_RULES.md`

---

# Global Rules for All Patterns

## Layout Principles
- default to dark-mode-first styling
- use clear hierarchy
- keep spacing consistent
- prefer cards for grouped content
- keep pages breathable, not cramped
- avoid unnecessary nesting

## Standard Containers
- normal app content: `max-w-6xl mx-auto px-4 py-6`
- narrower form/settings pages: `max-w-3xl mx-auto px-4 py-6`
- wide data pages: `max-w-7xl mx-auto px-4 py-6`

## Standard Spacing
- page section gap: `space-y-6`
- card internal spacing: `p-4` or `p-6`
- grid gap: `gap-4` or `gap-6`

## Standard Surface Styling
- page background: dark/slate app background
- card background: slate surface
- card border: subtle
- text hierarchy: strong title, muted supporting text

---

# Pattern 1: Standard App Page Header

## Use For
Use this for almost every primary app page:
- home/dashboard
- game page
- create game page
- settings
- profile
- admin pages

## Structure
- page title on left
- supporting description below title
- primary and secondary actions on right or below on mobile

## Behavior
- title should be short and clear
- description should explain the page in one sentence
- actions should be limited to the most important 1-3 buttons
- avoid clutter

## Canonical Layout
```tsx
<div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
  <div className="space-y-1">
    <h1 className="text-2xl font-bold tracking-tight text-slate-100">
      Page Title
    </h1>
    <p className="text-sm text-slate-400">
      Short explanation of what this page helps the user do.
    </p>
  </div>

  <div className="flex flex-wrap gap-2">
    <Button variant="outline">Secondary Action</Button>
    <Button>Primary Action</Button>
  </div>
</div>
```

---

# Pattern 2: Dashboard / Home Page

## Use For
Use this for:
- logged-in home screen
- game host overview
- player lobby / join screen
- admin overview

## Structure
1. page header
2. summary cards
3. main content area
4. optional secondary panels

## Summary Card Rules
Summary cards should:
- show one key metric or state
- include a concise label
- optionally include one short supporting line
- stay visually consistent

Examples of metrics:
- active games
- players in current game
- cards generated
- recent activity

## Canonical Layout
```tsx
<div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
    <div className="space-y-1">
      <h1 className="text-2xl font-bold tracking-tight text-slate-100">
        Dashboard
      </h1>
      <p className="text-sm text-slate-400">
        Manage your games and activity.
      </p>
    </div>

    <div className="flex flex-wrap gap-2">
      <Button variant="outline">Join Game</Button>
      <Button>Create Game</Button>
    </div>
  </div>

  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <Card className="border-slate-700 bg-slate-800">
      <CardContent className="p-4 space-y-1">
        <p className="text-sm text-slate-400">Active Games</p>
        <p className="text-2xl font-semibold text-slate-100">3</p>
        <p className="text-xs text-slate-500">Currently running</p>
      </CardContent>
    </Card>

    <Card className="border-slate-700 bg-slate-800">
      <CardContent className="p-4 space-y-1">
        <p className="text-sm text-slate-400">Players</p>
        <p className="text-2xl font-semibold text-slate-100">24</p>
        <p className="text-xs text-slate-500">Across active games</p>
      </CardContent>
    </Card>

    <Card className="border-slate-700 bg-slate-800">
      <CardContent className="p-4 space-y-1">
        <p className="text-sm text-slate-400">Cards Generated</p>
        <p className="text-2xl font-semibold text-slate-100">120</p>
        <p className="text-xs text-slate-500">Total created</p>
      </CardContent>
    </Card>

    <Card className="border-slate-700 bg-slate-800">
      <CardContent className="p-4 space-y-1">
        <p className="text-sm text-slate-400">Status</p>
        <p className="text-2xl font-semibold text-slate-100">Ready</p>
        <p className="text-xs text-slate-500">No issues</p>
      </CardContent>
    </Card>
  </div>

  <div className="grid gap-6 xl:grid-cols-3">
    <Card className="border-slate-700 bg-slate-800 xl:col-span-2">
      <CardHeader>
        <CardTitle className="text-slate-100">Main Workspace</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-slate-300">
        Primary content goes here.
      </CardContent>
    </Card>

    <Card className="border-slate-700 bg-slate-800">
      <CardHeader>
        <CardTitle className="text-slate-100">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-slate-300">
        Recent actions and updates.
      </CardContent>
    </Card>
  </div>
</div>
```

---

# Pattern 3: Create / Edit Form Page

## Use For
- create game
- edit game settings
- profile/account settings
- admin configuration

## Structure
1. page header
2. grouped form cards
3. bottom action bar

## Form Rules
- group related inputs together
- each card = one logical section
- keep labels short and clear
- avoid long, overwhelming forms

## Canonical Layout
```tsx
<div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
  <div className="space-y-1">
    <h1 className="text-2xl font-bold tracking-tight text-slate-100">
      Create Game
    </h1>
    <p className="text-sm text-slate-400">
      Set up a new game and customize how it works.
    </p>
  </div>

  <Card className="border-slate-700 bg-slate-800">
    <CardHeader>
      <CardTitle className="text-slate-100">Game Details</CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Game Name</Label>
        <Input id="name" placeholder="Enter game name" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="visibility">Visibility</Label>
        <Input id="visibility" placeholder="Public or Private" />
      </div>
    </CardContent>
  </Card>

  <Card className="border-slate-700 bg-slate-800">
    <CardHeader>
      <CardTitle className="text-slate-100">Game Settings</CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="size">Card Size</Label>
        <Input id="size" placeholder="e.g. 5x5" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="rules">Rules</Label>
        <Input id="rules" placeholder="Optional rules" />
      </div>
    </CardContent>
  </Card>

  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
    <Button variant="outline">Cancel</Button>
    <Button>Create Game</Button>
  </div>
</div>
```

---

# Pattern 4: List / Table Page

## Use For
- games list
- players list
- admin users
- activity logs

## Structure
1. page header
2. filters/search
3. list or table
4. optional actions

## Rules
- filters go above content
- prioritize readability
- avoid clutter
- use actions sparingly

## Canonical Layout
```tsx
<div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
    <div className="space-y-1">
      <h1 className="text-2xl font-bold tracking-tight text-slate-100">
        Games
      </h1>
      <p className="text-sm text-slate-400">
        View and manage your games.
      </p>
    </div>

    <div className="flex gap-2">
      <Button variant="outline">Export</Button>
      <Button>Create Game</Button>
    </div>
  </div>

  <Card className="border-slate-700 bg-slate-800">
    <CardContent className="p-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="search">Search</Label>
          <Input id="search" placeholder="Search games..." />
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Input id="status" placeholder="Filter status" />
        </div>
      </div>
    </CardContent>
  </Card>

  <Card className="border-slate-700 bg-slate-800">
    <CardContent className="p-0">
      <div className="divide-y divide-slate-700">
        <div className="p-4 flex justify-between items-center">
          <div>
            <p className="text-slate-100 font-medium">Game Name</p>
            <p className="text-sm text-slate-400">12 players</p>
          </div>
          <Button variant="outline" size="sm">Open</Button>
        </div>
      </div>
    </CardContent>
  </Card>
</div>
```

---

# Pattern 5: Empty State

## Use For
- no games yet
- no players
- no results
- no activity

## Rules
- clearly explain what is missing
- suggest next step
- include one primary action

## Canonical Layout
```tsx
<Card className="border-dashed border-slate-700 bg-slate-800/70">
  <CardContent className="flex flex-col items-center justify-center px-6 py-12 text-center">
    <div className="space-y-2 max-w-md">
      <h2 className="text-lg font-semibold text-slate-100">
        No games yet
      </h2>
      <p className="text-sm text-slate-400">
        Create your first game to get started.
      </p>
    </div>

    <div className="mt-6 flex flex-wrap justify-center gap-2">
      <Button>Create Game</Button>
      <Button variant="outline">Learn More</Button>
    </div>
  </CardContent>
</Card>
```

---

# Pattern 6: Secondary Section Card

## Use For
- quick links
- notes
- recent activity
- alerts
- small summaries

## Canonical Layout
```tsx
<Card className="border-slate-700 bg-slate-800">
  <CardHeader className="pb-3">
    <CardTitle className="text-base text-slate-100">
      Section Title
    </CardTitle>
  </CardHeader>
  <CardContent className="space-y-3 text-sm text-slate-300">
    <p>Short summary or content goes here.</p>
  </CardContent>
</Card>
```