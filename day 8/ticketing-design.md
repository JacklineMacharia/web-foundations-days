# TicketHub Design Document

TicketHub is a website that sells tickets for concerts and events. This document follows the six-part framework: requirements, estimates, API, data model, architecture and trade-offs.

## 1. Requirements

### Functional requirements

- Users can register and log in.
- Users can browse and search events (by name, date or city).
- Users can open an event and see its seat map with availability.
- Users can **hold** one or more seats for a short time (5 minutes) while they pay.
- Users can pay for their held seats.
- After payment, users receive their tickets and can view them later under "My tickets".
- If a hold is not paid in time, the seats are released for other people.

### Non-functional requirements

- **Speed:** browsing pages respond in under 300 ms. During a big sale, the seat map and hold requests still respond in about 1 second.
- **Correctness:** a seat must never be sold to two people. A user is never charged without getting a ticket, and never gets a ticket without paying. This matters more than speed.
- **Fairness:** people are served in the order they arrived, bots cannot jump the line, and one person cannot buy up all the seats (limit of 4 tickets per person per event).
- **Availability:** the site must stay up during a big sale, even if it has to slow people down.
- **Scalability:** it can handle a sudden jump of hundreds of times the normal traffic.
- **Security:** passwords are hashed, traffic uses HTTPS, and card details are handled by a payment provider, not stored by TicketHub.
- **Durability:** a paid order is never lost.

## 2. Estimates

### Assumptions

- 2,000,000 registered users.
- One day is about 100,000 seconds (a rounded estimate; the exact figure is 86,400).
- Peak traffic on a normal day is 5× the average.
- Each person in the big sale makes about 10 requests (open the page, join the queue, view seats, hold seats, pay), and about 2 of them are hold attempts.
- One ticket with its order data takes about 1 KB of storage.

### Normal day

- Visitors: 50,000, each viewing 10 pages, so 500,000 page views per day.
- Page views per second: 500,000 ÷ 100,000 = **5 per second** on average, about **25 per second** at peak.
- Tickets sold: 5,000 per day, so 5,000 ÷ 100,000 = **0.05 per second** (one ticket every 20 seconds).
- Storage: 5,000 × 1 KB = 5 MB per day, about 1.8 GB per year. This is tiny.

### Big sale (popular concert)

- 200,000 people try to buy 20,000 seats in the first 10 minutes (600 seconds).
- People arriving: 200,000 ÷ 600 = about **333 people per second**.
- Requests: 200,000 × 10 = 2,000,000 requests in 600 seconds, about **3,300 requests per second**.
- Seat hold attempts (writes): 200,000 × 2 = 400,000 in 600 seconds, about **670 per second**.
- Tickets sold: 20,000 ÷ 600 = about **33 per second** if all seats sell within the 10 minutes.
- Competition: 200,000 people for 20,000 seats is **10 people per seat**, so about 180,000 people will not get a ticket.
- Storage: 20,000 tickets × 1 KB = 20 MB, which is small.

### Comparison

| Measure | Normal day | Big sale | Difference |
|---|---|---|---|
| Requests per second | 5 average, 25 peak | about 3,300 | about 130× the normal peak |
| Tickets sold per second | 0.05 | about 33 | about 650× |
| Write attempts on seats | almost none | about 670 per second, all on the same event | very high contention |

- The problem is **not storage**. The problem is a huge, sudden spike in which thousands of people fight for the same 20,000 rows at the same time.
- The normal system could never handle this, so the design needs a waiting room, a cache and careful seat locking.
- The system is read-heavy on a normal day, but during a big sale it becomes **write-contention heavy**, because everyone wants the same seats.

## 3. API

Base URL: `https://api.tickethub.example/v1`. All requests except browsing and login need `Authorization: Bearer <token>`.

| Method | Path | Description | Success status |
|---|---|---|---|
| GET | `/events` | Browse and search events (`?q=`, `?city=`, `?page=`) | `200 OK` |
| GET | `/events/{id}` | Get the details of one event | `200 OK` |
| GET | `/events/{id}/seats` | View the seat map and which seats are available | `200 OK` |
| POST | `/events/{id}/queue` | Join the waiting room for a popular event | `202 Accepted` |
| POST | `/events/{id}/holds` | Hold seats for 5 minutes | `201 Created` |
| DELETE | `/holds/{holdId}` | Release held seats early | `204 No Content` |
| POST | `/orders` | Pay for a hold and create the order | `201 Created` |
| GET | `/me/tickets` | View the logged-in user's tickets | `200 OK` |
| POST | `/auth/login` | Log in and receive a token | `200 OK` |

