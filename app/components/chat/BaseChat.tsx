import type { Message } from 'ai';
import React, { type RefCallback, useState, useRef } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import styles from './BaseChat.module.scss';
import { Messages } from './Messages.client';
import { SendButton } from './SendButton.client';
import { Menu } from '~/components/sidebar/Menu.client';
import { IconButton } from '~/components/ui/IconButton';
import { Workbench } from '~/components/workbench/Workbench.client';
import { classNames } from '~/utils/classNames';
import { STARTER_TEMPLATES } from '~/utils/templates';
import { generateTemplatePrompt } from '~/utils/github';

export interface AttachedImage {
  file: File;
  url: string;
  type: string;
}

interface BaseChatProps {
  textareaRef?: React.RefObject<HTMLTextAreaElement | null> | undefined;
  messageRef?: RefCallback<HTMLDivElement> | undefined;
  scrollRef?: RefCallback<HTMLDivElement> | undefined;
  showChat?: boolean;
  chatStarted?: boolean;
  isStreaming?: boolean;
  messages?: Message[];
  enhancingPrompt?: boolean;
  promptEnhanced?: boolean;
  input?: string;
  attachedImages?: AttachedImage[];
  handleStop?: () => void;
  sendMessage?: (event: React.UIEvent, messageInput?: string) => void;
  handleInputChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleImageAttach?: (files: FileList) => void;
  handleImageRemove?: (index: number) => void;
  enhancePrompt?: () => void;
  model?: string;
  onModelChange?: (model: string) => void;
  chatMode?: 'discuss' | 'build';
  setChatMode?: (mode: 'discuss' | 'build') => void;
  append?: (message: Message) => void;
}

const EXAMPLE_PROMPTS = [
  { text: 'Build a todo app in React using Tailwind' },
  { text: 'Build a simple blog using Astro' },
  { text: 'Create a cookie consent form using Material UI' },
  { text: 'Make a space invaders game' },
  { text: 'How do I center a div?' },
];


const TEXTAREA_MIN_HEIGHT = 76;

