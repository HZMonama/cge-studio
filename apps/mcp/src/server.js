#!/usr/bin/env node

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FastMCP } from "fastmcp";
import { z } from "zod";
import { loadSchemaCommandRegistry } from "../../../cli/cli-grc-engineering/src/runtime/schema-command-registry.js";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(appRoot, "..", "..");
const cliRoot = path.join(repoRoot, "cli", "cli-grc-engineering");
const cliBin = path.join(cliRoot, "bin", "cli-grc-engineering.js");
const registry = loadSchemaCommandRegistry(cliRoot);

const server = new FastMCP({
  name: "cge-studio",
  version: "0.1.0",
  instructions: [
    "Use these tools to run cli-grc-engineering commands and inspect runner-backed workflows.",
    "Tool results are the CLI JSON envelope. Non-zero exit_code values can still contain useful data, especially exit_code 4 for workflows awaiting input.",
  ].join("\n"),
});

const commandArgsSchema = z.object({
  args: z.array(z.string()).default([]).describe("Arguments to pass to the CLI command, excluding the command name and --json."),
  cwd: z.string().optional().describe("Working directory for the CLI command. Defaults to the MCP process working directory."),
});

server.addTool({
  name: "cge_list_commands",
  description: "List schema-discovered cli-grc-engineering commands.",
  parameters: z.object({}),
  execute: async () => {
    return JSON.stringify({
      commands: registry.definitions.map((definition) => ({
        name: definition.primaryName,
        mode: definition.mode,
        description: definition.description,
        tool_name: toolNameForCommand(definition.primaryName),
      })),
    }, null, 2);
  },
});

server.addTool({
  name: "cge_run_command",
  description: "Run any cli-grc-engineering command by schema command name or alias.",
  parameters: z.object({
    command: z.string().describe("Command name, for example grc-engineer:frameworks or frameworks."),
    args: z.array(z.string()).default([]),
    cwd: z.string().optional(),
  }),
  execute: async ({ command, args, cwd }) => {
    return JSON.stringify(await runCli([command, ...args, "--json"], { cwd }), null, 2);
  },
});

for (const definition of registry.definitions) {
  server.addTool({
    name: toolNameForCommand(definition.primaryName),
    description: definition.description || `Run ${definition.primaryName}.`,
    parameters: commandArgsSchema,
    execute: async ({ args, cwd }) => {
      return JSON.stringify(await runCli([definition.primaryName, ...args, "--json"], { cwd }), null, 2);
    },
  });
}

server.addTool({
  name: "cge_run_status",
  description: "Get runner status for a workflow or agent run.",
  parameters: z.object({
    run_id: z.string(),
    workspace_id: z.string().optional(),
    cwd: z.string().optional(),
  }),
  execute: async ({ run_id, workspace_id, cwd }) => {
    const args = ["run-status", run_id, "--json"];
    if (workspace_id) args.splice(2, 0, `--workspace-id=${workspace_id}`);
    return JSON.stringify(await runCli(args, { cwd }), null, 2);
  },
});

server.addTool({
  name: "cge_run_events",
  description: "Get runner events for a workflow or agent run.",
  parameters: z.object({
    run_id: z.string(),
    workspace_id: z.string().optional(),
    cwd: z.string().optional(),
  }),
  execute: async ({ run_id, workspace_id, cwd }) => {
    const args = ["run-events", run_id, "--json"];
    if (workspace_id) args.splice(2, 0, `--workspace-id=${workspace_id}`);
    return JSON.stringify(await runCli(args, { cwd }), null, 2);
  },
});

server.addTool({
  name: "cge_run_respond",
  description: "Respond to a runner workflow prompt and wait for the resulting run state.",
  parameters: z.object({
    run_id: z.string(),
    answers: z.record(z.string(), z.unknown()),
    workspace_id: z.string().optional(),
    cwd: z.string().optional(),
  }),
  execute: async ({ run_id, answers, workspace_id, cwd }) => {
    const args = [
      "run-respond",
      run_id,
      "--answers-json",
      JSON.stringify(answers),
      "--json",
    ];
    if (workspace_id) args.splice(2, 0, `--workspace-id=${workspace_id}`);
    return JSON.stringify(await runCli(args, { cwd }), null, 2);
  },
});

server.start({
  transportType: process.env.CGE_MCP_TRANSPORT === "httpStream" ? "httpStream" : "stdio",
  ...(process.env.CGE_MCP_TRANSPORT === "httpStream"
    ? { httpStream: { port: Number(process.env.CGE_MCP_PORT ?? 8787) } }
    : {}),
});

function toolNameForCommand(commandName) {
  return `cge_${commandName.replace(/[^a-zA-Z0-9_]/g, "_")}`;
}

function runCli(args, { cwd } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliBin, ...args], {
      cwd: cwd ? path.resolve(cwd) : process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (exitCode) => {
      const trimmed = stdout.trim();
      let envelope;
      try {
        envelope = JSON.parse(trimmed);
      } catch (error) {
        envelope = {
          ok: false,
          command: args[0] ?? null,
          exit_code: exitCode ?? 6,
          data: null,
          raw_output: trimmed,
          warnings: stderr.trim() ? stderr.trim().split("\n") : [],
          errors: [
            {
              code: "INVALID_CLI_JSON",
              message: error.message,
            },
          ],
        };
      }
      resolve(envelope);
    });
  });
}
