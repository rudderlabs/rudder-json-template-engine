import { Dictionary } from '../src';

export type Sceanario = {
  description?: string;
  input?: any;
  templatePath?: string;
  compileTimeBindings?: any;
  bindings?: any;
  output?: any;
  error?: string;
};
