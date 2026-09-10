# Jtrac

Fitness + productivity PWA. Next.js 16 + Supabase.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for structure, data model, and setup.

```
npm install
cp .env.local.example .env.local   # fill in Supabase URL + anon key
npm run dev
```

Apply every SQL file in `supabase/migrations/` in numeric order via Supabase SQL Editor before first run.
