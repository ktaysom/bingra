# Architecture

## Stack

Frontend:
- Next.js (App Router)
- Tailwind + shadcn/ui

Backend:
- Supabase (Postgres + Realtime)

Deployment:
- Vercel

---

## Core Concept

Everything is event-driven.

Game state is derived from:
- event definitions
- scored events

---

## Event Flow

1. Scorer triggers event
2. Insert into scored_events
3. Realtime broadcast
4. Clients update cards
5. Win detection triggered

---

## Extensibility

Event sources can be:
- manual scorer (MVP)
- API feed (future)
- admin tools

---

## Realtime

Channel:
game:{game_id}

Events:
- event_scored
- game_started
- game_finished
- winner_declared