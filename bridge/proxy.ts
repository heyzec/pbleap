import * as rpc from "vscode-jsonrpc/node";
import * as net from "net";

// Runs when the Go extension spawns this binary as a fake gopls.
// Bridges stdin/stdout (Go extension) ↔ Unix socket (bridge daemon).
export function stdioMode() {
  const SOCKET_PATH = `${process.env.XDG_RUNTIME_DIR ?? process.env.TMPDIR ?? "/tmp"}/pbleap.sock`;

  const clientConn = rpc.createMessageConnection(
    new rpc.StreamMessageReader(process.stdin),
    new rpc.StreamMessageWriter(process.stdout)
  );

  const socket = net.connect(SOCKET_PATH);

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

  console.error("[bridge] stdio mode ready");
}
