#!/usr/bin/env node
const path = require('path');
const { pathToFileURL } = require('url');

async function testHello() {
  const runnerPath = path.resolve(__dirname, '..', 'orchestrator', 'src', 'pipeline', 'runner.ts');
  const { runTaskPipeline } = await import(pathToFileURL(runnerPath).href);

  console.log('Testing custom prompt "hello" through runTaskPipeline...\n');
  const result = await runTaskPipeline({
    rawInput: 'hello',
    urgency: 'normal',
    dataSensitivity: 'public',
  });

  console.log(`Task ID: ${result.task.id}`);
  console.log(`Subtasks Count: ${result.subtasks.length}`);
  for (const st of result.subtasks) {
    console.log(`\nSubtask: ${st.description}`);
    console.log(`Prompt: "${st.prompt}"`);
    console.log(`Model: ${st.routed_model} (${st.routed_location})`);
    console.log(`Output:`);
    console.log(st.output);
  }

  console.log('\n--- Final Workflow Deliverable ---');
  console.log(result.task.output);
}

testHello().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
