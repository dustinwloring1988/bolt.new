import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal as XTerm } from '@xterm/xterm';
import { forwardRef, memo, useEffect, useImperativeHandle, useRef } from 'react';
import { getTerminalTheme } from './theme';
import type { Theme } from '~/lib/stores/theme';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('BoltTerminal');

export interface BoltTerminalRef {
  reloadStyles: () => void;
}

export interface BoltTerminalProps {
  className?: string;
  theme: Theme;
  outputBuffer: string[]; // array of strings to display (AI output)
}

export const BoltTerminal = memo(
  forwardRef<BoltTerminalRef, BoltTerminalProps>(({ className, theme, outputBuffer }, ref) => {
    const terminalElementRef = useRef<HTMLDivElement>(null);
    const terminalRef = useRef<XTerm | null>(null);
    const lastBufferLength = useRef(0);

    useEffect(() => {
      const element = terminalElementRef.current!;

      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();

      const terminal = new XTerm({
        cursorBlink: false,
        convertEol: true,
        disableStdin: true, // always readonly
        theme: getTerminalTheme({ cursor: '#00000000' }),
        fontSize: 12,
        fontFamily: 'Menlo, courier-new, courier, monospace',
      });

      terminalRef.current = terminal;

      terminal.loadAddon(fitAddon);
      terminal.loadAddon(webLinksAddon);
      terminal.open(element);

      const resizeObserver = new ResizeObserver(() => {
        fitAddon.fit();
      });

      resizeObserver.observe(element);

      logger.info('Attach BoltTerminal');

      // initial output
      outputBuffer.forEach((line) => terminal.writeln(line));
      lastBufferLength.current = outputBuffer.length;

      return () => {
        resizeObserver.disconnect();
        terminal.dispose();
      };
    }, []);

    // update terminal when outputBuffer changes
    useEffect(() => {
      const terminal = terminalRef.current;

      if (!terminal) {
        return;
      }

      // only write new lines
      for (let i = lastBufferLength.current; i < outputBuffer.length; i++) {
        terminal.writeln(outputBuffer[i]);
      }
      lastBufferLength.current = outputBuffer.length;
    }, [outputBuffer]);

    useEffect(() => {
      const terminal = terminalRef.current!;
      terminal.options.theme = getTerminalTheme({ cursor: '#00000000' });
      terminal.options.disableStdin = true;
    }, [theme]);

    useImperativeHandle(ref, () => {
      return {
        reloadStyles: () => {
          const terminal = terminalRef.current!;
          terminal.options.theme = getTerminalTheme({ cursor: '#00000000' });
        },
      };
    }, []);

    return <div className={className} ref={terminalElementRef} />;
  }),
);
