export interface MaterialRecord {
  id: string;
  title: string;
  content: string;
  sourceType: 'text' | 'url';
  sourceUrl?: string;
  extractedWordIds: string[];
  extractedPatternIds: string[];
  keyPhrases: string[];
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface ExtractionResult {
  words: Array<{
    english: string;
    chinese: string;
    partOfSpeech: string;
    exampleSentence: string;
    exampleTranslation: string;
    context: string;
    category: 'daily' | 'business' | 'ai-tech';
  }>;
  patterns: Array<{
    pattern: string;
    patternChinese: string;
    scenario: string;
    examples: Array<{ english: string; chinese: string }>;
  }>;
  keyPhrases: string[];
}
