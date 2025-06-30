export interface ContextAnnotation {
  type: 'codeContext' | 'chatSummary';
  files?: string[];
  summary?: string;
  chatId?: string;
}
