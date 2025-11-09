import * as vscode from "vscode";

export function nodesToLocations(nodes: /*(Node | null)[]*/ any, document: vscode.TextDocument): vscode.Location[] {
  return nodes.map((node: any) => {
    const startPos = new vscode.Position(node.startPosition.row, node.startPosition.column);
    const endPos = new vscode.Position(node.endPosition.row, node.endPosition.column);
    const range = new vscode.Range(startPos, endPos);
    return new vscode.Location(document.uri, range);
  })
}
