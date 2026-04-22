export const MAX_HISTORY_SIZE = 20;
export const MAX_SEARCH_RESULTS = 20;

// Practice prompt selection: bias the weighted picker toward the first N verbs
// (dataset is ordered roughly by frequency). 70% of picks come from this slice.
export const COMMON_VERB_POOL_SIZE = 200;
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
