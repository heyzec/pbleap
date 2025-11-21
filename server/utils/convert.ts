// import * as vscode from "vscode";
import { Location, Position, Range } from "vscode-languageserver-types";

export function nodesToLocations(
  nodes: /*(Node | null)[]*/ any,
  url: string
): Location[] {
  return nodes.map((node: any) => {
    const startPos = Position.create(
      node.startPosition.row,
      node.startPosition.column
    );
    const endPos = Position.create(
      node.endPosition.row,
      node.endPosition.column
    );
    const range = Range.create(startPos, endPos);
    return Location.create(url, range);
  });
}

export function getLanguageId(filename: string): string | null {
  if (filename.endsWith(".pb.go")) {
    return "go";
  }
  if (filename.endsWith(".proto")) {
    return "proto";
  }
  return null;
}
