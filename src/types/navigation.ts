import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Search: undefined;
  Conjugation: {
    infinitive: string;
    initialTense?: string;
    highlightForm?: string;
  };
  Feedback: undefined;
  Quiz: undefined;
};

export type SearchScreenProps = NativeStackScreenProps<RootStackParamList, 'Search'>;
export type ConjugationScreenProps = NativeStackScreenProps<RootStackParamList, 'Conjugation'>;
export type FeedbackScreenProps = NativeStackScreenProps<RootStackParamList, 'Feedback'>;
export type QuizScreenProps = NativeStackScreenProps<RootStackParamList, 'Quiz'>;
