export interface Snapshot {
  chatIndex: string;
  files: Record<string, any>;
  summary?: string;
}

export interface Checkpoint {
  id: string;
  name: string;
  description?: string;
  timestamp: string;
  chatIndex: string;
  files: Record<string, any>;
  messages: any[]; // Store the chat messages at checkpoint time
  messageCount: number;
  isAutoSave?: boolean;
  chatId: string;
}
