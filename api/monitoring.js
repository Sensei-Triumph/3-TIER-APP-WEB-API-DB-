const client = require("prom-client");

const register = new client.Registry();
client.collectDefaultMetrics({ register, prefix: "stack_api_" });

const httpRequestDuration = new client.Histogram({
  name: "stack_api_http_request_duration_ms",
  help: "Duration of HTTP requests in milliseconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [10, 50, 100, 200, 500, 1000, 2000, 5000],
  register,
});

const httpRequestTotal = new client.Counter({
  name: "stack_api_http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
  register,
});

function metricsMiddleware(req, res, next) {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    const route = req.route?.path || req.path || "unknown";
    const labels = {
      method: req.method,
      route,
      status_code: String(res.statusCode),
    };

    httpRequestTotal.inc(labels);
    httpRequestDuration.observe(labels, durationMs);
  });

  next();
}

async function metricsHandler(_req, res, next) {
  try {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    next(error);
  }
}

module.exports = { metricsMiddleware, metricsHandler };
