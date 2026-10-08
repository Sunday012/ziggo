# Ziggo

Ziggo is an agentic customer-support workspace. Each Clerk organization gets an isolated agent that can retrieve approved company knowledge, persist conversations, expose its tool activity, and request a human handoff behind an explicit approval step.

## Stack

- Next.js 16 App Router and React 19
- Clerk authentication and organizations
- Tailwind CSS 4
- OpenRouter tool-calling chat completions
- Pinecone integrated embeddings and reranking for organization-scoped retrieval
- Neon serverless PostgreSQL for conversations, messages, audit events, approvals, and handoffs
- TypeScript and ESLint 9

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and add the server-side credentials.
3. Create a Neon project, copy its pooled connection string into `DATABASE_URL`, and run `database/migrations/001_create_agent_runtime.sql` in Neon's SQL Editor.
4. In Pinecone, create an integrated-embedding index whose source text field is named `text`, then set its name in `PINECONE_INDEX_NAME`.
5. Start the application with `npm run dev`.

The Clerk application must have Organizations enabled. The Pinecone index must support `upsertRecords` and `searchRecords`; Ziggo uses a separate namespace for every Clerk organization. Add the same environment variables to Vercel before deploying.

## How the agent works

Every run is bounded to three tool-planning rounds. The model must retrieve knowledge before making business-specific claims and receives only the relevant, reranked excerpts. Tool activity and citations stream into the UI. A human handoff is first written as a pending approval; it becomes an open handoff only after a user approves it in the activity panel.

The app remains usable with only Clerk and OpenRouter configured, but persistence, retrieval, and approvals require Neon and Pinecone.

## Commands

```bash
npm run dev
npm run typecheck
npm run lint
npm run build
```

## Security

API credentials belong in environment variables and must never be committed. All API routes authenticate both a user and an active organization, validate input size, isolate data by organization, and keep provider keys server-side. The Neon connection string is used only by server-side modules and must be stored as a secret.