### Example: hold seats

Request:

```json
POST /events/12/holds
{
  "seatIds": [501, 502]
}
```

Response `201 Created`:

```json
{
  "holdId": "h_88f2",
  "eventId": 12,
  "seatIds": [501, 502],
  "expiresAt": "2026-11-03T18:05:00Z"
}
```

### Example: pay

Request (the `Idempotency-Key` header makes sure a repeated click does not charge twice):

```json
POST /orders
Idempotency-Key: 7c1b-4d9e-a3f0
{
  "holdId": "h_88f2",
  "paymentToken": "tok_visa_123"
}
```

Response `201 Created`:

```json
{
  "orderId": 3021,
  "status": "paid",
  "tickets": [
    { "ticketId": 9001, "seatId": 501, "code": "TH-8F2K-9921" },
    { "ticketId": 9002, "seatId": 502, "code": "TH-8F2K-9922" }
  ]
}
```

### Errors

| Status | When it happens |
|---|---|
| `400` | Invalid request, for example more than 4 seats |
| `401` | Not logged in |
| `404` | Event or hold does not exist |
| `409` | A seat is already held or sold by someone else |
| `410` | The hold has expired |
| `429` | Too many requests (rate limit), or the user must wait in the queue |
| `402` | Payment failed |

## 4. Data model

### Tables

- **users**: `id` (PK), `email` (unique), `password_hash`, `name`, `created_at`
- **events**: `id` (PK), `name`, `venue`, `city`, `starts_at`, `on_sale_at`
- **seats**: `id` (PK), `event_id` (FK to events), `section`, `row_label`, `seat_number`, `price_cents`, `status` (`available`, `held`, `sold`), `held_by` (FK to users, can be empty), `hold_expires_at`
- **orders**: `id` (PK), `user_id` (FK to users), `event_id` (FK to events), `total_cents`, `status` (`pending`, `paid`, `failed`), `payment_ref` (unique), `created_at`
- **tickets**: `id` (PK), `order_id` (FK to orders), `seat_id` (FK to seats, **UNIQUE**), `code` (unique)

### Relationships

- One user has many orders (one-to-many).
- One event has many seats (one-to-many).
- One event has many orders (one-to-many).
- One order has many tickets (one-to-many).
- One seat has at most **one** ticket (one-to-one, enforced by `UNIQUE (seat_id)`).
- Users and seats are linked in two ways: temporarily by a hold (`held_by`), and permanently through orders and tickets.

### SQL (PostgreSQL)

```sql
CREATE TABLE users (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name          VARCHAR(100) NOT NULL,
    created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE events (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name       VARCHAR(200) NOT NULL,
    venue      VARCHAR(200) NOT NULL,
    city       VARCHAR(100) NOT NULL,
    starts_at  TIMESTAMP NOT NULL,
    on_sale_at TIMESTAMP NOT NULL
);

CREATE TABLE seats (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id        BIGINT NOT NULL REFERENCES events (id),
    section         VARCHAR(20) NOT NULL,
    row_label       VARCHAR(10) NOT NULL,
    seat_number     INTEGER NOT NULL,
    price_cents     INTEGER NOT NULL CHECK (price_cents >= 0),
    status          VARCHAR(10) NOT NULL DEFAULT 'available'
                    CHECK (status IN ('available', 'held', 'sold')),
    held_by         BIGINT REFERENCES users (id),
    hold_expires_at TIMESTAMP,
    UNIQUE (event_id, section, row_label, seat_number)
);

CREATE TABLE orders (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users (id),
    event_id    BIGINT NOT NULL REFERENCES events (id),
    total_cents INTEGER NOT NULL,
    status      VARCHAR(10) NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'paid', 'failed')),
    payment_ref VARCHAR(100) UNIQUE,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE tickets (
    id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders (id),
    seat_id  BIGINT NOT NULL UNIQUE REFERENCES seats (id),
    code     VARCHAR(30) NOT NULL UNIQUE
);

CREATE INDEX idx_seats_event_status ON seats (event_id, status);
```

