export class JsonTemplateMappingError extends Error {
  inputMapping: string;

  outputMapping: string;

  constructor(message: string, inputMapping: string, outputMapping: string) {
    super(`${message}. Input: ${inputMapping}, Output: ${outputMapping}`);
    this.inputMapping = inputMapping;
    this.outputMapping = outputMapping;
  }
}
