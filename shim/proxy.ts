import * as rpc from "vscode-jsonrpc/node";
import * as net from "net";

const RUNTIME_DIR = process.env.XDG_RUNTIME_DIR ?? process.env.TMPDIR ?? "/tmp";
const SOCKET_PATH = `${RUNTIME_DIR}/pbleap.sock`;

function connectToSocket(resolve: (s: net.Socket) => void, attempts = 0) {
  if (attempts >= 40) {
    console.error("[proxy] timed out waiting for shim daemon");
    process.exit(1);
  }
  setTimeout(() => {
    const s = net.connect(SOCKET_PATH);
    s.once("connect", () => resolve(s));
    s.once("error", () => { s.destroy(); connectToSocket(resolve, attempts + 1); });
  }, attempts === 0 ? 0 : 250);
}

// Runs when the Go extension spawns this binary as a fake gopls.
// Bridges stdin/stdout (Go extension) ↔ Unix socket (shim daemon).
export async function stdioMode() {
  const socket = await new Promise<net.Socket>((resolve) => connectToSocket(resolve));

  const clientConn = rpc.createMessageConnection(
    new rpc.StreamMessageReader(process.stdin),
    new rpc.StreamMessageWriter(process.stdout)
  );

  const serverConn = rpc.createMessageConnection(
    new rpc.StreamMessageReader(socket),
    new rpc.StreamMessageWriter(socket)
  );

  clientConn.onRequest(async (method, params) => {
    console.error(`[proxy] client->server request: ${method}`);
    return serverConn.sendRequest(method, params);
  });

  clientConn.onNotification((method, params) => {
    console.error(`[proxy] client->server notify: ${method}`);
    serverConn.sendNotification(method, params);
  });

  serverConn.onNotification("$/progress", (params) => {
    console.error(`[proxy] server->client $/progress`);
    clientConn.sendNotification("$/progress", params);
  });

  serverConn.onNotification((method, params) => {
    console.error(`[proxy] server->client notify: ${method}`);
    clientConn.sendNotification(method, params);
  });

  serverConn.onRequest((method, params) => {
    console.error(`[proxy] server->client request: ${method}`);
    return clientConn.sendRequest(method, params);
  });

  clientConn.listen();
  serverConn.listen();

  console.error("[shim] stdio mode ready");
}