export const BaseChat = React.forwardRef<HTMLDivElement, BaseChatProps>(
  (
    {
      textareaRef,
      messageRef,
      scrollRef,
      showChat = true,
      chatStarted = false,
      isStreaming = false,
      enhancingPrompt = false,
      promptEnhanced = false,
      messages,
      input = '',
      attachedImages = [],
      sendMessage,
      handleInputChange,
      handleImageAttach,
      handleImageRemove,
      enhancePrompt,
      handleStop,
      model,
      onModelChange,
      chatMode = 'build',
      setChatMode,
      append,
    },
    ref,
  ) => {
  const TEXTAREA_MAX_HEIGHT = chatStarted ? 400 : 200;
  const [selectedModel, setSelectedModel] = useState(model || 'claude-3-5-sonnet-20241022');
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    onModelChange?.(selectedModel);
  }, [selectedModel]);

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && handleImageAttach) {
      handleImageAttach(files);
    }
    // Reset the input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

    return (
      <div
        ref={ref}
        className={classNames(
          styles.BaseChat,
          'relative flex h-full w-full overflow-hidden bg-bolt-elements-background-depth-1',
        )}
        data-chat-visible={showChat}
      >
        <ClientOnly>{() => <Menu />}</ClientOnly>
        <div ref={scrollRef} className="flex overflow-y-auto w-full h-full">
          <div className={classNames(styles.Chat, 'flex flex-col flex-grow min-w-[var(--chat-min-width)] h-full')}>
            {!chatStarted && (
              <div id="intro" className="mt-[26vh] max-w-chat mx-auto">
                <h1 className="text-5xl text-center font-bold text-bolt-elements-textPrimary mb-2">
                  Where ideas begin
                </h1>
                <p className="mb-4 text-center text-bolt-elements-textSecondary">
                  Bring ideas to life in seconds or get help on existing projects.
                </p>
              </div>
            )}
            <div
              className={classNames('pt-6 px-6', {
                'h-full flex flex-col': chatStarted,
              })}
            >
              <ClientOnly>
                {() => {
                  return chatStarted ? (
                    <Messages
                      ref={messageRef}
                      className="flex flex-col w-full flex-1 max-w-chat px-4 pb-6 mx-auto z-1"
                      messages={messages}
                      isStreaming={isStreaming}
                      append={append}
                      chatMode={chatMode}
                      setChatMode={setChatMode}
                      model={model}
                    />
                  ) : null;
                }}
              </ClientOnly>
              <div
                className={classNames('relative w-full max-w-chat mx-auto z-prompt', {
                  'sticky bottom-0': chatStarted,
                })}
              >
                {/* Model Picker */}
                <div className="flex justify-end mb-1">
                  <select
                    className="border border-bolt-elements-borderColor rounded px-2 py-1 text-sm bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary"
                    value={selectedModel}
                    onChange={e => setSelectedModel(e.target.value)}
                  >
                    <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                    <option value="claude-3-7-sonnet-20250219">Claude 3.7 Sonnet (Max)</option>
                  </select>
                </div>
                {/* Image attachments preview */}
                {attachedImages.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2 p-2 bg-bolt-elements-background-depth-2 rounded-lg border border-bolt-elements-borderColor">
                    {attachedImages.map((image, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={image.url}
                          alt={`Attachment ${index + 1}`}
                          className="w-16 h-16 object-cover rounded border border-bolt-elements-borderColor"
                        />
                        <button
                          onClick={() => handleImageRemove?.(index)}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove image"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div
                  className={classNames(
                    'shadow-sm border border-bolt-elements-borderColor bg-bolt-elements-prompt-background backdrop-filter backdrop-blur-[8px] rounded-lg overflow-hidden',
                  )}
                >
                  <textarea
                    ref={textareaRef}
                    className={`w-full pl-4 pt-4 pr-16 focus:outline-none resize-none text-md text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary bg-transparent`}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        if (event.shiftKey) {
                          return;
                        }

                        event.preventDefault();

                        sendMessage?.(event);
                      }
                    }}
                    value={input}
                    onChange={(event) => {
                      handleInputChange?.(event);
                    }}
                    style={{
                      minHeight: TEXTAREA_MIN_HEIGHT,
                      maxHeight: TEXTAREA_MAX_HEIGHT,
                    }}
                    placeholder="How can Bolt help you today?"
                    translate="no"
                  />
                  <ClientOnly>
                    {() => (
                      <SendButton
                        show={input.length > 0 || attachedImages.length > 0 || isStreaming}
                        isStreaming={isStreaming}
                        onClick={(event) => {
                          if (isStreaming) {
                            handleStop?.();
                            return;
                          }

                          sendMessage?.(event);
                        }}
                      />
                    )}
                  </ClientOnly>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="flex justify-between text-sm p-4 pt-2">
                    <div className="flex gap-1 items-center">
                      <IconButton
                        title="Attach images"
                        onClick={handleFileSelect}
                        className="text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary"
                      >
                        <div className="i-ph:paperclip text-xl"></div>
                      </IconButton>
                      <IconButton
                        title="Enhance prompt"
                        disabled={input.length === 0 || enhancingPrompt}
                        className={classNames({
                          'opacity-100!': enhancingPrompt,
                          'text-bolt-elements-item-contentAccent! pr-1.5 enabled:hover:bg-bolt-elements-item-backgroundAccent!':
                            promptEnhanced,
                        })}
                        onClick={() => enhancePrompt?.()}
                      >
                        {enhancingPrompt ? (
                          <>
                            <div className="i-svg-spinners:90-ring-with-bg text-bolt-elements-loader-progress text-xl"></div>
                            <div className="ml-1.5">Enhancing prompt...</div>
                          </>
                        ) : (
                          <>
                            <div className="i-bolt:stars text-xl"></div>
                            {promptEnhanced && <div className="ml-1.5">Prompt enhanced</div>}
                          </>
                        )}
                      </IconButton>
                      {chatStarted && (
                        <IconButton
                          title={chatMode === 'discuss' ? 'Switch to Build Mode' : 'Switch to Discuss Mode'}
                          className={classNames(
                            'transition-all flex items-center gap-1 px-1.5',
                            chatMode === 'discuss'
                              ? '!bg-bolt-elements-item-backgroundAccent !text-bolt-elements-item-contentAccent'
                              : 'text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary',
                          )}
                          onClick={() => {
                            setChatMode?.(chatMode === 'discuss' ? 'build' : 'discuss');
                          }}
                        >
                          <div className="i-ph:chats text-xl" />
                          {chatMode === 'discuss' ? <span className="text-xs">Discuss</span> : null}
                        </IconButton>
                      )}
                    </div>
                    {input.length > 3 ? (
                      <div className="text-xs text-bolt-elements-textTertiary">
                        Use <kbd className="kdb">Shift</kbd> + <kbd className="kdb">Return</kbd> for a new line
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="bg-bolt-elements-background-depth-1 pb-6">{/* Ghost Element */}</div>
              </div>
            </div>
            {!chatStarted && (
              <>
                {/* Starter Templates Section */}
                <div className="relative w-full max-w-4xl mx-auto mt-8">
                  <h2 className="text-xl font-semibold text-bolt-elements-textPrimary mb-4 text-center">
                    Start with a Template
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 px-4">
                    {STARTER_TEMPLATES.map((template, index) => (
                      <button
                        key={index}
                        onClick={(event) => {
                          const prompt = generateTemplatePrompt(template);
                          sendMessage?.(event, prompt);
                        }}
                        className="group flex flex-col p-4 border border-bolt-elements-borderColor rounded-lg bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3 transition-all duration-200 text-left"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`${template.icon} text-xl text-bolt-elements-textSecondary`} />
                          <h3 className="font-medium text-bolt-elements-textPrimary">{template.label}</h3>
                        </div>
                        <p className="text-sm text-bolt-elements-textTertiary mb-3">{template.description}</p>
                        <div className="flex flex-wrap gap-1">
                          {template.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-1 text-xs bg-bolt-elements-background-depth-1 text-bolt-elements-textTertiary rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Example Prompts Section */}
                <div id="examples" className="relative w-full max-w-xl mx-auto mt-8 flex justify-center">
                  <div className="flex flex-col space-y-2 [mask-image:linear-gradient(to_bottom,black_0%,transparent_180%)] hover:[mask-image:none]">
                    <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-2 text-center">
                      Or try an example
                    </h3>
                    {EXAMPLE_PROMPTS.map((examplePrompt, index) => {
                      return (
                        <button
                          key={index}
                          onClick={(event) => {
                            sendMessage?.(event, examplePrompt.text);
                          }}
                          className="group flex items-center w-full gap-2 justify-center bg-transparent text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary transition-theme"
                        >
                          {examplePrompt.text}
                          <div className="i-ph:arrow-bend-down-left" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
          <ClientOnly>{() => <Workbench chatStarted={chatStarted} isStreaming={isStreaming} />}</ClientOnly>
        </div>
      </div>
    );
  },
);
