import {
  createConnection,
  InitializeParams,
  InitializeResult,
} from "vscode-languageserver/node";

import { GoProvider, ProtoProvider } from "./providers";
import type { Provider } from "./providers";
import { WalkerFactory } from "./walkers/base";
import { getLanguageId } from "./utils/convert";

export let protoGenMapping: Record<string, string>;

export function run() {
  // Create a connection for the server, using Node's IPC as a transport.
  let connection = createConnection();

  let workspaceRoot: string | null = null;

  connection.onInitialize(async (params: InitializeParams) => {
    console.log(params);
    workspaceRoot = params.workspaceFolders?.[0]?.uri ?? null;
    protoGenMapping = params.initializationOptions.protoGenMapping;

    const result: InitializeResult = {
      capabilities: {
        referencesProvider: true,
      },
    };
    return result;
  });

  connection.onInitialized(() => {
    WalkerFactory.globalSetup();
  });

  function getProvider(languageId: string) {
    const providerMap: Record<string, Provider> = {
      proto: ProtoProvider,
      go: GoProvider,
    };
    return providerMap[languageId];
  }

  connection.onReferences(async (params) => {
    const languageId = getLanguageId(params.textDocument.uri);
    if (!languageId) {
      console.log(`Unrecognised language ID: ${params.textDocument.uri}`);
      return [];
    }

    const Provider = getProvider(languageId);
    const results = await Provider.handleDefinition(
      workspaceRoot!.slice(7),
      params.textDocument.uri.slice(7),
      params.position
    );
    return results;
  });

  // Listen on the connection
  connection.listen();
}
