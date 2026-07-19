# The Chair Beside You

> For the days when nobody sits beside you.

A quiet, AI-powered emotional wellness companion for loneliness, self-doubt, interview anxiety, and heavy days. Built to feel like a caring presence — not a productivity tool, not a chatbot.

---

## ✨ Features

| # | Surface | What it does |
|---|---------|--------------|
| 01 | **Tears Journal** | Text & voice journaling with gentle AI reflections |
| 02 | **Confidence Garden** | Plant small brave actions; watch resilience bloom |
| 03 | **AI Companion** | A witness, not a coach — streaming conversations with emotional memory |
| 04 | **Future Letters** | Write to your future self, delivered on the day you need it |
| 05 | **Victory Vault** | Archive wins, kind words, and proof of how far you've come |
| 06 | **Confidence Coach** | Personalized rituals for interviews, presentations, vivas, meetings |
| — | **SOS Mode** | One-click grounding: 4-7-8 breathing, 5-4-3-2-1 grounding, rotating quotes, and *Neon Drift* — a calming canvas mini-game |

The AI **remembers your emotional journey** and gently reminds you of moments when you were stronger than you believed.

---

## 🧱 Tech Stack

- **Framework**: [TanStack Start](https://tanstack.com/start) v1 (React 19 + Vite 7, SSR + server functions)
- **Styling**: Tailwind CSS v4 with a custom Zen-minimalist design system (`canvas`, `ink`, `sage`, `taupe`)
- **Backend**: Lovable Cloud (Postgres + Auth + Storage) with row-level security
- **AI**: Lovable AI Gateway (Google Gemini) via the Vercel AI SDK — streaming chat, reflections, coaching plans
- **Runtime**: Cloudflare Workers (edge)
- **Game**: Custom HTML5 Canvas engine (`src/components/neon-drift/`) — inertia physics, particles, power-ups, 60 FPS

---

## 🚀 Getting Started

```bash
bun install
bun run dev
```

Then open [http://localhost:8080](http://localhost:8080).

### Build

```bash
bun run build         # production build
bun run build:dev     # dev/preview build
```

---

## 📁 Project Structure

```
src/
├── routes/                    # File-based routes (TanStack Router)
│   ├── __root.tsx             # App shell, fonts, global head
│   ├── index.tsx              # Landing page
│   ├── auth.tsx               # Sign in / sign up
│   ├── sos.tsx                # SOS grounding + Neon Drift game
│   ├── _authenticated/        # Auth-gated routes
│   │   ├── companion.tsx      # AI companion chat
│   │   ├── journal.tsx        # Tears Journal
│   │   ├── garden.tsx         # Confidence Garden
│   │   ├── letters.tsx        # Future Letters
│   │   ├── vault.tsx          # Victory Vault
│   │   └── coach.tsx          # Confidence Coach
│   └── api/chat.ts            # Streaming chat endpoint
├── lib/                       # *.functions.ts server functions
├── components/
│   ├── AppNav.tsx
│   └── neon-drift/            # Canvas game engine
├── integrations/supabase/     # Auto-generated clients (don't edit)
└── styles.css                 # Tailwind v4 theme + animations
```

---

## 🗄️ Database

Tables (all with RLS scoped to `auth.uid()`):

- `profiles` — auto-created on signup
- `chat_threads`, `chat_messages` — companion conversations
- `journal_entries` — journal + AI reflection
- `garden_actions` — brave actions (flower / tree / star)
- `future_letters` — scheduled self-letters
- `victories` — saved wins
- `confidence_plans` — coach-generated plans
- `emotional_memories` — long-term emotional context for the AI

---

## 🎨 Design Principles

- **Zen minimalist**: warm off-white canvas, serif display type (Cormorant Garamond), quiet motion
- **No corporate wellness clichés** — never tell someone to "just be confident"
- **Human first**: the copy is written to a person, not a user
- **Breathe animation, soft aura gradients, glass surfaces** — nothing shouts

---

## 🔒 Privacy

Everything you write stays in your account. RLS ensures no user can read another user's data. The AI has access only to your own emotional memories, and only to help reflect them back to you.

---

## 📜 License

Private project. All rights reserved.

*Rest. You've earned it.*
