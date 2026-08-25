# Scheduler

A lightweight scheduler and queue implementation in typescript, using Fastify supported by postgresql.

Scheduler is a web server with a minimalist rest api to allow enqueuement of tasks.
All logic is defered to the client, since the work is based on calling the provided web hook url via a POST request, at the given date time.

The time to callback is not going to be precise to the minute, however it will throttle the processing rate for whatever is enqueued to prevent spikes
of computation.

It is perfectly viable and by design, to enqueue tasks that needs to be executed as soon as possible.

Currently based on a recursive polling, to pick up enqueued tasks. Priority will always be tasks that haven't failed, then it's
by FIFO principle.

Client callbacks can fail in a couple of different ways, but the scheduler has a internal timeout setting for how long to wait for each callback.
If a task fails, it will increment a retry counter, which eventually could reach a limit and become stale.

Since the scheduler doesn't need to know anything about it's caller except where to notify a few techniques could be applied when having larger jobs, expected to take longer time. (Eg. more than 5 seconds).

When scheduler callbacks, immediately acknowledge successfully so the task is marked as resolved. If necessary due to failure, enqueue another callback, until satisfactory requirements are fulfilled.

If a task needs to be ran at an interval, similar to a cron, perform another call to the scheduler with the same callback address at the end of the work. Regard as a recursive function call.

## Getting started

```bash
pnpm install                       # from repo root
cp .env.sample .env                # set POSTGRES_* etc.
pnpm db:up                         # starts postgres via docker
pnpm --filter scheduler-api migrate
pnpm --filter scheduler-api dev    # or: pnpm dev:api:scheduler (from root)
```

Runs on port `8005`. Depends on Postgres (from the root `docker-compose.yaml`). Swagger UI at `GET /docs`.

## Testing

```bash
pnpm --filter scheduler-api test         # vitest + coverage
pnpm --filter scheduler-api test:local   # watch mode
pnpm --filter scheduler-api test:e2e     # bruno e2e (local env)
```

## Configuration

Scheduler has a horizontal configuration table with each column representing a key.
Current configurations available:

| Column                   | Description                                                                                                                                                                      |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| base_interval_ms         | The base time each unit of work will wait before performing work in milliseconds. Not that the recursive call will be done after the awaited response handling of selected rows. |
| http_callback_timeout_ms | Time in milliseconds to give each web hook callback to respond before cancelling and regard as a failure.                                                                        |
| select_size              | Maximum amount of rows to process at a time.                                                                                                                                     |
| max_retries              | Maximum amount of retries a row get before becoming stale.                                                                                                                       |

### Example

Enqueue a callback

```javascript
fetch(new URL("/api/v1/tasks", <scheduler host:port>).href, {
    method: POST,
    body: JSON.stringify({
        webhookUrl: `your.client.handler/jobs/${someId}`,
        webhookAuth: "...",
        executeAt: new Date().toISOString()
    })
})
```

    ### Health endpoints

    `GET /health` is the liveness endpoint. It does not call external dependencies and returns the local service package/version payload.

    `GET /health/ready` is the readiness endpoint. It checks PostgreSQL connectivity and returns `{ "db": true }` when the dependency check succeeds.

Example handlers

Take full responsibility for process

```javascript
someApp.Post(
  "your.client.handler/jobs/:id",
  async function jobHandler(req, res) {
    const id = req.params.id;
    void doSomethingReallyLengthy(id);
  },
);
```

Recall same endpoint after an interval, to simulate a cron like behaviour
It's important to take into consideration when implementing the work logic, that the scheduler can deem the callback taking too long if the work is awaited, terminate the request, treat it as failed and increment retries.
If a task has exhausted it's retries, it will simply stall and not be invoked again.

```javascript
someApp.Post(
  "your.client.handler/jobs/:id",
  async function jobHandler(req, res) {
    const id = req.params.id;

    const { isRetry } = await logic(id);

    if(!isRetry){
      fetch(new URL("/api/v1/tasks", <scheduler host:port>).href, {
        method: POST,
        body: JSON.stringify({
          webhookUrl: `your.client.handler/jobs/${id}`,
            webhookAuth: "...",
            executeAt: dayjs(nextJobAt).add(dayjs.duration(jobInterval)).toISOString()
        })
      })
    }
  },
);
```

Exhaust another retry later when logic is in progress. (Let's assume the logic call deals with statuses and what to do)

```javascript
someApp.Post(
  "your.client.handler/jobs/:id",
  async function jobHandler(req, res) {
    const id = req.params.id;

    if (status(id) == inProgress) {
      res.statusCode = 500;
      return;
    }

    void logic(id);
  },
);
```
