import * as vscode from "vscode";
import type { Node } from "web-tree-sitter";

async function highlightNodes(nodes: Node[], doc: vscode.TextDocument) {
  // hsl(x 100% 25%)
  // x =          0deg       90deg      180deg     270deg
  const COLORS = ["#800000", "#408000", "#008080", "#400080"]
  const editor = await vscode.window.showTextDocument(doc);
  nodes.forEach((node, index) => {
    const startPos = new vscode.Position(node.startPosition.row, node.startPosition.column);
    const endPos = new vscode.Position(node.endPosition.row, node.endPosition.column);
    const range = new vscode.Range(startPos, endPos);
    const dec = vscode.window.createTextEditorDecorationType({
      backgroundColor: COLORS[index % COLORS.length],
    })
    editor.setDecorations(dec, [range]);
  })
}

function printNode(node: any, indent = 0) {
  const output: string[] = []
  function recurse(node: any, indent = 0) {
    const padding = '  '.repeat(indent);
    let info = node.type;
    if (node.namedChildCount === 0) {
      // leaf node: show text if short
      const text = node.text.replace(/\s+/g, ' ');
      if (text.length < 30) info += `: "${text}"`;
    }
    output.push(padding + info);

    for (const child of node.namedChildren) {
      recurse(child, indent + 1);
    }
  }
  recurse(node, indent);
  console.log(output.join('\n'));
}

