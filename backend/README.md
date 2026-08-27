# Football Auction System – Backend

Real-time football player auction system built with Node.js, TypeScript, Express, Socket.IO, and MongoDB.

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js + TypeScript |
| HTTP | Express |
| Realtime | Socket.IO |
| Database | MongoDB Atlas + Mongoose |
| Validation | Zod |
| Auth | JWT + Argon2 |
| Logging | Pino |
| Testing | Vitest + Supertest |

## Architecture

Modular monolith – single Node.js process.

```
Controller → Service → Repository → Database
Socket Handler → Service → Repository
```

**Rules:**
- Business logic lives in **services only**.
- Controllers, routes, socket handlers, and Mongoose models contain **no business logic**.
- In-memory auction lock (swappable for Redis via the `AuctionLock` interface).

## Project Structure

```
backend/
├── src/
│   ├── app.ts                 # Express application
│   ├── server.ts              # Entry point: HTTP + Socket.IO + DB
│   │
│   ├── config/                # Zod-validated environment config
│   ├── common/
│   │   ├── errors/            # AppError hierarchy
│   │   ├── middleware/        # errorHandler, notFoundHandler, requestLogger
│   │   ├── types/             # Shared TypeScript types
│   │   ├── constants/         # Application constants
│   │   └── logger.ts          # Pino logger (sensitive field redaction)
│   │
│   ├── auth/                  # Authentication (Part 2)
│   ├── users/                 # User management
│   ├── rooms/                 # Auction room CRUD
│   ├── participants/          # Room participants
│   ├── players/               # Player catalogue
│   ├── roomPlayers/           # Players assigned to a room
│   ├── auction/               # Auction engine
│   ├── bids/                  # Bid processing
│   ├── squads/                # Squad management
│   ├── wallet/                # Wallet / budget tracking
│   ├── events/                # Domain event bus
│   ├── websocket/             # Socket.IO setup
│   ├── locks/                 # Auction lock abstraction
│   ├── health/                # GET /health
│   └── database/              # Mongoose connection
│
├── tests/
├── .env.example
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

## Quick Start

```bash
# Install dependencies
npm install

# Copy and fill in environment variables
cp .env.example .env

# Development (with hot reload)
npm run dev

# Production build
npm run build
npm start

# Run tests
npm test
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | No | `development` | `development` / `production` / `test` |
| `PORT` | No | `3000` | HTTP server port |
| `MONGODB_URI` | **Yes** | – | MongoDB Atlas connection string |
| `JWT_SECRET` | **Yes** | – | Secret for signing JWTs |
| `JWT_EXPIRES_IN` | No | `7d` | JWT token lifetime |
| `CORS_ORIGIN` | No | `http://localhost:5173` | Allowed CORS origin |

All variables are validated at startup with Zod. The server **will not start** if a required variable is missing or invalid.

### Local MongoDB transactions

Auction finalization uses MongoDB transactions, so local MongoDB must run as a single-node replica set. Enable `replication.replSetName: rs0` in `mongod.cfg`, restart the MongoDB service as Administrator, then initialize it once:

```powershell
mongosh --eval "rs.initiate()"
```

The local URI should include `?replicaSet=rs0`, as shown in `.env.example`.

## API

### Health Check

```
GET /health
```

**Healthy (200):**
```json
{
  "status": "ok",
  "database": "connected"
}
```

**Unhealthy (503):**
```json
{
  "status": "unhealthy",
  "database": "disconnected"
}
```

## Error Response Format

Every error response follows the same envelope:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

| Error Class | HTTP Status | Code |
|---|---|---|
| `ValidationError` | 400 | `VALIDATION_ERROR` |
| `AuthenticationError` | 401 | `AUTHENTICATION_ERROR` |
| `AuthorizationError` | 403 | `AUTHORIZATION_ERROR` |
| `NotFoundError` | 404 | `NOT_FOUND` |
| `ConflictError` | 409 | `CONFLICT` |

---

## ⚠️ Critical Auction Rule – Timer Behaviour

> **Every later part depends on this rule.**

### There is NO fixed purchase time

The timer does **not** start when a player is put up for auction. It starts **only after the first valid bid**.

### Every valid higher bid resets the timer

When a valid higher bid is placed, the countdown resets to the **full configured duration** (default: 15 seconds).

Rejected bids (insufficient funds, lower amount, etc.) do **not** reset the timer.

### Example Flow

```
Player goes LIVE
→ No timer running. Waiting for first bid.

Bid ₹10 (valid)
→ Timer starts: 15s

Bid ₹11 (valid, higher)
→ Timer resets: 15s

Bid ₹12 (valid, higher)
→ Timer resets: 15s

No further valid bid…
→ Timer reaches 0
→ Player sold to highest bidder (₹12)
```

### Authoritative Server

