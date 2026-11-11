const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const path = require("node:path");

test("ENABLE_METRICS parses false from the environment", () => {
  const configPath = require.resolve("../config.js");
  const output = execFileSync(
    process.execPath,
    [
      "-e",
      "process.stdout.write(String(require(process.argv[1]).env.ENABLE_METRICS))",
      configPath,
    ],
    {
      cwd: path.resolve(__dirname, ".."),
      env: {
        ...process.env,
        NODE_ENV: "test",
        DATABASE_URL: "postgresql://test:test@localhost:5432/testdb",
        ENABLE_METRICS: "false",
      },
      encoding: "utf8",
    }
  );

  assert.equal(output, "false");
});
