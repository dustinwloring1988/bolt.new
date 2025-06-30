import type { Message } from 'ai';
import { toast } from 'react-toastify';
import { workbenchStore } from '~/lib/stores/workbench';
import { fileModificationsToHTML } from '~/utils/diff';
import { validateImageFile, formatFileSize } from '~/utils/images';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('chatService');

export interface AttachedImage {
  file: File;
  url: string;
  type: string;
}

export interface ChatMessageData {
  content: string;
  attachedImages: AttachedImage[];
}

export class ChatService {
  /**
   * Process file modifications and create message content
   */
  static async processFileModifications(input: string): Promise<string> {
    await workbenchStore.saveAllFiles();

    const fileModifications = workbenchStore.getFileModifcations();

    if (fileModifications !== undefined) {
      const diff = fileModificationsToHTML(fileModifications);
      const content = `${diff}\n\n${input}`;
      workbenchStore.resetAllFileModifications();

      return content;
    }

    return input;
  }

  /**
   * Validate and process attached images
   */
  static processAttachedImages(files: FileList): {
    newImages: AttachedImage[];
    rejectedFiles: string[];
  } {
    const newImages: AttachedImage[] = [];
    const rejectedFiles: string[] = [];

    Array.from(files).forEach((file) => {
      if (!validateImageFile(file)) {
        if (!file.type.startsWith('image/')) {
          rejectedFiles.push(`${file.name}: Invalid file type`);
        } else if (file.size > 10 * 1024 * 1024) {
          rejectedFiles.push(`${file.name}: File too large (max 10MB, current: ${formatFileSize(file.size)})`);
        }

        return;
      }

      const url = URL.createObjectURL(file);
      newImages.push({
        file,
        url,
        type: file.type,
      });
    });

    return { newImages, rejectedFiles };
  }

  /**
   * Handle image attachment with validation and user feedback
   */
  static handleImageAttach(files: FileList): AttachedImage[] {
    const { newImages, rejectedFiles } = this.processAttachedImages(files);

    if (rejectedFiles.length > 0) {
      toast.error(`Some files were rejected:\n${rejectedFiles.join('\n')}`);
    }

    if (newImages.length > 0) {
      toast.success(`${newImages.length} image(s) attached`);
    }

    return newImages;
  }

  /**
   * Clean up image URLs to prevent memory leaks
   */
  static cleanupImageUrls(images: AttachedImage[]): void {
    images.forEach((image) => {
      URL.revokeObjectURL(image.url);
    });
  }

  /**
   * Format message content with image descriptions
   */
  static formatMessageWithImages(content: string, attachedImages: AttachedImage[]): string {
    if (attachedImages.length === 0) {
      return content;
    }

    const imageDescriptions = attachedImages.map((img, index) => `[Image ${index + 1}: ${img.file.name}]`).join(' ');

    return `${imageDescriptions}\n\n${content}`;
  }

  /**
   * Create a complete message object for sending
   */
  static async createMessage(input: string, attachedImages: AttachedImage[]): Promise<Message> {
    const processedContent = await this.processFileModifications(input);
    const finalContent = this.formatMessageWithImages(processedContent, attachedImages);

    return {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      role: 'user',
      content: finalContent,
    };
  }

  /**
   * Handle chat errors with user feedback
   */
  static handleChatError(error: Error): void {
    logger.error('Request failed\n\n', error);
    toast.error('There was an error processing your request');
  }

  /**
   * Handle chat completion
   */
  static handleChatFinish(): void {
    logger.debug('Finished streaming');
  }
}
