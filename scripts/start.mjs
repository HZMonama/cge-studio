import { spawn } from "node:child_process";

const webPort = normalizePort(process.env.CGE_WEB_PORT ?? process.env.PORT, 3000);
const runnerPort = normalizePort(process.env.CGE_RUNNER_PORT, 3333);

const tasks = [
  {
    label: "web",
    cmd: "pnpm",
    args: [
      "--dir",
      "apps/web",
      "exec",
      "next",
      "start",
      "--hostname",
      "0.0.0.0",
      "--port",
      String(webPort),
    ],
    env: {
      ...process.env,
      PORT: String(webPort),
    },
  },
  {
    label: "runner",
    cmd: "node",
    args: ["apps/runner/src/server.js"],
    env: {
      ...process.env,
      CGE_RUNNER_PORT: String(runnerPort),
      CGE_RUNNER_HOST: process.env.CGE_RUNNER_HOST ?? "127.0.0.1",
    },
  },
];

const children = tasks.map((task) => {
  const child = spawn(task.cmd, task.args, {
    stdio: ["inherit", "pipe", "pipe"],
    env: task.env,
  });

  child.stdout.on("data", (data) => {
    process.stdout.write(`[${task.label}] ${data}`);
  });

  child.stderr.on("data", (data) => {
    process.stderr.write(`[${task.label}] ${data}`);
  });

  child.on("exit", (code) => {
    if (shuttingDown) {
      return;
    }

    shutdown(typeof code === "number" ? code : 1);
  });

  return child;
});

let shuttingDown = false;

function normalizePort(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function shutdown(code = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  process.exitCode = code;

  for (const child of children) {
    child.kill("SIGTERM");
  }

  setTimeout(() => {
    process.exit(process.exitCode ?? 0);
  }, 3000);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
process.on("uncaughtException", (error) => {
  console.error(error);
  shutdown(1);
});
process.on("unhandledRejection", (reason) => {
  console.error(reason);
  shutdown(1);
});