- The **server** owns the timer and all auction state.
- Clients receive timer syncs but never control the countdown.
- The server determines when a player is finalised (sold or unsold).

---

## Auction Principles

These rules govern the system design across all parts:

1. **2–10 participants** per auction room.
2. **One creator** per room – the user who created the room.
3. **Creator becomes a normal participant** once the auction starts (no special powers during bidding).
4. **No dedicated auctioneer** – the system is fully automated.
5. **All participants can bid** on every player.
6. **Server is authoritative** – timer, state, validation all happen server-side.
7. **Multiple auction rooms** can run simultaneously and independently.

---

## Auction Lock

The `AuctionLock` interface (`src/locks/types.ts`) abstracts the locking mechanism:

```typescript
interface AuctionLock {
  acquire(key: string, ttlMs?: number): Promise<boolean>;
  release(key: string): Promise<void>;
  isLocked(key: string): Promise<boolean>;
}
```

The initial implementation (`InMemoryAuctionLock`) uses a `Map` with TTL-based expiry. To scale beyond a single process, implement the same interface with Redis (e.g. Redlock).

---

## Testing

```bash
npm test          # run once
npm run test:watch # watch mode
npm run lint       # TypeScript check
npm run build      # production compilation
```

Tests cover:
- Authentication, registration, login, and protected routes.
- Room creation, joining, participant access, player pools, lifecycle, and isolation.
- Auction creation, state transitions, bidding, timer reset, duplicate bids, and version conflicts.
- Sold and unsold finalization, purse deduction, squad creation, transaction records, rollback, and next-player completion.
- Concurrent bids and concurrent finalization.
- Socket authentication, reconnect and state sync, presence, bid events, and cross-room isolation.
- MongoDB indexes, environment validation, error responses, and `/health`.

The test database uses a single-node MongoDB replica set so transaction rollback is tested against real MongoDB transaction semantics.

## Part 10 Final Report

### 1. Backend Architecture

The backend is a modular monolith running as one Node.js process:

```text
HTTP route/controller -> service -> repository -> MongoDB
Socket.IO handler     -> realtime service -> auction engine -> repository
```

Express handles REST APIs, Socket.IO handles authenticated realtime traffic, Mongoose provides persistence, and Pino provides structured logs with sensitive-field redaction. Auction locks are intentionally process-local for the initial single-instance deployment.

### 2. Directory Tree

```text
src/
├── app.ts, server.ts
├── auth/                 # registration, login, JWT authentication
├── auction/              # auction engine, repository, timer
├── bids/                 # bid model and repository
├── common/               # errors, middleware, types, logger, utilities
├── config/               # Zod environment validation
├── database/             # MongoDB connection lifecycle
├── events/               # ordered auction event log
├── health/               # GET /health
├── locks/                # AuctionLock abstraction and in-memory lock
├── participants/         # participant model and repository
├── players/              # player catalogue
├── roomPlayers/          # room player pool
├── rooms/                # room lifecycle and management
├── squads/               # purchased squad players
├── users/                # user model and repository
├── wallet/               # purse transaction ledger
└── websocket/            # Socket.IO auth, rooms, sync, bids, presence
```

### 3. Database Schema

MongoDB collections are `users`, `auctionrooms`, `participants`, `players`, `roomplayers`, `auctions`, `bids`, `squadplayers`, `transactions`, and `auctionevents`.

Important invariants are enforced with indexes and conditional writes:

- Unique room code.
- One participant per user per room.
- One player assignment per room/player.
- Unique auction order within a room.
- One squad purchase per room/player.
- Auction version and bid sequence for optimistic concurrency.
- Auction event sequence for ordered replay.

### 4. REST API List

| Method | Endpoint | Access |
|---|---|---|
| GET | `/health` | Public |
| POST | `/api/v1/auth/register` | Public |
| POST | `/api/v1/auth/login` | Public |
| GET | `/api/v1/auth/me` | Authenticated |
| POST | `/api/v1/rooms` | Authenticated |
| POST | `/api/v1/rooms/:roomCode/join` | Authenticated |
| GET | `/api/v1/rooms/:roomCode` | Room participant |
| GET | `/api/v1/rooms/:roomCode/participants` | Room participant |
| POST | `/api/v1/rooms/:roomCode/start` | Room creator |
| POST | `/api/v1/rooms/:roomCode/auction/start` | Room creator |
| POST | `/api/v1/rooms/:roomCode/leave` | Authenticated |
| POST | `/api/v1/rooms/:roomCode/players` | Room creator/admin |
| PATCH | `/api/v1/rooms/:roomCode/players/:roomPlayerId` | Room creator/admin |
| PATCH | `/api/v1/rooms/:roomCode/players/reorder` | Room creator/admin |
| DELETE | `/api/v1/rooms/:roomCode/players/:roomPlayerId` | Room creator/admin |
| GET | `/api/v1/players` | Admin |
| GET | `/api/v1/players/:id` | Admin |
| POST | `/api/v1/players` | Admin |

