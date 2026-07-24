import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Tense } from '../utils/conjugate';

export type SearchStackParamList = {
  SearchHome: undefined;
  Conjugation: {
    infinitive: string;
    initialTense?: Tense;
    highlightForm?: string;
  };
};

// Legacy alias used by existing screens
export type RootStackParamList = {
  Search: undefined;
  Conjugation: {
    infinitive: string;
    initialTense?: Tense;
    highlightForm?: string;
  };
  Feedback: undefined;
  Quiz: undefined;
};

export type SearchScreenProps = NativeStackScreenProps<RootStackParamList, 'Search'>;
export type ConjugationScreenProps = NativeStackScreenProps<RootStackParamList, 'Conjugation'>;
export type FeedbackScreenProps = NativeStackScreenProps<RootStackParamList, 'Feedback'>;
export type QuizScreenProps = NativeStackScreenProps<RootStackParamList, 'Quiz'>;
