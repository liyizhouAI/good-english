export interface Correction {
  original: string;
  corrected: string;
  explanation: string;
  explanationChinese: string;
}

export interface MessageFeedback {
  fluency: number;
  vocabulary: number;
  grammar: number;
  overall: string;
  overallChinese: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  corrections?: Correction[];
  feedback?: MessageFeedback;
  timestamp: number;
}

export interface ConversationRecord {
  id: string;
  scenario: string;
  personaId: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface Persona {
  id: string;
  name: string;
  title: string;
  description: string;
  traits: string;
  speakingStyle: string;
}

export interface Scenario {
  id: string;
  name: string;
  nameChinese: string;
  description: string;
  context: string;
}
