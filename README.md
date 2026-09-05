# News Brief Desk

A newsroom workflow prototype for grouping raw incoming news items into real stories, generating short source-backed briefs, routing drafts from reporters to editors, publishing once, and giving desk heads publication analytics.

## Features

- Realistic seeded raw news items
- Groups duplicate coverage of the same event into one story
- Keeps deceptively similar but genuinely different stories separate
- Generates a concise draft brief with source list
- Reporter / Editor / Desk Head roles
- Reporters cannot publish
- Editor approval required before publication
- Published stories are treated as final
- Desk-head dashboard with yesterday's published count, subjects, and intake-to-publication time
- Optional OpenAI integration for clustering/brief generation
- Works without an API key using deterministic demo logic

## Stack

- React + Vite + TypeScript
- Tailwind CSS
- Node.js + Express
- SQLite
- Optional OpenAI API

## Run locally

Requirements: Node.js 18+

```bash
npm install
npm run dev
```

Open the URL printed by Vite.

## Demo accounts

The prototype uses a role switcher rather than a full authentication provider.

- Reporter
- Editor
- Desk Head

## AI usage

If `OPENAI_API_KEY` is configured, the server can use OpenAI for story grouping and brief drafting. The application is also designed to run with local deterministic logic so reviewers can test the complete workflow without paying for an API.

Create `.env` from `.env.example`:

```bash
OPENAI_API_KEY=your_key_here
```

## Key decisions and assumptions

1. A story represents one real-world event, not merely a topic.
2. Duplicate items are grouped using a combination of entity/event similarity rather than headline similarity alone.
3. Similar-looking items that differ in place, date, organization, or event outcome remain separate.
4. A story can receive additional raw items after its first draft.
5. Reporters can draft and submit, but the UI and API reject reporter publish attempts.
6. Publishing is a one-way workflow in this prototype; published stories are read-only.
7. Source attribution is preserved with every story.
8. No live feeds are used. Seeded raw items are the expected data source for the task.
9. Payment integrations are intentionally omitted.
10. For a production deployment, authentication, audit logs, queues, stronger entity resolution, tests, and observability would be added.

## Seeded edge cases

The dataset includes:

- Three differently worded reports about a fictional Port Azure chemical-plant fire.
- Two reports that look similar but describe separate incidents in different cities.
- Additional unrelated stories to make the incoming pile feel realistic.

## Suggested demo flow

1. Open Incoming Items.
2. Show the three fire reports grouped into one story.
3. Show the two similar-looking but separate incidents.
4. Switch to Reporter and open the generated draft.
5. Edit the brief and submit it.
6. Switch to Editor, rewrite it, and publish.
7. Switch to Desk Head and show publication count and turnaround time.

## What I would build with another week

- Real authentication and RBAC
- Persistent audit trail for every edit
- Better semantic clustering with embeddings + human confirmation
- Merge/split story controls with conflict warnings
- Source credibility metadata
- Search and filtering
- Automated ingestion adapters
- Background jobs for clustering
- Version history and rollback for drafts
- Production database migrations and automated tests
- Deployment with monitoring and error reporting
