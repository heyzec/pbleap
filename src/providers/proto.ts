import type { Node } from "web-tree-sitter";

import { ProtoWalker } from "../walkers";
import { Provider } from "./base";
import { Walker } from "../walkers/base";

class ProtoProvider extends Provider {
  getDualNode(thisNode: Node, thisWalker: Walker, thatWalker: Walker) {
    const route = thisWalker.getRoute(thisNode)
    return thatWalker.getNode(route)
  }
}

export default new ProtoProvider(ProtoWalker);
