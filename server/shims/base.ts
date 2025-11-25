import * as net from "net";

import * as rpc from "vscode-jsonrpc/node";
import { Location, Position } from "vscode-languageserver-types";
import type { Node } from "web-tree-sitter";

export class Shim {
  conn: rpc.MessageConnection;

  constructor() {
    try {
      const socket = net.connect(3737, "127.0.0.1");
      const conn = rpc.createMessageConnection(
        new rpc.StreamMessageReader(socket),
        new rpc.StreamMessageWriter(socket)
      );
      conn.listen();

      conn
        .sendRequest("initialize", {
          processId: null,
          rootUri: "file:///home/heyzec/Desktop/pbleap/examples",
          capabilities: {},
        })
        .then(() => {
          conn.sendNotification("initialized", {});
        });

      this.conn = conn;
    } catch {
      console.error("FAILED TO CONNECT TO GOPLS SERVER");
      process.exit(1);
    }
  }

  handleCli(): number | null {
    if (process.argv[1] == "version") {
      const print = console.log;
      // exec gopls with argv[1:]
      // capture exit
      print(); // print its result
      return 0;
    }
    return null;
  }

  async supplement(
    document: string,
    position: Position,
    dualNode: Node
  ): Promise<Location[]> {
    await this.conn.sendNotification("textDocument/didOpen", {
      textDocument: {
        uri: `file://${document}`,
        languageId: "go",
        version: 1,
        text: fs.readFileSync(
          "/home/heyzec/Desktop/pbleap/examples/main.go",
          "utf8"
        ),
      },
    });
    const results = (await this.conn.sendRequest("textDocument/references", {
      textDocument: { uri: `file://${document}` },
      position,
    })) as any;
    console.log(`LSP returend ${results?.length} results`);

    return [];
  }
}
