const verbs = require('../src/data/verbs.json');

function hasPresentOverride(data, forms) {
  const present = data.overrides?.present;
  if (!present) return false;
  return forms.every((form) => present.includes(form));
}

function hasSubjOverride(data, forms) {
  const subj = data.overrides?.subjunctive_present;
  if (!subj) return false;
  return forms.every((form) => subj.includes(form));
}

function hasPreteriteOverride(data, forms) {
  const pret = data.overrides?.preterite;
  if (!pret) return false;
  return forms.every((form) => pret.includes(form));
}

function hasStem(data, present, preterite) {
  const stem = data.pattern?.stemChange;
  if (!stem) return false;
  if (present && stem.present !== present) return false;
  if (preterite && stem.preterite !== preterite) return false;
  return true;
}

function hasFlags(data, expected) {
  return Object.entries(expected).every(([key, value]) => data.pattern?.[key] === value);
}

const checks = [
  {
    id: 'venir_compound',
    test: (inf, data, text) =>
      inf !== 'venir' &&
      inf.endsWith('venir') &&
      /(vengo|viene|vienen|vine|vinieron|vendr)/.test(text) &&
      (!hasFlags(data, { yoGo: true }) ||
        !hasStem(data, 'e_ie') ||
        !String(data.pattern?.irregularPreteriteStem || '').endsWith('vin') ||
        !String(data.pattern?.irregularFutureStem || '').endsWith('vendr')),
    hint: 'likely needs venir-family pattern',
  },
  {
    id: 'tener_compound',
    test: (inf, data, text) =>
      inf !== 'tener' &&
      inf.endsWith('tener') &&
      /(tengo|tiene|tienen|tuvo|tuvieron|tendr)/.test(text) &&
      (!hasFlags(data, { yoGo: true }) ||
        !hasStem(data, 'e_ie') ||
        !String(data.pattern?.irregularPreteriteStem || '').endsWith('tuv') ||
        !String(data.pattern?.irregularFutureStem || '').endsWith('tendr')),
    hint: 'likely needs tener-family pattern',
  },
  {
    id: 'decir_compound',
    test: (inf, data, text) =>
      inf !== 'decir' &&
      inf.endsWith('decir') &&
      /(digo|dice|dicen|dijo|dijeron|dir)/.test(text) &&
      (!hasPresentOverride(data, ['digo']) &&
        !hasPresentOverride(data, ['predigo']) &&
        !hasPresentOverride(data, ['bendigo']) &&
        !hasPresentOverride(data, ['maldigo']) &&
        !hasPresentOverride(data, ['contradigo'])),
    hint: 'likely needs decir-family present override',
  },
  {
    id: 'accent_iar',
    test: (_inf, data, text) =>
      /(confío|envío|desafío|amplío|desconfío|confíe|envíe|desafíe|amplíe|desconfíe|río|sonrío)/.test(text) &&
      !hasPresentOverride(data, ['confío']) &&
      !hasPresentOverride(data, ['envío']) &&
      !hasPresentOverride(data, ['desafío']) &&
      !hasPresentOverride(data, ['amplío']) &&
      !hasPresentOverride(data, ['desconfío']) &&
      !hasPresentOverride(data, ['río']) &&
      !hasPresentOverride(data, ['sonrío']),
    hint: 'example suggests accented -iar present forms',
  },
  {
    id: 'accent_uar',
    test: (_inf, data, text) =>
      /(evalúo|evalúa|evacúo|evacúa|actúo|actúa|continúo|continúa)/.test(text) &&
      !hasPresentOverride(data, ['evalúo']) &&
      !hasPresentOverride(data, ['evacúo']) &&
      !hasPresentOverride(data, ['actúo']) &&
      !hasPresentOverride(data, ['continúo']),
    hint: 'example suggests accented -uar present forms',
  },
  {
    id: 'diaeresis_guar',
    test: (_inf, data, text) =>
      /(averigüé|averigüe|apacigüé|apacigüe|argü)/.test(text) &&
      !hasPreteriteOverride(data, ['averigüé']) &&
      !hasSubjOverride(data, ['averigüe']) &&
      !hasPreteriteOverride(data, ['apacigüé']) &&
      !hasSubjOverride(data, ['apacigüe']),
    hint: 'example suggests diaeresis before e',
  },
  {
    id: 'e_ie_e_i_ir',
    test: (_inf, data, text) =>
      /(siente|mintió|prefiere|sugiere|adquiere|desmiente|consiente|discierne)/.test(text) &&
      !hasStem(data, 'e_ie', 'e_i'),
    hint: 'example suggests e->ie / e->i pattern',
  },
  {
    id: 'e_i_ir',
    test: (_inf, data, text) =>
      /(concibo|concibió|tiñe|tiñó|embiste|embistió)/.test(text) &&
      !hasStem(data, 'e_i', 'e_i') &&
      !hasPreteriteOverride(data, ['tiñó']),
    hint: 'example suggests e->i pattern or preterite override',
  },
  {
    id: 'ver_compound',
    test: (inf, data, text) =>
      inf !== 'ver' &&
      inf.endsWith('ver') &&
      /(prevé|prevemos|entrevé|entrevemos)/.test(text) &&
      !(data.overrides?.present?.includes('prevemos') || data.overrides?.present?.includes('entrevemos')),
    hint: 'example suggests ver-compound present override',
  },
];

const findings = [];

for (const [infinitive, data] of Object.entries(verbs)) {
  const text = Array.isArray(data.examples) ? data.examples.join(' ') : '';
  if (!text) continue;

  for (const check of checks) {
    if (check.test(infinitive, data, text)) {
      findings.push({
        infinitive,
        hint: check.hint,
        examples: data.examples,
      });
    }
  }
}

if (findings.length === 0) {
  console.log('No heuristic example mismatches found.');
  process.exit(0);
}

for (const finding of findings) {
  console.log(`${finding.infinitive}: ${finding.hint}`);
  for (const example of finding.examples) {
    console.log(`  - ${example}`);
  }
}
