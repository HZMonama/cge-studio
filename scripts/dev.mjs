import { spawn } from "node:child_process";

const tasks = [
  {
    label: "web",
    cmd: "pnpm",
    args: ["--dir", "apps/web", "dev"],
  },
  {
    label: "runner",
    cmd: "node",
    args: ["--watch", "apps/runner/src/server.js"],
  },
];

const children = tasks.map((task) => {
  const child = spawn(task.cmd, task.args, {
    stdio: ["inherit", "pipe", "pipe"],
  });

  child.stdout.on("data", (data) => {
    process.stdout.write(`[${task.label}] ${data}`);
  });

  child.stderr.on("data", (data) => {
    process.stderr.write(`[${task.label}] ${data}`);
  });

  child.on("exit", (code) => {
    if (code && code !== 0) {
      process.exitCode = code;
    }
  });

  return child;
});

const shutdown = () => {
  for (const child of children) {
    child.kill("SIGTERM");
  }
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