The index on `seats (event_id, status)` makes "show the available seats for this event" fast.

### How the design prevents two people buying the same seat

Double-booking is stopped in four layers, so that even if one layer fails, another catches it.

**1. Hold the seats inside a transaction, with row locks**

All seat changes go to the **primary database** only (never the cache or a replica). When a user asks to hold seats, the server runs one transaction:

```sql
BEGIN;

-- Lock the requested seats, always in id order to avoid deadlocks
SELECT id FROM seats
WHERE id IN (501, 502)
  AND event_id = 12
  AND (status = 'available'
       OR (status = 'held' AND hold_expires_at < NOW()))
ORDER BY id
FOR UPDATE;

-- If fewer rows came back than seats requested: ROLLBACK and reply 409.

UPDATE seats
SET status = 'held', held_by = 7, hold_expires_at = NOW() + INTERVAL '5 minutes'
WHERE id IN (501, 502);

COMMIT;
```

- `FOR UPDATE` locks those rows. If two people ask for seat 501 at the same moment, the database makes the second transaction **wait**.
- When the first one commits, the second one re-checks the seat, sees it is now `held`, gets no row back, and rolls back with `409 Conflict`.
- It is **all or nothing**: if the user asks for two seats and only one is free, neither is held (the transaction is atomic).
- Locking in the same order (by id) means two transactions cannot lock each other's seats and get stuck.

**2. A hold has an expiry time**

- A hold lasts 5 minutes (`hold_expires_at`). An expired hold counts as available, and a background worker also sets those seats back to `available`.
- This stops seats being blocked forever by people who leave without paying.

**3. Check the hold again at payment**

When the user pays, a second transaction checks that the seats are still held by this user and not expired. Only then does it mark them `sold`, create the order and insert the tickets:

```sql
UPDATE seats
SET status = 'sold'
WHERE id IN (501, 502) AND held_by = 7 AND status = 'held' AND hold_expires_at > NOW();
-- must update exactly 2 rows, otherwise ROLLBACK and reply 410
```

Payment uses an idempotency key, so a double click or retry cannot charge the card twice. If the card is charged but the transaction fails, the order is marked for an automatic refund.

**4. A database constraint as the last line of defence**

- `tickets.seat_id` is `UNIQUE`. Even if there were a bug in the application code, the database would refuse to create a second ticket for the same seat, and the transaction would fail.
- Because the rule lives in the database and not only in the code, it holds no matter which server or which request tries to break it.

**The cache is never trusted for correctness.** The seat map shown to users may be a second or two old, so someone may click a seat that was just taken. That is fine: they receive a `409` and a friendly message ("That seat was just taken, please choose another"). Only the primary database decides who gets a seat.

## 5. Architecture

### Diagram

```
                      +-------------------+
                      |      Clients      |
                      |  (web / mobile)   |
                      +---------+---------+
                                |
                      +---------v---------+
                      |        DNS        |
                      +---------+---------+
                                |
             +------------------+-------------------+
             |                                      |
   static files, event pages              API requests (/v1/...)
             |                                      |
      +------v------+                    +----------v-----------+
      |     CDN     |                    |    Load Balancer     |
      +-------------+                    |   + rate limiting    |
                                         +----------+-----------+
                                                    |
                                         +----------v-----------+
                                         |    Waiting Room      |  admits users at a
                                         |  (virtual queue)     |  fixed rate
                                         +----------+-----------+
                                                    |
                          +-------------------------+-------------------------+
                          |                         |                         |
                   +------v-------+          +------v-------+          +------v-------+
                   | App Server 1 |          | App Server 2 |   ...    | App Server N |
                   +--+----+---+--+          +--+----+---+--+          +--+----+---+--+
                      |    |   |                |    |   |                |    |   |
        +-------------+    |   +----------------+----+---+----------------+    |   |
        |                  |                         |                          |   |
  +-----v------+   +-------v-----------------+  +----v-----------------+   +----v---v----------+
  |   Cache    |   |        Database         |  |   Message Queue      |   | Payment Provider  |
  |  (Redis)   |   |  Primary: seat holds,   |  | (emails, tickets,    |   |    (external)     |
  | seat map,  |   |  orders, tickets        |  |  expired holds)      |   +-------------------+
  | events     |   |      | replication      |  +----------+-----------+
  +------------+   |  Read Replica: browsing |             |
                   +-------------------------+      +------v------+
                                                    |   Workers   |
                                                    +-------------+
```