The same API routes are also mounted under `/api` for compatibility.

### 5. Socket.IO Event List

Client events:

- `room:join`
- `room:sync`
- `bid:place`

Server events:

- `participant:joined`, `participant:left`, `participant:online`, `participant:offline`
- `auction:starting`, `auction:started`, `auction:completed`
- `player:live`, `player:sold`, `player:unsold`
- `bid:accepted`, `bid:rejected`

Socket connections require a JWT in the handshake auth token or Bearer authorization header. Room join and sync always re-check membership from MongoDB.

### 6. State Machines

Auction states:

```text
CREATED -> LIVE -> FINALIZING -> SOLD
                         └─────> UNSOLD
CREATED/LIVE/FINALIZING -> CANCELLED
```

Room states:

```text
WAITING -> STARTING -> LIVE -> COMPLETING -> COMPLETED
WAITING/STARTING/LIVE -> CANCELLED
```

Transitions are validated and persisted with conditional status filters. Auction transitions increment `version`.

### 7. Auction Timer Logic

The server owns the timer. No timer runs before the first valid bid. Each valid higher bid sets `timerEndsAt` to the full configured duration and replaces the previous timer. Rejected bids do not reset it. Expiration verifies `LIVE` status and the deadline before finalization. Timer callbacks log failures instead of producing unhandled promise rejections.

### 8. Concurrency Strategy

Each auction uses an in-memory lock for finalization and a serialized bid queue for bids. Bid writes use auction `version` and monotonically increasing bid sequences. Duplicate client bid IDs are idempotent. The deployment must remain a single backend instance while locks are process-local.

### 9. Transaction Strategy

Sold and unsold finalization runs inside a MongoDB transaction. The sold transaction verifies purse and squad capacity, updates the auction and room player, deducts the participant purse, creates the squad record, creates the wallet transaction, and appends the auction event. Any failure aborts all writes. Broadcasts and next-player creation happen only after commit.

### 10. Recovery Strategy

On startup, the Socket.IO service queries live auctions associated with rooms in `LIVE` or `COMPLETING`. Future deadlines are scheduled; expired deadlines finalize through the normal lock and transaction path. Recovery is idempotent because finalization requires the auction to still be `LIVE`.

### 11. Environment Variables

Set these in Render rather than committing secrets:

```text
NODE_ENV=production
PORT=10000
MONGODB_URI=mongodb+srv://...
JWT_SECRET=<long-random-secret>
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://<client-domain>
```

All values are validated with Zod at startup. Never log `JWT_SECRET`, passwords, JWTs, or authorization headers.

### 12. Test Results

Final verification:

```text
Test files: 13 passed
Tests:      115 passed
Type check: passed
Build:      passed
```

### 13. Render and MongoDB Atlas Deployment

1. Create a MongoDB Atlas cluster and allow the Render service outbound access. Create a least-privilege database user and copy the SRV connection string.
2. Create a Render **Web Service** from the repository.
3. Set the service root directory to `backend`.
4. Use Node.js with build command `npm ci --include=dev && npm run build`.
5. Use start command `npm start`.
6. Configure the environment variables listed above. Render supplies `PORT`; keep the application listening on it.
7. Set the health check path to `/health`.
8. Deploy one instance only. Set `CORS_ORIGIN` to the complete frontend origin, including the scheme, for example `https://footballauction-phi.vercel.app` (not `footballauction-phi.vercel.app`). Use the Render HTTPS URL for Socket.IO so clients connect over WSS.
9. Verify health, JWT auth, CORS, REST routes, Socket.IO join/sync, timer reset, concurrent bidding, transactions, reconnect, restart recovery, room isolation, and structured logs.

### 14. Known Limitations

- Auction locks and rate-limit counters are in-memory and process-local; do not deploy multiple backend replicas without replacing them with shared infrastructure such as Redis/Redlock.
- Rate limiting is a lightweight in-memory guard, not a distributed abuse-prevention system.
- MongoDB Atlas must support transactions, which requires a replica set or sharded cluster.
- Deployment checks for HTTPS, WSS, Atlas networking, and production credentials must be performed in the Render environment; local tests cannot prove those infrastructure properties.

---

## Parts Roadmap

| Part | Scope |
|---|---|
| **1 (current)** | Project foundation, config, errors, health, logging, testing |
| 2 | Auth (register, login, JWT) |
| 3 | Users + Rooms CRUD |
| 4 | Participants + Room lifecycle |
| 5 | Player catalogue + Room players |
| 6 | Auction engine core |
| 7 | Bidding system |
| 8 | Squads + Wallet |
| 9 | Real-time Socket.IO events |
| 10 | Polish, edge cases, production hardening |
