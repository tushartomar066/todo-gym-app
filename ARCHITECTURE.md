# Jtrac Architecture

Fitness + productivity tracker. Next.js App Router + Supabase.

## Stack

Next.js 16.2 (webpack, App Router). React 18.3. TypeScript 5. Tailwind 4. Supabase (Postgres + Auth via @supabase/ssr). Framer Motion. Recharts (lazy-loaded). Lucide icons. next-pwa.

## Structure

```
src/
  proxy.ts                       Next 16 auth guard (was middleware.ts)
  app/
    layout.tsx                   Root, ThemeProvider, no next/font (system stack)
    globals.css                  Tailwind v4 + theme CSS variable overrides
    page.tsx                     / login (email + Google OAuth)
    auth/callback/route.ts       OAuth exchange, safe redirect
    auth/signup/page.tsx         /auth/signup
    (app)/                       Authenticated group, wrapped by AppShell
      layout.tsx
      dashboard/page.tsx         Server component, uses getDashboardData
      todo/page.tsx + TodoClient.tsx
      gym/page.tsx + GymClient.tsx
      cardio/page.tsx + CardioClient.tsx
  components/
    AppShell.tsx                 Sidebar + mobile bottom nav
    ThemePicker.tsx
    charts/WeeklyProgressChart.tsx     Recharts, dynamic-imported
    dashboard/DashboardClient.tsx
    dashboard/WorkoutActions.tsx
    gym/ExerciseCombobox.tsx
    gym/RestTimerBar.tsx
  contexts/ThemeContext.tsx      5 themes with data-theme attribute
  lib/
    actions.ts                   All server actions (the API layer)
    date.ts                      IST timezone helpers
    supabase/client.ts           Browser client
    supabase/server.ts           Server client (reads/writes cookies)
  types/database.ts              Types match live schema post-migration 00008
supabase/migrations/             SQL, apply in numeric order
```

## Auth

`src/proxy.ts` runs on `/dashboard`, `/todo`, `/gym`, `/cardio` (matcher). It short-circuits early with a redirect if no Supabase auth cookie is present, avoiding a network round-trip to Supabase on every request. When a cookie exists, it calls `getUser()` and refreshes cookies with 3-day max-age.

`/auth/callback` exchanges the OAuth code, sanitizes the `next` param against open redirects, and lands on `/dashboard`.

## Database

Apply migrations in order. `00001` through `00007` build the current schema. `00008_indexes.sql` adds the performance indexes required for fast queries on Supabase free tier.

Tables:
- `tasks(id, user_id, title, priority CHECK(low|medium|high), is_completed, created_at, updated_at)`
- `workouts(id, user_id, date, notes, UNIQUE(user_id,date))`
- `exercises(id, workout_id, name, notes)`
- `sets(id, exercise_id, weight DECIMAL(6,2), reps, is_completed, set_type CHECK(warmup|working|drop_set|failure))`
- `cardio_logs(id, user_id, date, activity_type CHECK(run|walk|warmup|cycle|other), duration_minutes, distance_km, steps, notes)`

Every table has full CRUD RLS scoped to `auth.uid() = user_id` (nested via `workouts` for exercises/sets).

## Server actions (src/lib/actions.ts)

Every action calls `getUser()` first (throws Unauthorized if no session), then scopes the DB call to `user.id`. Reads use explicit column lists, not `SELECT *`, to minimize Supabase egress.

Tasks: `getTodayTasks`, `getTasks`, `addTask`, `toggleTaskComplete`, `deleteTask`.
Workouts: `getTodayWorkout`, `getInitialGymData`, `getPersonalRecords`, `addExercise`, `addExerciseToDate`, `addSet`, `toggleSetComplete`, `deleteSet`, `deleteExercise`, `deleteWorkout`, `updateExerciseNotes`, `markAllSetsComplete`, `getPreviousExerciseDataBatch`.
Cardio: `getCardioLogs`, `addCardioLog`, `updateCardioLog`, `deleteCardioLog`.
Dashboard aggregate: `getDashboardData`.

## Time zone

The app uses IST (Asia/Kolkata) for all "today" and "this week" queries. `src/lib/date.ts` exposes:
- `getTodayIST()`, `getYesterdayIST()`  YYYY-MM-DD strings
- `istDayBounds(date)`  UTC ISO range that covers one IST calendar day
- `istRangeBounds(start, end)`  UTC ISO range across multiple IST days
- `utcToIstDate(iso)`  UTC timestamptz to IST calendar date

Server queries filter on UTC bounds; UI bucketing uses `utcToIstDate` to translate rows back to IST calendar dates. Do not compare an IST YYYY-MM-DD string directly to a timestamptz column.

## Themes

5 themes: dark (base, no `data-theme`), light, acid, floors, liberty. CSS variable overrides live in `globals.css`. Theme persisted in `localStorage['fittrack-theme']`. An inline `<script>` in `layout.tsx` applies the stored theme before first paint, preventing FOUC.

## PWA

`next-pwa` writes `public/sw.js` and `public/workbox-*.js` on build. Manifest at `public/manifest.json`. Disabled in dev.

## Setup

```
npm install
```

Create `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Apply every SQL file in `supabase/migrations/` in numeric order (00001 to 00008) via Supabase SQL Editor.

```
npm run dev        # webpack dev server
npm run build      # production build (webpack, required by next-pwa)
npm start
```
