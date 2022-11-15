import { Dictionary } from "../src";

export type Sceanario = {
    description?: string;
    input?: any;
    templatePath?: string;
    bindings?: Dictionary<any>;
    output?: any;
    error?: string;
  };