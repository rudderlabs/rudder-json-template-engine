import { EngineOptions } from '../src';

export type Scenario = {
  description?: string;
  input?: any;
  templatePath?: string;
  options?: EngineOptions;
  bindings?: any;
  output?: any;
  error?: string;
};
