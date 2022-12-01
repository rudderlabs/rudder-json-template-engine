import { Dictionary, EngineOptions } from '../src';

export type Sceanario = {
  description?: string;
  input?: any;
  templatePath?: string;
  options?: EngineOptions;
  bindings?: any;
  output?: any;
  error?: string;
};
