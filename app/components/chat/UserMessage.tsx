import { Markdown } from './Markdown';
import { modificationsRegex } from '~/utils/diff';

interface UserMessageProps {
  content: string;
}

export function UserMessage({ content }: UserMessageProps) {
  const { images, textContent } = parseMessageContent(content);

  return (
    <div className="overflow-hidden pt-[4px]">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {images.map((image, index) => (
            <div key={`image-${image.name}-${index}`} className="max-w-xs">
              <div className="text-xs text-bolt-elements-textTertiary mb-1">{image.name}</div>
              <div className="text-xs text-bolt-elements-textTertiary bg-bolt-elements-background-depth-2 px-2 py-1 rounded border border-bolt-elements-borderColor">
                📎 Image attached
              </div>
            </div>
          ))}
        </div>
      )}
      <Markdown limitedMarkdown>{sanitizeUserMessage(textContent)}</Markdown>
    </div>
  );
}

function parseMessageContent(content: string) {
  const imageRegex = /\[Image \d+: ([^\]]+)\]/g;
  const images: { name: string }[] = [];

  let match;

  while ((match = imageRegex.exec(content)) !== null) {
    images.push({ name: match[1] });
  }

  const textContent = content.replace(imageRegex, '').trim();

  return { images, textContent };
}

function sanitizeUserMessage(content: string) {
  return content.replace(modificationsRegex, '').trim();
}
