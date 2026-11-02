# SnapShare Scaling Plan

SnapShare is a photo-sharing app. Users upload photos and scroll a feed of photos from people they follow.

## 1. Assumptions

- 10,000,000 registered users.
- 10% of users are active each day.
- Each active user uploads 1 photo per day.
- Each active user views 50 feed pages per day.
- An average photo is 2 MB, and each photo also gets a 50 KB thumbnail.
- One day is about 100,000 seconds (a rounded estimate; the exact figure is 86,400).
- Peak traffic is 5× the average.
- One year is 365 days.

**Daily active users (DAU)**

- 10,000,000 × 10% = **1,000,000 DAU**

## 2. Estimates

### Uploads per second

- Uploads per day: 1,000,000 users × 1 photo = 1,000,000 uploads
- Average: 1,000,000 ÷ 100,000 = **10 uploads per second**
- Peak: 10 × 5 = **50 uploads per second**

### Feed views per second

- Feed views per day: 1,000,000 users × 50 = 50,000,000 views
- Average: 50,000,000 ÷ 100,000 = **500 feed views per second**
- Peak: 500 × 5 = **2,500 feed views per second**

### Storage per year

- Photos per day: 1,000,000 × 2 MB = 2,000,000 MB = 2 TB
- Photos per year: 2 TB × 365 = **730 TB**
- Thumbnails per day: 1,000,000 × 50 KB = 50 GB
- Thumbnails per year: 50 GB × 365 = about **18 TB**
- Total per year: about **750 TB** (roughly 0.75 PB)

## 3. Read-heavy or write-heavy?

- SnapShare is **read-heavy**.
- There are 50,000,000 feed views per day against 1,000,000 uploads per day, so reads outnumber writes about **50 to 1**.
- What this means for the design:
  - Make reads fast and cheap: use a cache for hot feed data and a CDN for photo files.
  - Add read replicas so the database can spread read traffic across several copies.
  - Writes are fewer, so one primary database can handle them at first, and slow work (such as thumbnails) can be done in the background.

## 4. Why photos do not go in the database

- A photo is a large binary file (2 MB each), and about 730 TB of them are added every year. Storing them in database rows would make the database huge, slow and expensive.
- Every backup, replica copy and query would have to move or skip all that data.
- Databases are built for small structured records, not big files.
- Instead, the photo files go in **object storage** (such as Amazon S3).
  - Object storage is cheap, nearly unlimited in size and built for large files.
  - The database stores only the **URL (or key)** of each photo, plus small details such as the owner, caption and upload time.
  - Users download photos through a **CDN** that sits in front of object storage.

## 5. Architecture diagram

```
                          +----------------+
                          |     Users      |
                          | (web / mobile) |
                          +-------+--------+
                                  |
                +-----------------+------------------+
                |                                    |
        photo files (GET)                    API requests (feed, upload)
                |                                    |
        +-------v--------+                   +-------v--------+
        |      CDN       |                   | Load Balancer  |
        +-------+--------+                   +-------+--------+
                |  (cache miss)                      |
                |                    +---------------+---------------+
                |                    |               |               |
                |             +------v-----+  +------v-----+  +------v-----+
                |             | App Server |  | App Server |  | App Server |
                |             +--+--+--+---+  +--+--+--+---+  +--+--+--+---+
                |                |  |  |         (all app servers talk to the
                |                |  |  |          components below)
                |      +---------+  |  +-----------------------+
                |      |            |                          |
                |  +---v-----+  +---v------------------+  +----v----------------+
                |  |  Cache  |  |       Database       |  |    Message Queue    |
                |  | (Redis) |  |  Primary (writes)    |  | (thumbnail jobs)    |
                |  +---------+  |       |  replication |  +----------+----------+
                |               |  Read Replica (reads)|             |
                |               +----------------------+      +------v------+
                |                                             |   Worker    |
                |                                             | (thumbnails)|
                |                                             +------+------+
                |                                                    |
        +-------v----------------------------------------------------v------+
        |                         Object Storage                           |
        |        original photos (2 MB)   |   thumbnails (50 KB)           |
        +-------------------------------------------------------------------+
```

## 6. Components

- **CDN:** It stores copies of photos and thumbnails close to users, so images load quickly and most photo traffic never reaches our servers.
- **Load balancer:** It spreads incoming requests across many app servers, so no single server is overloaded and one failure does not take the app down.
- **App servers:** They run the SnapShare logic (login, upload, feed) and can be added or removed easily because they keep no data of their own.
- **Cache:** It keeps frequently requested data, such as recent feeds, in fast memory, so we avoid repeating slow database queries.
- **Database (primary):** It stores users, follows, photo details and feed information reliably, and handles all writes.
- **Read replica:** It is a live copy of the primary database that answers read queries, so the heavy read load does not slow down writes.
- **Object storage:** It holds the large photo and thumbnail files cheaply and almost without limit, so they stay out of the database.
- **Message queue:** It holds thumbnail jobs until a worker is ready, so uploads finish quickly and a traffic spike does not lose work.
- **Worker:** It picks jobs from the queue and creates thumbnails in the background, so users do not wait for image processing.

## 7. Upload flow, step by step

1. The user picks a photo in the app and taps upload.
2. The request goes through the **load balancer** to one of the **app servers**.
3. The app server checks that the user is logged in and that the file is a valid image within the size limit.
4. The app server saves the original photo in **object storage** and gets back its key (URL).
5. The app server writes a new row to the **primary database** with the photo key, owner, caption, time and status "processing".
6. The app server puts a "create thumbnail" job (with the photo key) on the **message queue**.
7. The app server replies to the user: "Upload successful". The user does not wait for the thumbnail.
8. A **worker** takes the job from the queue, downloads the original from object storage and creates a 50 KB thumbnail.
9. The worker saves the thumbnail in object storage and updates the photo row in the database to "ready" with the thumbnail URL.
10. The cache entries for followers' feeds are refreshed or expire, so the new photo appears in their feeds.
11. When followers scroll their feed, the app shows the thumbnails, served through the **CDN**.
12. If the worker fails, the job stays in the queue and is retried, so no thumbnail is lost.

## 8. Trade-offs

- **Caching: speed vs fresh data.**
  - The cache makes feeds fast and reduces database load, but cached feeds can be slightly out of date. A new photo may take a few seconds to appear.
  - It also adds another system to run and keep correct (deciding when cached data expires).
  - We accept this because users care more about a fast feed than seeing a photo the instant it is posted.
- **Read replica: scale vs consistency.**
  - Replicas let us handle many more reads, but replication has a small delay. A user may upload a photo and not see it right away if their read goes to a replica that has not caught up.
  - We accept this for the feed, and can read from the primary for a user's own recent uploads.
- **Queue and worker: fast uploads vs delayed thumbnails.**
  - Uploads return quickly and traffic spikes are absorbed, but the thumbnail is not ready instantly, so the photo may briefly show a placeholder.
  - The system also becomes more complex (queues, retries, monitoring).
- **CDN and object storage: cost and speed vs control.**
  - They make images fast and cheap to store at about 750 TB per year, but they cost money per gigabyte served and we depend on an outside provider.
  - Deleting or replacing a photo is also harder, because copies may stay in CDN caches until they expire.
