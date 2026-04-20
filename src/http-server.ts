#!/usr/bin/env node

import "dotenv/config";

/**
 * HTTP server version of TempoFiller MCP Server
 * Use this with basic-host or cloudflared for testing MCP Apps
 *
 * Usage:
 *   npm run build
 *   node dist/http-server.js
 *
 * Then point basic-host to http://localhost:3001/mcp
 */

import { join, dirname } from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SERVER_VERSION, createTempoClient, loadUiAssets } from "./server-core.js";
import { registerHandlers } from "./server-handlers.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const tempoClient = createTempoClient();
const uiAssets = loadUiAssets();

function createMCPServer(): Server {
  const server = new Server(
    { name: "tempofiller", version: SERVER_VERSION },
    { capabilities: { tools: {}, resources: {}, prompts: {} } }
  );
  registerHandlers(server, tempoClient, uiAssets);
  return server;
}

const app = express();
app.use(cors());
app.use(express.json());

app.all("/mcp", async (req, res) => {
  console.error(`[HTTP] ${req.method} /mcp`);

  const server = createMCPServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  res.on("close", () => {
    transport.close().catch(() => {});
    server.close().catch(() => {});
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("[HTTP] MCP error:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", version: SERVER_VERSION });
});

const projectRoot = join(__dirname, "..");
app.use("/dist", express.static(__dirname));
app.use("/test", express.static(join(projectRoot, "test")));

app.get("/ui-test", (_req, res) => {
  res.sendFile(join(projectRoot, "test", "ui-test-harness.html"));
});

const PORT = parseInt(process.env.PORT || "3001");
app.listen(PORT, () => {
  console.error(`TempoFiller HTTP MCP Server v${SERVER_VERSION} running on http://localhost:${PORT}`);
  console.error(`MCP endpoint: http://localhost:${PORT}/mcp`);
});
