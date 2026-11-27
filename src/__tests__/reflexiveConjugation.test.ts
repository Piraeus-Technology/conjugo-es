import verbs from '../data/verbs.json';
import { allTenses, conjugate, type Tense, type VerbData } from '../utils/conjugate';

const dataset = verbs as Record<string, VerbData>;

const expectedTables: Record<'levantarse' | 'irse', Record<Tense, string>> = {
  levantarse: {
    present: 'me levanto | te levantas | se levanta | nos levantamos | os levantáis | se levantan',
    preterite: 'me levanté | te levantaste | se levantó | nos levantamos | os levantasteis | se levantaron',
    imperfect: 'me levantaba | te levantabas | se levantaba | nos levantábamos | os levantabais | se levantaban',
    future: 'me levantaré | te levantarás | se levantará | nos levantaremos | os levantaréis | se levantarán',
    conditional: 'me levantaría | te levantarías | se levantaría | nos levantaríamos | os levantaríais | se levantarían',
    subjunctive_present: 'me levante | te levantes | se levante | nos levantemos | os levantéis | se levanten',
    subjunctive_imperfect: 'me levantara | te levantaras | se levantara | nos levantáramos | os levantarais | se levantaran',
    imperative_affirmative: '— | levántate | levántese | levantémonos | levantaos | levántense',
    imperative_negative: '— | no te levantes | no se levante | no nos levantemos | no os levantéis | no se levanten',
    present_perfect: 'me he levantado | te has levantado | se ha levantado | nos hemos levantado | os habéis levantado | se han levantado',
    past_perfect: 'me había levantado | te habías levantado | se había levantado | nos habíamos levantado | os habíais levantado | se habían levantado',
    future_perfect: 'me habré levantado | te habrás levantado | se habrá levantado | nos habremos levantado | os habréis levantado | se habrán levantado',
    conditional_perfect: 'me habría levantado | te habrías levantado | se habría levantado | nos habríamos levantado | os habríais levantado | se habrían levantado',
    subjunctive_present_perfect: 'me haya levantado | te hayas levantado | se haya levantado | nos hayamos levantado | os hayáis levantado | se hayan levantado',
    subjunctive_past_perfect: 'me hubiera levantado | te hubieras levantado | se hubiera levantado | nos hubiéramos levantado | os hubierais levantado | se hubieran levantado',
    present_progressive: 'me estoy levantando | te estás levantando | se está levantando | nos estamos levantando | os estáis levantando | se están levantando',
    past_progressive: 'me estaba levantando | te estabas levantando | se estaba levantando | nos estábamos levantando | os estabais levantando | se estaban levantando',
    gerund_participle: 'levantándose | levantado',
  },
  irse: {
    present: 'me voy | te vas | se va | nos vamos | os vais | se van',
    preterite: 'me fui | te fuiste | se fue | nos fuimos | os fuisteis | se fueron',
    imperfect: 'me iba | te ibas | se iba | nos íbamos | os ibais | se iban',
    future: 'me iré | te irás | se irá | nos iremos | os iréis | se irán',
    conditional: 'me iría | te irías | se iría | nos iríamos | os iríais | se irían',
    subjunctive_present: 'me vaya | te vayas | se vaya | nos vayamos | os vayáis | se vayan',
    subjunctive_imperfect: 'me fuera | te fueras | se fuera | nos fuéramos | os fuerais | se fueran',
    imperative_affirmative: '— | vete | váyase | vámonos | idos | váyanse',
    imperative_negative: '— | no te vayas | no se vaya | no nos vayamos | no os vayáis | no se vayan',
    present_perfect: 'me he ido | te has ido | se ha ido | nos hemos ido | os habéis ido | se han ido',
    past_perfect: 'me había ido | te habías ido | se había ido | nos habíamos ido | os habíais ido | se habían ido',
    future_perfect: 'me habré ido | te habrás ido | se habrá ido | nos habremos ido | os habréis ido | se habrán ido',
    conditional_perfect: 'me habría ido | te habrías ido | se habría ido | nos habríamos ido | os habríais ido | se habrían ido',
    subjunctive_present_perfect: 'me haya ido | te hayas ido | se haya ido | nos hayamos ido | os hayáis ido | se hayan ido',
    subjunctive_past_perfect: 'me hubiera ido | te hubieras ido | se hubiera ido | nos hubiéramos ido | os hubierais ido | se hubieran ido',
    present_progressive: 'me estoy yendo | te estás yendo | se está yendo | nos estamos yendo | os estáis yendo | se están yendo',
    past_progressive: 'me estaba yendo | te estabas yendo | se estaba yendo | nos estábamos yendo | os estabais yendo | se estaban yendo',
    gerund_participle: 'yéndose | ido',
  },
};

test.each(['levantarse', 'irse'] as const)('%s has the expected forms in every tense', infinitive => {
  for (const tense of allTenses) {
    expect(conjugate(infinitive, dataset[infinitive], tense).map(row => row.form))
      .toEqual(expectedTables[infinitive][tense].split(' | '));
  }
});

test.each([
  ['levantarse', 1, 'levántate'],
  ['levantarse', 3, 'levantémonos'],
  ['levantarse', 4, 'levantaos'],
  ['vestirse', 4, 'vestíos'],
  ['reírse', 4, 'reíos'],
  ['oponerse', 1, 'oponte'],
  ['reírse', 1, 'ríete'],
  ['criarse', 1, 'críate'],
  ['tatuarse', 1, 'tatúate'],
  ['graduarse', 1, 'gradúate'],
  ['peinarse', 1, 'péinate'],
  ['afeitarse', 1, 'aféitate'],
  ['caerse', 1, 'cáete'],
  ['caerse', 2, 'cáigase'],
] as const)('%s affirmative command at person index %i is %s', (infinitive, person, form) => {
  expect(conjugate(infinitive, dataset[infinitive], 'imperative_affirmative')[person].form).toBe(form);
});
