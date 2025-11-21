import { protoGenMapping } from "../lsp";

function getMapping(): Record<string, string> {
  return protoGenMapping;
}

export function getGoFileFromProtoFile(protoPath: string): string | undefined {
  const mapping = getMapping();
  return mapping[protoPath];
}

export function getProtoFileFromGoFile(goPath: string): string | undefined {
  const mapping = getMapping();
  for (const [proto, go] of Object.entries(mapping)) {
    if (go === goPath) {
      return proto;
    }
  }
}

// This ignores types of the file
export function getPartnerFile(path: string): string | undefined {
  // Try proto to go
  const goFile = getGoFileFromProtoFile(path);
  if (goFile) {
    return goFile;
  }

  // Try go to proto
  const protoFile = getProtoFileFromGoFile(path);
  if (protoFile) {
    return protoFile;
  }

  return undefined;
}
