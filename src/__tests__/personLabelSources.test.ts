import * as fs from 'fs';
import * as path from 'path';

// The imperative mislabel (ellos/ellas where only ustedes is possible) shipped
// because the six person labels were hardcoded in four separate files and
// drifted apart. conjugate.ts owns them now, and every consumer goes through
// getPersonLabel. This pins that ownership so a new screen cannot quietly grow
// a fifth copy — the failure mode no behavioural test would notice, because a
// stale copy renders perfectly happily.
const SRC_ROOT = path.join(__dirname, '..');
const LABEL_OWNER = path.join('utils', 'conjugate.ts');

// The shapes the drifted copies actually took.
const PERSON_LABEL_PATTERNS: [string, RegExp][] = [
  ['head of a person-label array', /['"]yo['"]\s*,\s*['"]tú['"]/],
  ['third-person singular label', /['"]él\/ella/],
  ['third-person plural label', /['"]ellos\/ellas/],
];

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

describe('person label ownership', () => {
  const files = sourceFiles(SRC_ROOT);

  // Control: an empty offender list below is only evidence if the scan
  // actually reached the source tree in the first place.
  test('scans a populated source tree including the owner', () => {
    expect(files.length).toBeGreaterThan(10);
    expect(files.filter(f => f.endsWith(LABEL_OWNER))).toHaveLength(1);
  });

  test('the owner still defines both label sets', () => {
    const owner = fs.readFileSync(path.join(SRC_ROOT, LABEL_OWNER), 'utf8');
    PERSON_LABEL_PATTERNS.forEach(([, pattern]) => expect(owner).toMatch(pattern));
    expect(owner).toMatch(/['"]usted['"]/);
    expect(owner).toMatch(/['"]ustedes['"]/);
  });

  test.each(PERSON_LABEL_PATTERNS)('no file outside the owner hardcodes the %s', (_what, pattern) => {
    const offenders = files
      .filter(file => !file.endsWith(LABEL_OWNER))
      .filter(file => pattern.test(fs.readFileSync(file, 'utf8')))
      .map(file => path.relative(SRC_ROOT, file));

    expect(offenders).toEqual([]);
  });
});
