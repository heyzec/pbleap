import {
  createConnection,
  InitializeParams,
  InitializeResult,
  TextDocumentPositionParams,
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
    workspaceRoot = params.workspaceFolders?.[0]?.uri ?? null;
    protoGenMapping = params.initializationOptions.protoGenMapping;

    const result: InitializeResult = {
      capabilities: {
        definitionProvider: true,
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

  function resolveParams(params: TextDocumentPositionParams) {
    const languageId = getLanguageId(params.textDocument.uri);
    if (!languageId){
      console.log(`Unrecognised language ID: ${params.textDocument.uri}`);
      return null;
    }
    return {
      provider: getProvider(languageId),
      workspacePath: workspaceRoot!.slice(7),
      documentPath: params.textDocument.uri.slice(7),
      position: params.position,
    };
  }

  connection.onDefinition(async (params) => {
    const r = resolveParams(params);
    if (!r) return [];
    return r.provider.handleDefinition(r.workspacePath, r.documentPath, r.position);
  });

  connection.onReferences(async (params) => {
    const r = resolveParams(params);
    if (!r) return [];
    return r.provider.handleReferences(r.workspacePath, r.documentPath, r.position);
  });

  // Listen on the connection
  connection.listen();
}
