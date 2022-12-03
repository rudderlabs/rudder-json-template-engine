import { join } from 'path';
import { deepEqual } from 'assert';
import { Command } from 'commander';
import { Scenario } from './types';
import { ScenarioUtils } from './utils';

const command = new Command();
command
  .allowUnknownOption()
  .option('-s, --scenario <string>', 'Enter Scenario Name')
  .option('-i, --index <number>', 'Enter Test case index')
  .parse();

const opts = command.opts();
const scenarioName = opts.scenario || 'assignments';
const index = +(opts.index || 0);

async function createAndEvaluateTemplate() {
  try {
    const scenarioDir = join(__dirname, 'scenarios', scenarioName);
    const scenarios: Scenario[] = ScenarioUtils.extractScenarios(scenarioDir);
    const scenario: Scenario = scenarios[index] || scenarios[0];
    console.log(
      `Executing scenario: ${scenarioName}, test: ${index}, template: ${
        scenario.templatePath || 'template.jt'
      }`,
    );
    const templateEngine = ScenarioUtils.createTemplateEngine(scenarioDir, scenario);
    const result = await ScenarioUtils.evaluateScenario(templateEngine, scenario);
    console.log('Actual result', JSON.stringify(result, null, 2));
    console.log('Expected result', JSON.stringify(scenario.output, null, 2));
    deepEqual(result, scenario.output, 'matching failed');
  } catch (error) {
    console.error(error);
  }
}

createAndEvaluateTemplate();
