import { readdirSync } from 'fs';
import { join } from 'path';
import { Command } from 'commander';
import { SceanarioUtils } from './utils';

const rootDirName = 'scenarios';
const command = new Command();
command.allowUnknownOption().option('--scenarios <string>', 'Enter Scenario Names', 'all').parse();

const opts = command.opts();
let scenarios = opts.scenarios.split(/[, ]/);

if (scenarios[0] === 'all') {
  scenarios = readdirSync(join(__dirname, rootDirName));
}

describe('Scenarios tests', () => {
  scenarios.forEach((scenarioName) => {
    describe(`${scenarioName}`, () => {
      const scenarioDir = join(__dirname, rootDirName, scenarioName);
      const sceanarios = SceanarioUtils.extractScenarios(scenarioDir);
      sceanarios.forEach((scenario, index) => {
        it(`Scenario ${index}: ${scenario.templatePath || 'template.jt'}`, async () => {
          try {
            const templateEngine = SceanarioUtils.createTemplateEngine(scenarioDir, scenario);
            const result = await SceanarioUtils.evaluateScenario(templateEngine, scenario);
            expect(result).toEqual(scenario.output);
          } catch (error: any) {
            expect(error.message).toContain(scenario.error);
          }
        });
      });
    });
  });
});
