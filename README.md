# @orgname/notify — WhatsApp Notification SDK

Internal monorepo. Plug WhatsApp notifications into any app in the organisation.

## Packages

| Package | Description |
|---|---|
| `packages/notify` | Core SDK — Node.js, React, Next.js |

## Apps

| App | Description |
|---|---|
| `apps/api` | Express demo — all use cases via REST endpoints |
| `apps/web` | Next.js demo — React hooks + API routes |

## Getting started locally

### 1. Install dependencies

```bash
npm install -g pnpm
pnpm install
```

### 2. Set up environment variables

```bash
# Express app
cp apps/api/.env.example apps/api/.env

# Next.js app
cp apps/web/.env.example apps/web/.env.local
```

Fill in your Meta WhatsApp Cloud API credentials. Get them from:
https://developers.facebook.com → Your App → WhatsApp → API Setup

### 3. Run the tests

```bash
cd packages/notify
npm install
npm test
```

### 4a. Run the Express demo

```bash
cd apps/api
npm install
npm run dev
# → http://localhost:3001
```

Test with curl:
```bash
# Opt in a number first
curl -X POST http://localhost:3001/demo/opt-in \
  -H "Content-Type: application/json" \
  -d '{"phone":"919876543210"}'

# Send OTP
curl -X POST http://localhost:3001/demo/otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"919876543210"}'

# Send task assignment
curl -X POST http://localhost:3001/demo/task-assigned \
  -H "Content-Type: application/json" \
  -d '{
    "phone":      "919876543210",
    "taskId":     "task-001",
    "title":      "Review PR #482",
    "priority":   "high",
    "assignedBy": "Priya",
    "dueDate":    "Tomorrow 5pm"
  }'

# View logs
curl http://localhost:3001/demo/logs
```

### 4b. Run the Next.js demo

```bash
cd apps/web
npm install
npm run dev
# → http://localhost:3000/demo
```

## Note: real messages require real Meta credentials

Without real credentials the HTTP client will throw (expected).
For local testing without Meta setup, the test suite mocks the HTTP layer.
All business logic (guards, templates, queue, storage) works fully offline.
