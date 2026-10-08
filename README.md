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
3. Create a Neon project, copy its pooled connection string into `DATABASE_URL`, then run every file in `database/migrations` in numerical order in Neon's SQL Editor.
4. In Pinecone, create an integrated-embedding index whose source text field is named `text`, then set its name in `PINECONE_INDEX_NAME`.
5. Start the application with `npm run dev`.

The Clerk application must have Organizations enabled. In Clerk's **User & authentication** settings, enable email-address sign-up, email verification codes, email sign-in, and passwords. Ziggo renders its own sign-in, sign-up, verification, recovery, account, and workspace interfaces; Clerk remains the underlying session and membership service. The Pinecone index must support `upsertRecords` and `searchRecords`; Ziggo uses a separate namespace for every Clerk organization. Add the same environment variables to Vercel before deploying.

## Knowledge sources

Workspace members can paste reviewed text or upload PDF, DOCX, TXT, Markdown, CSV, and JSON documents from the Knowledge panel. Uploads are limited to 4 MB and 400,000 extracted characters. Ziggo records the source and indexing state in Neon, deduplicates matching content, batches embeddings into Pinecone, and removes both the metadata and vectors when a source is deleted.

Google Drive can be connected from the Knowledge panel. Create a Google Cloud OAuth web application, enable the Drive API, and add `<NEXT_PUBLIC_APP_URL>/api/integrations/google-drive/callback` as an authorized redirect URI. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and a base64 32-byte `INTEGRATION_ENCRYPTION_KEY`. Ziggo requests read-only Drive access, encrypts refresh tokens with AES-256-GCM, and indexes supported new or changed files when a teammate clicks sync.

WhatsApp uses Meta's Cloud API for verified inbound capture. Configure the panel with a permanent system-user token and phone number ID, then subscribe the Meta app to `messages` at `<NEXT_PUBLIC_APP_URL>/api/webhooks/whatsapp`. Set the webhook verification value to `WHATSAPP_VERIFY_TOKEN` and add the Meta app secret as `WHATSAPP_APP_SECRET`. Inbound text becomes an organization-owned conversation; Ziggo does not send automatic customer replies or learn from it until a teammate approves the conversation in the review queue.

All connector credentials are encrypted before Neon storage. Generate the encryption key with `openssl rand -base64 32`, store it as a Vercel secret, and keep it stable—changing it makes existing connections unreadable.

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
