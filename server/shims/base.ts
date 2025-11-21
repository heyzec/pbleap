import * as net from "net";
import * as fs from "fs";

import * as rpc from "vscode-jsonrpc/node";
import { Location, Position } from "vscode-languageserver-types";

export class Shim {
  conn: rpc.MessageConnection;

  private constructor(conn: any) {
    this.conn = conn;
  }

  static async create(workspacePath: string) {
    const SOCKET_PATH = process.env.XDG_RUNTIME_DIR ?? process.env.TMPDIR ?? "/tmp";
    const socket = net.connect(`${SOCKET_PATH}/pbleap.sock`);

    const conn = rpc.createMessageConnection(
      new rpc.StreamMessageReader(socket),
      new rpc.StreamMessageWriter(socket)
    );

    conn.listen();

    // Accept server-initiated work done progress tokens
    conn.onRequest("window/workDoneProgress/create", () => null);

    // Resolve once all $/progress tokens that started have ended
    const ready = new Promise<void>((resolve) => {
      const tokens = new Set<string | number>();
      let started = false;
      conn.onNotification("$/progress", (params: any) => {
        const { token, value } = params;
        if (value.kind === "begin") {
          tokens.add(token);
          started = true;
          console.log(`[progress] begin token=${token} title="${value.title}"`);
        } else if (value.kind === "report") {
          console.log(`[progress] report token=${token} message="${value.message}"`);
        } else if (value.kind === "end") {
          tokens.delete(token);
          console.log(`[progress] end token=${token} remaining=${tokens.size}`);
          if (started && tokens.size === 0) {
            console.log("[progress] all done, gopls ready");
            resolve();
          }
        }
      });
    });

    const workspaceUri = `file://${workspacePath}`;
    await conn.sendRequest("initialize", {
      processId: process.pid,
      rootUri: workspaceUri,
      capabilities: { window: { workDoneProgress: true } },
      workspaceFolders: [
        {
          uri: workspaceUri,
          name: workspacePath.split("/").pop() ?? "workspace",
        },
      ],
    });

    conn.sendNotification("initialized", {});
    console.log("[shim] sent initialized, waiting for gopls to load workspace...");

    await Promise.race([
      ready,
      new Promise<void>((resolve) => setTimeout(() => {
        console.log("[shim] timeout waiting for progress, proceeding anyway");
        resolve();
      }, 10_000)),
    ]);

    return new Shim(conn);
  }

  async references(documentPath: string, position: Position): Promise<Location[]> {
    const uri = `file://${documentPath}`;
    await this.conn.sendNotification("textDocument/didOpen", {
      textDocument: {
        uri,
        languageId: "go",
        version: 1,
        text: fs.readFileSync(documentPath, "utf8"),
      },
    });

    const results = (await this.conn.sendRequest("textDocument/references", {
      textDocument: { uri },
      position,
      context: { includeDeclaration: false },
    })) as Location[] | null;

    console.log(`[shim] references returned ${results?.length ?? 0} results`);
    return results ?? [];
  }
}
