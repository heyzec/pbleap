import net from "node:net";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as rpc from "vscode-jsonrpc/node";
import { spawn, execFileSync } from "node:child_process";

export function resolveGopls(): string {
  try {
    return execFileSync("which", ["gopls"], { encoding: "utf8" }).trim();
  } catch {
    const gopath = process.env.GOPATH ?? path.join(os.homedir(), "go");
    return path.join(gopath, "bin", "gopls");
  }
}

const RUNTIME_DIR = process.env.XDG_RUNTIME_DIR ?? process.env.TMPDIR ?? "/tmp";

export const PROXY_SOCKET = `${RUNTIME_DIR}/pbleap.sock`;
export const SHIM_SOCKET  = `${RUNTIME_DIR}/pbleap-shim.sock`;
const GOPLS_ADDR          = "127.0.0.1:37373";

const LOG_FILE = `${RUNTIME_DIR}/pbleap.log`;

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(LOG_FILE, line);
}

async function connectToGopls(): Promise<net.Socket> {
  const [host, port] = GOPLS_ADDR.split(":");
  for (let i = 0; i < 20; i++) {
    try {
      const socket = net.connect(parseInt(port), host);
      await new Promise<void>((resolve, reject) => {
        socket.once("connect", resolve);
        socket.once("error", reject);
      });
      return socket;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  throw new Error(`[shim] could not connect to gopls at ${GOPLS_ADDR} after retries`);
}

const enum SocketRole { PROXY, SHIM }

function interceptRequest(
  role: SocketRole,
  method: string,
  params: unknown,
  forward: () => Promise<unknown>
): Promise<unknown> {
  if (role === SocketRole.PROXY && method === "textDocument/definition" && (params as any)?.textDocument?.uri?.endsWith(".pb.go")) {
    console.error("[shim] intercepted textDocument/definition for .pb.go");
    return Promise.resolve([]);
  }
  return forward();
}

async function createGoplsSession(clientSocket: net.Socket, role: SocketRole) {
  const goplsSocket = await connectToGopls();

  const clientConn = rpc.createMessageConnection(
    new rpc.StreamMessageReader(clientSocket),
    new rpc.StreamMessageWriter(clientSocket)
  );

  const serverConn = rpc.createMessageConnection(
    new rpc.StreamMessageReader(goplsSocket),
    new rpc.StreamMessageWriter(goplsSocket)
  );

  clientConn.onRequest(async (method, params) => {
    return interceptRequest(role, method, params, () => serverConn.sendRequest(method, params));
  });

  clientConn.onNotification((method, params) => {
    serverConn.sendNotification(method, params);
  });

  serverConn.onRequest((method, params) => {
    return clientConn.sendRequest(method, params);
  });

  // Explicit handler needed: vscode-jsonrpc v9 registers an internal
  // specific handler for $/progress which takes priority over the star
  // handler, swallowing the notification before it can be forwarded.
  serverConn.onNotification("$/progress", (params) => {
    clientConn.sendNotification("$/progress", params);
  });

  serverConn.onNotification((method, params) => {
    clientConn.sendNotification(method, params);
  });

  clientSocket.on("close", () => {
    clientConn.dispose();
    serverConn.dispose();
    goplsSocket.destroy();
  });

  clientConn.listen();
  serverConn.listen();
}

function listen(socketPath: string, role: SocketRole) {
  try { fs.unlinkSync(socketPath); } catch {}

  net
    .createServer((clientSocket) => {
      console.error(`[shim] client connected on ${socketPath}`);
      createGoplsSession(clientSocket, role).catch((e) => {
        console.error(`[shim] failed to create gopls session: ${e}`);
        clientSocket.destroy();
      });
    })
    .listen(socketPath);

  console.error(`[shim] listening on ${socketPath}`);
}

export function run(goBinary?: string) {
  const goplsBin = resolveGopls();
  log(`[shim] starting gopls: ${goplsBin}`);
  const env = goBinary
    ? { ...process.env, PATH: `${path.dirname(goBinary)}${path.delimiter}${process.env.PATH}` }
    : process.env;
  const gopls = spawn(goplsBin, ["serve", `-listen=${GOPLS_ADDR}`], {
    stdio: ["ignore", "pipe", "pipe"],
    env,
  });
  gopls.stdout?.on("data", (d: Buffer) => log(`[gopls] ${d.toString().trim()}`));
  gopls.stderr?.on("data", (d: Buffer) => log(`[gopls] ${d.toString().trim()}`));
  gopls.on("exit", (code) => {
    log(`[shim] gopls exited with code ${code}`);
    process.exit(code ?? 1);
  });

  listen(PROXY_SOCKET, SocketRole.PROXY);
  listen(SHIM_SOCKET, SocketRole.SHIM);
  log("[shim] daemon ready");
}
