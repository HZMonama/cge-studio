import { spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

const nextDevLockPath = path.join(process.cwd(), "apps/web/.next/dev/lock");

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code !== "ESRCH";
  }
}

function clearStaleNextDevLock() {
  if (!existsSync(nextDevLockPath)) {
    return;
  }

  try {
    const lock = JSON.parse(readFileSync(nextDevLockPath, "utf8"));

    if (isProcessAlive(lock.pid)) {
      return;
    }

    rmSync(nextDevLockPath, { force: true });
    process.stdout.write(`[web] removed stale Next dev lock for PID ${lock.pid}\n`);
  } catch {
    rmSync(nextDevLockPath, { force: true });
    process.stdout.write("[web] removed unreadable Next dev lock\n");
  }
}

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

clearStaleNextDevLock();

const children = tasks.map((task) => {
  const child = spawn(task.cmd, task.args, {
    stdio: ["inherit", "pipe", "pipe"],
    detached: true,
  });

  child.stdout.on("data", (data) => {
    process.stdout.write(`[${task.label}] ${data}`);
  });

  child.stderr.on("data", (data) => {
    process.stderr.write(`[${task.label}] ${data}`);
  });

  child.on("exit", (code) => {
    if (shuttingDown) return;

    const exitCode = typeof code === "number" ? code : 1;
    shutdown(exitCode);
  });

  return child;
});

let shuttingDown = false;

const shutdown = (code = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  process.exitCode = code;

  for (const child of children) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      try {
        child.kill("SIGTERM");
      } catch {}
    }
  }

  setTimeout(() => {
    process.exit(process.exitCode ?? 0);
  }, 3000);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("uncaughtException", (error) => {
  console.error(error);
  shutdown(1);
});
process.on("unhandledRejection", (reason) => {
  console.error(reason);
  shutdown(1);
});
