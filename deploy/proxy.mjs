#!/usr/bin/env node
/**
 * Reverse proxy on :3000 → the active app slot (127.0.0.1:3001 or :3002).
 * Cloudflare Tunnel keeps pointing here. SIGHUP or changing the upstream
 * file flips traffic without dropping the listen socket.
 */
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const listenPort = Number(process.env.PROXY_LISTEN || 3000);
const listenHost = process.env.PROXY_HOST || "0.0.0.0";
const upstreamFile = process.env.UPSTREAM_FILE || path.join(appDir, "releases", "upstream.port");
const forwardedProto = process.env.PROXY_FORWARDED_PROTO || "https";
const hopByHop = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "proxy-connection",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade"
]);

const agent = new http.Agent({ keepAlive: true, maxSockets: 128 });

function readUpstreamPort() {
  const raw = fs.readFileSync(upstreamFile, "utf8").trim();
  const port = Number(raw);
  if (port !== 3001 && port !== 3002) {
    throw new Error(`Invalid upstream port in ${upstreamFile}: ${raw}`);
  }
  return port;
}

let upstreamPort = readUpstreamPort();

function reloadUpstream(reason) {
  try {
    const next = readUpstreamPort();
    if (next !== upstreamPort) {
      console.log(`[proxy] upstream ${upstreamPort} → ${next} (${reason})`);
      upstreamPort = next;
    }
  } catch (error) {
    console.error(`[proxy] could not reload upstream: ${error.message}`);
  }
}

fs.watch(path.dirname(upstreamFile), () => reloadUpstream("watch"));
setInterval(() => reloadUpstream("poll"), 2000).unref();
process.on("SIGHUP", () => reloadUpstream("sighup"));

function outgoingHeaders(req) {
  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined || hopByHop.has(key.toLowerCase())) continue;
    headers[key] = value;
  }
  const forwarded = req.socket.remoteAddress || "";
  const prior = req.headers["x-forwarded-for"];
  headers["x-forwarded-for"] = prior ? `${prior}, ${forwarded}` : forwarded;
  headers["x-forwarded-proto"] = req.headers["x-forwarded-proto"] || forwardedProto;
  headers["x-forwarded-host"] = req.headers["x-forwarded-host"] || req.headers.host || "";
  return headers;
}

const server = http.createServer((req, res) => {
  const target = http.request(
    {
      protocol: "http:",
      hostname: "127.0.0.1",
      port: upstreamPort,
      path: req.url,
      method: req.method,
      headers: outgoingHeaders(req),
      agent
    },
    (up) => {
      const headers = { ...up.headers };
      delete headers.connection;
      res.writeHead(up.statusCode || 502, headers);
      up.pipe(res);
    }
  );

  target.on("error", (error) => {
    console.error(`[proxy] ${req.method} ${req.url} → :${upstreamPort} ${error.message}`);
    if (!res.headersSent) {
      res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
      res.end("Service temporarily unavailable");
    } else {
      res.destroy();
    }
  });

  req.pipe(target);
});

server.on("upgrade", (req, socket, head) => {
  const backend = net.connect(upstreamPort, "127.0.0.1", () => {
    const lines = [`${req.method} ${req.url} HTTP/1.1`];
    const headers = outgoingHeaders(req);
    headers.connection = "Upgrade";
    if (req.headers.upgrade) headers.upgrade = req.headers.upgrade;
    for (const [key, value] of Object.entries(headers)) {
      if (Array.isArray(value)) {
        for (const item of value) lines.push(`${key}: ${item}`);
      } else if (value !== undefined) {
        lines.push(`${key}: ${value}`);
      }
    }
    backend.write(`${lines.join("\r\n")}\r\n\r\n`);
    if (head.length) backend.write(head);
    socket.pipe(backend);
    backend.pipe(socket);
  });
  backend.on("error", () => socket.destroy());
  socket.on("error", () => backend.destroy());
});

server.listen(listenPort, listenHost, () => {
  console.log(`[proxy] listening on ${listenHost}:${listenPort} → 127.0.0.1:${upstreamPort}`);
});
