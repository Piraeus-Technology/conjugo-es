/* global __dirname */
const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('typescript');
const verbs = require('../src/data/verbs.json');

// Load the committed TS engine and checker without retaining generated JS.
function loadTypeScript(relativePath, dependencies = {}) {
  const filename = path.resolve(__dirname, relativePath);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = module.paths;
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = (name) => dependencies[name] ?? originalRequire(name);
  loaded._compile(source, filename);
  return loaded.exports;
}

const engine = loadTypeScript('../src/utils/conjugate.ts');
const { auditExamples } = loadTypeScript('../src/utils/exampleAudit.ts', { './conjugate': engine });
const findings = auditExamples(verbs);
for (const { infinitive, example } of findings) {
  console.log(`${infinitive}: no generated form in "${example}"`);
}
console.log(`Generic example audit: ${findings.length} mismatches across ${Object.keys(verbs).length} verbs.`);
process.exitCode = findings.length > 0 ? 1 : 0;
