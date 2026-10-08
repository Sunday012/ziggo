# Ziggo

Ziggo is an AI customer-support workspace. Each Clerk organization gets a dedicated conversation space backed by an OpenRouter-compatible language model.

## Stack

- Next.js 16 App Router and React 19
- Clerk authentication and organizations
- Tailwind CSS 4
- OpenRouter streaming chat completions
- TypeScript and ESLint 9

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and add Clerk and OpenRouter credentials.
3. Start the application with `npm run dev`.

The Clerk application must have Organizations enabled. Add the same environment variables to Vercel before deploying.

## Commands

```bash
npm run dev
npm run typecheck
npm run lint
npm run build
```

## Security

API credentials belong in environment variables and must never be committed. The chat route authenticates both a user and an active organization, validates conversation size, and keeps the provider key server-side.
