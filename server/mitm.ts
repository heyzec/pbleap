import { spawn } from "child_process";
import * as rpc from "vscode-jsonrpc/node.js";
import * as net from "net";

// const args = process.argv.slice(2);
//
// if (args.length > 0) {
//   // console.error(`[mitm] CLI mode -> running: ${REAL} ${args.join(" ")}`);
//   const cp = spawn("gopls", args, { stdio: "inherit" });
//   cp.on("exit", (code, sig) => process.exit(code ?? 0));
//   cp.on("error", (e) => { console.error("[mitm] spawn error:", e); process.exit(1); });
//   process.exit(0);
// }

const GOPLS =
  "/nix/store/cjrbk55sj99pw2kl7ykycwbq6h31ya43-gopls-0.20.0/bin/gopls";
export function mitm() {
  // const server = spawn(GOPLS, [], { stdio: ["pipe", "pipe", "inherit"] });

  // server.on("exit", (code, sig) => {
  //   console.error(`[mitm] server exited code=${code} sig=${sig}`);
  //   process.exit(code ?? 0);
  // });
  // server.on("error", (e) => {
  //   console.error("[mitm] server spawn error:", e);
  //   process.exit(1);
  // });

  const clientConn = rpc.createMessageConnection(
    new rpc.StreamMessageReader(process.stdin),
    new rpc.StreamMessageWriter(process.stdout)
  );

  const socket = net.connect(3737, "127.0.0.1");

  const serverConn = rpc.createMessageConnection(
    new rpc.StreamMessageReader(socket),
    new rpc.StreamMessageWriter(socket)
  );

  clientConn.onRequest(async (method, params: any) => {
    if (
      method === "textDocument/definition" &&
      params &&
      params.textDocument &&
      typeof params.textDocument.uri === "string"
    ) {
      const uri = params.textDocument.uri;
      console.error(
        `[mitm] short-circuit check for textDocument/definition on uri: ${uri}`
      );
      if (uri.endsWith(".pb.go")) {
        console.error(
          "[mitm] short-circuiting textDocument/definition for HELLO.pb -> returning []"
        );
        return [];
      }
    }
    const res = await serverConn.sendRequest(method, params);
    console.error(`[mitm] server -> client response for: ${method}`);
    return res;
  });

  clientConn.onNotification((method, params) => {
    console.error(`[mitm] client -> server notification: ${method}`);
    serverConn.sendNotification(method, params);
  });

  serverConn.onNotification((method, params) => {
    console.error(`[mitm] server -> client notification: ${method}`);
    clientConn.sendNotification(method, params);
  });

  serverConn.onRequest(async (method, params) => {
    console.error(`[mitm] server -> client request: ${method}`);
    const result = await clientConn.sendRequest(method, params);
  });

  clientConn.listen();
  serverConn.listen();

  console.error("[mitm] ready");
}
