import { join } from 'path';
import { Command } from 'commander';
import { Scenario } from './types';
import { ScenarioUtils } from './utils';

// Run: npm run test:scenario -- --scenario=arrays --index=1
const command = new Command();
command
  .allowUnknownOption()
  .option('-s, --scenario <string>', 'Enter Scenario Name')
  .option('-i, --index <number>', 'Enter Test case index')
  .parse();

const opts = command.opts();
const scenarioName = opts.scenario || 'none';
const index = +(opts.index || 0);

describe(`${scenarioName}:`, () => {
  it(`Scenario ${index}`, async () => {
    if (scenarioName === 'none') {
      return;
    }
    const scenarioDir = join(__dirname, 'scenarios', scenarioName);
    const scenarios = ScenarioUtils.extractScenarios(scenarioDir);
    const scenario: Scenario = scenarios[index] || scenarios[0];
    let result;
    try {
      console.log(
        `Executing scenario: ${scenarioName}, test: ${index}, template: ${
          scenario.templatePath || 'template.jt'
        }`,
      );
      const templateEngine = ScenarioUtils.createTemplateEngine(scenarioDir, scenario);
      result = await ScenarioUtils.evaluateScenario(templateEngine, scenario);
      expect(result).toEqual(scenario.output);
    } catch (error: any) {
      console.error(error);
      console.log('Actual result', JSON.stringify(result, null, 2));
      console.log('Expected result', JSON.stringify(scenario.output, null, 2));
      expect(error.message).toContain(scenario.error);
    }
  });
});
