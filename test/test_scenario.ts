import { readFileSync } from 'fs';
import { join } from 'path';
import { Command } from 'commander';
import { Sceanario } from './types';
import { SceanarioUtils } from './utils';

const command = new Command();
command
  .allowUnknownOption()
  .option('-s, --scenario <string>', 'Enter Scenario Name')
  .option('-i, --index <number>', 'Enter Test case index')
  .parse();

const opts = command.opts();
const scenario = opts.scenario || process.argv[2] || 'assignments';
const index = +(opts.index || process.argv[3] || 0);

console.log(`Executing scenario: ${scenario} and test: ${index}`);

function createAndEvaluateTemplate() {
  try {
    const scenarioDir = join(__dirname, 'scenarios', scenario);
    const sceanariosJSON = readFileSync(join(scenarioDir, 'data.json'), 'utf-8');
    const sceanarios: Sceanario[] = JSON.parse(sceanariosJSON);
    const sceanario: Sceanario = sceanarios[index] || sceanarios[0];
    const templateEngine = SceanarioUtils.createTemplateEngine(scenarioDir, sceanario);
    const result = SceanarioUtils.evaluateScenario(templateEngine, scenario);
    console.log('Actual result', JSON.stringify(result.output, null, 2));
    console.log('Expected result', JSON.stringify(sceanario.output, null, 2));
  } catch (error) {
    console.error(error);
  }
}

createAndEvaluateTemplate();
