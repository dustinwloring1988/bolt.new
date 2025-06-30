import type { Message } from 'ai';
import { memo, useMemo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import type { BundledLanguage } from 'shiki';
import { Artifact } from './Artifact';
import { CodeBlock } from './CodeBlock';

import styles from './Markdown.module.scss';
import { createScopedLogger } from '~/utils/logger';
import { rehypePlugins, remarkPlugins, allowedHTMLElements } from '~/utils/markdown';

const logger = createScopedLogger('MarkdownComponent');

interface MarkdownProps {
  children: string;
  html?: boolean;
  limitedMarkdown?: boolean;
  append?: (message: Message) => void;
  chatMode?: 'discuss' | 'build';
  setChatMode?: (mode: 'discuss' | 'build') => void;
  model?: string;
}

export const Markdown = memo(
  ({ children, html = false, limitedMarkdown = false, append, chatMode, setChatMode, model }: MarkdownProps) => {
    logger.trace('Render');

    const components = useMemo(() => {
      return {
        div: ({ className, children, node, ...props }) => {
          const dataProps = node?.properties as Record<string, unknown>;

          if (className?.includes('__boltArtifact__')) {
            const messageId = node?.properties.dataMessageId as string;

            if (!messageId) {
              logger.error(`Invalid message id ${messageId}`);
            }

            return <Artifact messageId={messageId} />;
          }

          if (className?.includes('__boltQuickAction__') || dataProps?.dataBoltQuickAction) {
            return <div className="flex items-center gap-2 flex-wrap mt-3.5">{children}</div>;
          }

          return (
            <div className={className} {...props}>
              {children}
            </div>
          );
        },
        pre: (props) => {
          const { children, node, ...rest } = props;

          const [firstChild] = node?.children ?? [];

          if (
            firstChild &&
            firstChild.type === 'element' &&
            firstChild.tagName === 'code' &&
            firstChild.children[0].type === 'text'
          ) {
            const { className, ...rest } = firstChild.properties;
            const [, language = 'plaintext'] = /language-(\w+)/.exec(String(className) || '') ?? [];

            return <CodeBlock code={firstChild.children[0].value} language={language as BundledLanguage} {...rest} />;
          }

          return <pre {...rest}>{children}</pre>;
        },
        button: ({ node, children, ...props }) => {
          const dataProps = node?.properties as Record<string, unknown>;

          if (
            dataProps?.class?.toString().includes('__boltQuickAction__') ||
            dataProps?.dataBoltQuickAction === 'true'
          ) {
            const type = dataProps['data-type'] || dataProps.dataType;
            const message = dataProps['data-message'] || dataProps.dataMessage;
            const path = dataProps['data-path'] || dataProps.dataPath;
            const href = dataProps['data-href'] || dataProps.dataHref;

            const iconClassMap: Record<string, string> = {
              file: 'i-ph:file',
              message: 'i-ph:chats',
              implement: 'i-ph:code',
              link: 'i-ph:link',
            };

            const safeType = typeof type === 'string' ? type : '';
            const iconClass = iconClassMap[safeType] ?? 'i-ph:question';

            return (
              <button
                className="rounded-md justify-center px-3 py-1.5 text-xs bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent opacity-90 hover:opacity-100 flex items-center gap-2 cursor-pointer"
                data-type={type}
                data-message={message}
                data-path={path}
                data-href={href}
                onClick={() => {
                  if (type === 'message' && append) {
                    append({
                      id: `quick-action-message-${Date.now()}`,
                      content: message as string,
                      role: 'user',
                    });
                    console.log('Message appended:', message);
                  } else if (type === 'implement' && append && setChatMode) {
                    setChatMode('build');
                    append({
                      id: `quick-action-implement-${Date.now()}`,
                      content: message as string,
                      role: 'user',
                    });
                  } else if (type === 'link' && typeof href === 'string') {
                    try {
                      const url = new URL(href, window.location.origin);
                      window.open(url.toString(), '_blank', 'noopener,noreferrer');
                    } catch (error) {
                      console.error('Invalid URL:', href, error);
                    }
                  }
                }}
              >
                <div className={`text-lg ${iconClass}`} />
                {children}
              </button>
            );
          }

          return <button {...props}>{children}</button>;
        },
      } satisfies Components;
    }, [append, setChatMode, model]);

    return (
      <div className={styles.MarkdownContent}>
        <ReactMarkdown
          allowedElements={allowedHTMLElements}
          components={components}
          remarkPlugins={remarkPlugins(limitedMarkdown)}
          rehypePlugins={rehypePlugins(html)}
        >
          {children}
        </ReactMarkdown>
      </div>
    );
  },
);