### Components

- **Clients:** The web or mobile app people use to browse events and buy tickets.
- **DNS:** It turns `tickethub.example` into the address of our CDN and load balancer, so we can move or add servers without changing the name.
- **CDN:** It serves images, scripts and event pages from locations near the user, so the huge crowd looking at the event page never touches our servers.
- **Load balancer with rate limiting:** It spreads requests over many app servers, removes failed servers, and blocks bots and people who send too many requests, which protects fairness.
- **Waiting room (virtual queue):** It puts the 200,000 people in order of arrival and lets only a small number into the buying flow at a time, so the database is not overwhelmed.
- **App servers:** They run the TicketHub logic and keep no data of their own, so we can add many more before a big sale.
- **Cache (Redis):** It keeps event details and a recent copy of the seat map (refreshed every second or two) in fast memory, so thousands of people can look at seats without querying the database each time.
- **Primary database:** It is the single source of truth, and it handles every seat hold, order and ticket using transactions and locks so no seat is sold twice.
- **Read replica:** It answers browsing and search queries, so reads do not slow down the writes that sell tickets.
- **Message queue:** It holds background jobs, such as sending tickets by email and releasing expired holds, so users do not wait for them and jobs are not lost.
- **Workers:** They take jobs from the queue and do the slow work in the background, such as creating ticket codes and PDFs, sending emails and freeing expired seats.
- **Payment provider:** An outside service that handles card payments safely, so TicketHub never stores card numbers.

### How the design survives the big sale

1. **Before the sale:** the event page is served from the CDN, and we add extra app servers in advance, because we know the sale time.
2. **At the start:** 200,000 people arrive, but the waiting room only lets in a controlled number at a time (for example 100 people per second). The others see a "You are in line" page that costs almost nothing to serve.
3. **Browsing the seats:** the seat map comes from the cache, so the database is not hit by thousands of seat-map reads.
4. **Holding seats:** only the people who got through the queue reach the database, and each hold is a short transaction on a few rows. The locks keep it correct, and the limited entry rate keeps the load at a level the primary can handle.
5. **Paying:** the payment provider is called after the hold, outside the database transaction, so locks are not held while waiting for a slow card payment.
6. **After paying:** ticket emails and PDFs are created by workers from the queue, so the buying flow stays fast.
7. **When seats sell out:** the cache shows "sold out" immediately, and the remaining people are told straight away instead of repeatedly retrying.
8. **No single point of failure:** there are several app servers, a replicated cache, a read replica that can be promoted if the primary fails, and a replicated queue with several workers.

## 6. Trade-offs

- **Waiting room: protection and fairness vs a slower experience.**
  - It protects the system and serves people first come, first served, but people must wait and may feel frustrated. It also adds another component to build and test.
  - We accept this because without it the site would crash and nobody would get tickets.
- **Cached seat map: speed vs accuracy.**
  - The cache lets thousands of people view seats at once, but the map can be one or two seconds out of date, so some people pick a seat that was just taken and get a `409` error.
  - We accept this because the database still makes the final decision, so correctness is never at risk.
- **Strong consistency on one primary database: correctness vs write scaling.**
  - Using a single primary with transactions and locks guarantees no double-booking, but all seat writes go to one place, which limits how many writes per second we can handle.
  - At about 670 hold attempts per second (reduced further by the waiting room) one primary is enough. If we grew much larger, we could split the data by event, because each event's seats are independent.
- **Hold time: fairness to buyers vs seats sitting unused.**
  - A longer hold (such as 10 minutes) gives people time to pay but blocks seats from others. A short hold (such as 5 minutes) frees seats faster but can rush people.
  - We chose 5 minutes as a balance.
