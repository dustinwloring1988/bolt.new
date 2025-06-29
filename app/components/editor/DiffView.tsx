import React from 'react';
import type { FileMap } from '~/lib/stores/files';
import { computeFileModifications, diffFiles } from '~/utils/diff';
import { classNames } from '~/utils/classNames';

interface DiffViewProps {
  modifications?: ReturnType<typeof computeFileModifications>;
}

interface DiffLineProps {
  line: string;
  type: 'added' | 'removed' | 'context' | 'header';
  lineNumber?: number;
}

const DiffLine: React.FC<DiffLineProps> = ({ line, type, lineNumber }) => {
  const getLineClass = () => {
    switch (type) {
      case 'added':
        return 'bg-green-50 text-green-800 border-l-2 border-green-400';
      case 'removed':
        return 'bg-red-50 text-red-800 border-l-2 border-red-400';
      case 'context':
        return 'bg-gray-50 text-gray-700';
      case 'header':
        return 'bg-blue-50 text-blue-800 font-medium';
      default:
        return '';
    }
  };

  return (
    <div className={classNames('px-3 py-1 text-sm font-mono flex', getLineClass())}>
      {lineNumber !== undefined && (
        <span className="w-12 text-gray-500 text-right mr-4 flex-shrink-0">
          {lineNumber}
        </span>
      )}
      <span className="flex-1 whitespace-pre">{line}</span>
    </div>
  );
};

const parseDiffLines = (diffContent: string) => {
  const lines = diffContent.split('\n');
  const parsedLines: Array<{ line: string; type: DiffLineProps['type']; lineNumber?: number }> = [];
  
  let oldLineNumber = 0;
  let newLineNumber = 0;
  
  for (const line of lines) {
    if (line.startsWith('@@')) {
      // Parse header to get line numbers
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldLineNumber = parseInt(match[1], 10);
        newLineNumber = parseInt(match[2], 10);
      }
      parsedLines.push({ line, type: 'header' });
    } else if (line.startsWith('+')) {
      parsedLines.push({ 
        line: line.substring(1), 
        type: 'added', 
        lineNumber: newLineNumber++ 
      });
    } else if (line.startsWith('-')) {
      parsedLines.push({ 
        line: line.substring(1), 
        type: 'removed', 
        lineNumber: oldLineNumber++ 
      });
    } else if (line.startsWith(' ')) {
      parsedLines.push({ 
        line: line.substring(1), 
        type: 'context', 
        lineNumber: newLineNumber++ 
      });
      oldLineNumber++;
    } else if (line.trim()) {
      parsedLines.push({ line, type: 'context' });
    }
  }
  
  return parsedLines;
};

export const DiffView: React.FC<DiffViewProps> = ({ modifications }) => {

  if (!modifications) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <div className="i-ph:check-circle text-4xl mb-2 text-green-500"></div>
          <div className="text-lg font-medium">No changes detected</div>
          <div className="text-sm">All files are up to date</div>
        </div>
      </div>
    );
  }

  return (
    <div className="diff-view h-full overflow-auto bg-white">
      <div className="p-4">
        <h2 className="text-lg font-semibold mb-4 text-gray-800">
          File Changes ({Object.keys(modifications).length} file{Object.keys(modifications).length !== 1 ? 's' : ''})
        </h2>
        
        {Object.entries(modifications).map(([filePath, modification]) => {
          const fileName = filePath.split('/').pop() || filePath;
          
          return (
            <div key={filePath} className="mb-6 border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="i-ph:file-text mr-2 text-gray-600"></div>
                    <span className="font-medium text-gray-800">{fileName}</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {modification.type === 'diff' ? 'Modified' : 'Replaced'}
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-1">{filePath}</div>
              </div>
              
              <div className="bg-white">
                {modification.type === 'diff' ? (
                  <div className="divide-y divide-gray-100">
                    {parseDiffLines(modification.content).map((parsedLine, index) => (
                      <DiffLine
                        key={index}
                        line={parsedLine.line}
                        type={parsedLine.type}
                        lineNumber={parsedLine.lineNumber}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="p-4">
                    <div className="bg-green-50 border border-green-200 rounded p-3">
                      <div className="text-green-800 text-sm font-medium mb-2">
                        File replaced with new content
                      </div>
                      <pre className="text-xs text-green-700 whitespace-pre-wrap overflow-auto max-h-64">
                        {modification.content}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

