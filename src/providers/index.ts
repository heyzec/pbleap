import { GoWalker, ProtoWalker } from "../walkers";
import { Provider } from "./base";

export const GoProvider = new Provider(GoWalker);
export const ProtoProvider = new Provider(ProtoWalker);
