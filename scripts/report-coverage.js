const fs = require('fs');
const path = require('path');

const reportPaths = [
  path.join(process.cwd(), 'coverage', 'logic', 'coverage-final.json'),
  path.join(process.cwd(), 'coverage', 'ui', 'coverage-final.json'),
];

const files = Object.assign(
  {},
  ...reportPaths.map((reportPath) => {
    if (!fs.existsSync(reportPath)) {
      throw new Error(`Coverage report is missing: ${reportPath}`);
    }
    return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  }),
);

function percentage(hit, total) {
  return total === 0 ? '100.00' : ((hit / total) * 100).toFixed(2);
}

const totals = {
  statements: { hit: 0, total: 0 },
  branches: { hit: 0, total: 0 },
  functions: { hit: 0, total: 0 },
  lines: { hit: 0, total: 0 },
};

for (const coverage of Object.values(files)) {
  const lineHits = new Map();
  for (const [statementId, hits] of Object.entries(coverage.s)) {
    totals.statements.total += 1;
    if (hits > 0) totals.statements.hit += 1;

    const line = coverage.statementMap[statementId].start.line;
    lineHits.set(line, Math.max(lineHits.get(line) ?? 0, hits));
  }
  for (const hits of lineHits.values()) {
    totals.lines.total += 1;
    if (hits > 0) totals.lines.hit += 1;
  }
  for (const hits of Object.values(coverage.f)) {
    totals.functions.total += 1;
    if (hits > 0) totals.functions.hit += 1;
  }
  for (const branchHits of Object.values(coverage.b)) {
    for (const hits of branchHits) {
      totals.branches.total += 1;
      if (hits > 0) totals.branches.hit += 1;
    }
  }
}

console.log('\nCombined production-source coverage (including untested screens)');
for (const [label, result] of Object.entries(totals)) {
  console.log(
    `${label.padEnd(10)} ${percentage(result.hit, result.total).padStart(6)}% `
    + `(${result.hit}/${result.total})`,
  );
}

