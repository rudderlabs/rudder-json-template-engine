import { JsonTemplateEngine } from './src';

console.log(
  JsonTemplateEngine.translate(`
.output ? .output : { "foo": "bar" }`),
);
