export const MAX_HISTORY_SIZE = 20;
export const MAX_SEARCH_RESULTS = 20;

// Practice prompt selection: favor a curated beginner core rather than relying
// on verbs.json ordering (which groups conjugation families, not frequency).
export const CORE_PRACTICE_VERBS = [
  'ser', 'estar', 'tener', 'hacer', 'ir', 'haber', 'poder', 'decir', 'querer',
  'saber', 'ver', 'dar', 'venir', 'deber', 'poner', 'parecer', 'quedar', 'creer',
  'hablar', 'llevar', 'dejar', 'seguir', 'encontrar', 'llamar', 'pensar', 'salir',
  'volver', 'tomar', 'conocer', 'vivir', 'sentir', 'mirar', 'contar', 'empezar',
  'esperar', 'buscar', 'entrar', 'trabajar', 'escribir', 'entender', 'pedir',
  'recibir', 'recordar', 'terminar', 'conseguir', 'comenzar', 'servir', 'sacar',
  'necesitar', 'leer', 'cambiar', 'abrir', 'preguntar', 'estudiar', 'ayudar',
  'gustar', 'jugar', 'escuchar', 'usar', 'comer', 'aprender', 'comprar',
  'caminar', 'beber',
] as const;
export const WEIGHTED_PICK_COMMON_BIAS = 0.7;
export const WEIGHTED_CANDIDATE_COUNT = 10;

// Fuse.js tuning for the Search screen.
export const FUSE_INFINITIVE_THRESHOLD = 0.4;
export const FUSE_CONJUGATION_THRESHOLD = 0.24;

// Practice insights limits.
export const INSIGHT_RANK_LIMIT = 4;
export const INSIGHT_WEAK_FORM_LIMIT = 5;

// Max days of daily sessions retained.
export const MAX_DAILY_SESSIONS = 365;

// Show the App Store review prompt after this streak.
export const REVIEW_PROMPT_STREAK = 10;
