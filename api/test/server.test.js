const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { createApp } = require("../server.js");

function createMockPool() {
  return {
    query: async (sql, params) => {
      if (sql.includes("SELECT 1")) {
        return { rows: [{ ok: true }] };
      }

      if (sql.includes("SELECT * FROM notes")) {
        return { rows: [{ id: 1, text: "hello", created_at: "2025-01-01T00:00:00.000Z" }] };
      }

      if (sql.includes("INSERT INTO notes")) {
        return { rows: [{ id: 2, text: params[0], created_at: "2025-01-01T00:00:00.000Z" }] };
      }

      return { rows: [] };
    },
  };
}

test("GET /api/health returns ok when database is reachable", async () => {
  const app = createApp(createMockPool());

  const response = await request(app).get("/api/health");

  assert.equal(response.status, 200);
  assert.equal(response.body.status, "ok");
  assert.equal(typeof response.body.uptime, "number");
  assert.equal(Number.isNaN(Date.parse(response.body.timestamp)), false);
});

test("GET /api/metrics returns Prometheus metrics", async () => {
  const app = createApp(createMockPool());

  const response = await request(app).get("/api/metrics");

  assert.equal(response.status, 200);
  assert.match(response.headers["content-type"], /text\/plain/);
  assert.match(response.text, /# HELP stack_api_process_cpu_user_seconds_total/);
});

test("POST /api/notes trims and persists valid text", async () => {
  const app = createApp(createMockPool());

  const response = await request(app)
    .post("/api/notes")
    .send({ text: "   hello world   " });

  assert.equal(response.status, 201);
  assert.equal(response.body.text, "hello world");
});

test("POST /api/notes rejects empty text", async () => {
  const app = createApp(createMockPool());

  const response = await request(app)
    .post("/api/notes")
    .send({ text: "   " });

  assert.equal(response.status, 400);
  assert.equal(response.body.error, "text is required");
});

test("POST /api/notes rejects overly long text", async () => {
  const app = createApp(createMockPool());
  const longText = "a".repeat(501);

  const response = await request(app)
    .post("/api/notes")
    .send({ text: longText });

  assert.equal(response.status, 400);
  assert.match(response.body.error, /500 characters or fewer/);
});
