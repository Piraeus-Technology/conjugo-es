import type { CoverageMapData } from 'istanbul-lib-coverage';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- exercise the actual Node reporter
const { mergeReports } = require('../../scripts/report-coverage');

test('coverage merges overlapping hits by location even when statement IDs differ', () => {
  const path = '/source.ts';
  const loc = { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } };
  const makeReport = (id: string, hits: number): CoverageMapData => ({
    [path]: {
      path,
      statementMap: { [id]: loc }, s: { [id]: hits },
      fnMap: { [id]: { name: 'work', decl: loc, loc, line: 1 } }, f: { [id]: hits },
      branchMap: { [id]: { type: 'if', loc, line: 1, locations: [loc, loc] } }, b: { [id]: [hits, 0] },
    },
  });
  const merged = mergeReports([makeReport('7', 2), makeReport('0', 3)]).fileCoverageFor(path).toJSON();
  expect(Object.values(merged.s)).toEqual([5]);
  expect(Object.values(merged.f)).toEqual([5]);
  expect(Object.values(merged.b)).toEqual([[5, 0]]);
});
