import Editor from '@monaco-editor/react';
import { useState, useRef, useContext, useEffect, useCallback } from 'react';
import { DarkModeContext, UserContext } from '../../App';
import { SandpackProvider, SandpackPreview } from '@codesandbox/sandpack-react';
import { DEFAULT_CODE as DEFAULT_REACT_CODE } from '../../util/reactTemplateContent';
import { DEFAULT_PYTHON_CODE, DEFAULT_JAVA_CODE, DEFAULT_CPP_CODE, DEFAULT_JAVASCRIPT_CODE } from '../../util/defaultCode';

type Language = 'react' | 'javascript' | 'python' | 'cpp' | 'java';
export type InterviewType = 'react' | 'leetcode';

const LANGUAGE_OPTIONS: { value: Language; label: string; monacoLang: string; sandpackTemplate?: 'react'; defaultCode: string }[] = [
  { value: 'react',      label: 'React',      monacoLang: 'javascript', sandpackTemplate: 'react', defaultCode: DEFAULT_REACT_CODE },
  { value: 'javascript', label: 'JavaScript', monacoLang: 'javascript',                            defaultCode: DEFAULT_JAVASCRIPT_CODE },
  { value: 'python',     label: 'Python',     monacoLang: 'python',                                defaultCode: DEFAULT_PYTHON_CODE },
  { value: 'cpp',        label: 'C++',        monacoLang: 'cpp',                                   defaultCode: DEFAULT_CPP_CODE },
  { value: 'java',       label: 'Java',       monacoLang: 'java',                                  defaultCode: DEFAULT_JAVA_CODE },
];

const LEETCODE_LANGUAGES: Language[] = ['javascript', 'python', 'cpp', 'java'];

interface CodeEditorProps {
  code: string;
  setCode: (code: string) => void;
  ws: WebSocket | null;
  interviewType: InterviewType;
  users: Array<{
    userId: string;
    userName: string;
    cursorPosition: {
      lineNumber: number;
      column: number 
    } | null;
    selection: {
      startLineNumber: number;
      startColumn: number;
      endLineNumber: number;
      endColumn: number;
    } | null;
  }>;
}

function CodeEditor({ code, setCode, ws, interviewType, users }: CodeEditorProps) {
  const { isDark } = useContext(DarkModeContext);
  const { userId } = useContext(UserContext);
  const [language, setLanguage] = useState<Language>(interviewType === 'leetcode' ? 'javascript' : 'react');
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(ws);
  const [sandpackKey, setSandpackKey] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [debouncedCode, setDebouncedCode] = useState(code);
  const [leftPercent, setLeftPercent] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const decorationsRef = useRef<string[]>([]);
  const selectionDecorationsRef = useRef<string[]>([]);
  const [visibleLabels, setVisibleLabels] = useState<Set<string>>(new Set());
  const labelTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const prevCursorPositions = useRef<Map<string, string>>(new Map());

  // Keep wsRef in sync with ws prop
  useEffect(() => {
    wsRef.current = ws;
  }, [ws]);

  const handleEditorWillMount = (monaco: any) => {
    monaco.editor.defineTheme('slate-dark', {
      base: 'vs-dark',
      inherit: false,
      rules: [
        { token: '', foreground: 'ffffff' },
        { token: 'keyword', foreground: '569cd6' },
        { token: 'keyword.flow', foreground: '569cd6' },
        { token: 'comment', foreground: '6a9955', fontStyle: 'italic' },
        { token: 'string', foreground: 'ce9178' },
        { token: 'number', foreground: 'b5cea8' },
        { token: 'regexp', foreground: 'd16969' },
      ],
      colors: {
        'editor.background': '#0f172a',
        'editor.foreground': '#ffffff',
      },
    });
  };

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    const VOID_ELEMENTS = new Set([
      'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
      'link', 'meta', 'param', 'source', 'track', 'wbr'
    ]);

    editor.onDidChangeModelContent((e: any) => {
      const change = e.changes[0];
      if (!change || change.text !== '>') return;

      const model = editor.getModel();
      const position = editor.getPosition();
      if (!model || !position) return;

      const lineContent = model.getLineContent(position.lineNumber);
      // Text before the cursor (the '>' was just inserted, cursor is now after it)
      const textBeforeCursor = lineContent.substring(0, position.column - 1);

      const lastOpen = textBeforeCursor.lastIndexOf('<');
      if (lastOpen === -1) return;

      const tagContent = textBeforeCursor.substring(lastOpen + 1);

      // Skip closing tags and self-closing tags
      if (tagContent.startsWith('/')) return;
      if (tagContent.endsWith('/')) return;

      const tagMatch = tagContent.match(/^([a-zA-Z][a-zA-Z0-9]*)/);
      if (!tagMatch) return;

      const tagName = tagMatch[1].toLowerCase();
      if (VOID_ELEMENTS.has(tagName)) return;

      const closingTag = `</${tagName}>`;
      editor.executeEdits('html-auto-close', [{
        range: new monaco.Range(
          position.lineNumber, position.column,
          position.lineNumber, position.column
        ),
        text: closingTag,
      }]);

      // Keep cursor between the opening and closing tags
      editor.setPosition(position);
    });

    editor.onDidChangeCursorPosition((e: any) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          userId,
          type: 'cursor_update',
          payload: {
            lineNumber: e.position.lineNumber,
            column: e.position.column
          }
        }));
      }
    });

    editor.onDidChangeCursorSelection((e: any) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const selection = e.selection;
        wsRef.current.send(JSON.stringify({
          userId,
          type: 'selection_update',
          payload: {
            startLineNumber: selection.startLineNumber,
            startColumn: selection.startColumn,
            endLineNumber: selection.endLineNumber,
            endColumn: selection.endColumn
          }
        }));
      }
    });
  }

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setCode(value);
      console.clear();
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          userId,
          type: 'code_update',
          payload: {
            code: value
          }
        }));
      }
    }
  };

  const handleDividerMouseDown = useCallback(() => {
    isDraggingRef.current = true;
    setIsDragging(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newPercent = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftPercent(Math.min(Math.max(newPercent, 20), 80));
    };
    const handleMouseUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setIsDragging(false);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleSandpackReload = () => {
    setHasError(false);
    setSandpackKey(prev => prev + 1);
  };
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedCode(code);
    }, 500);

    return () => clearTimeout(timer);
  }, [code]);

  // Effect to track cursor movement and manage label visibility timers
  useEffect(() => {
    users
      .filter(user => user.userId !== userId && user.cursorPosition)
      .forEach(user => {
        const posKey = `${user.cursorPosition!.lineNumber}:${user.cursorPosition!.column}`;
        const prevPos = prevCursorPositions.current.get(user.userId);
        
        if (prevPos !== posKey) {
          // Cursor moved - show label and reset timer
          prevCursorPositions.current.set(user.userId, posKey);
          setVisibleLabels(prev => new Set(prev).add(user.userId));
          
          // Clear existing timer
          const existingTimer = labelTimersRef.current.get(user.userId);
          if (existingTimer) clearTimeout(existingTimer);
          
          // Set new timer to hide label after 3 seconds
          const timer = setTimeout(() => {
            setVisibleLabels(prev => {
              const next = new Set(prev);
              next.delete(user.userId);
              return next;
            });
            labelTimersRef.current.delete(user.userId);
          }, 3000);
          labelTimersRef.current.set(user.userId, timer);
        }
      });

    // Cleanup timers for users who left
    return () => {
      labelTimersRef.current.forEach((timer, odUserId) => {
        if (!users.find(u => u.userId === odUserId)) {
          clearTimeout(timer);
          labelTimersRef.current.delete(odUserId);
        }
      });
    };
  }, [users, userId]);

  // Effect to update cursor decorations
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;

    const editor = editorRef.current;
    const monaco = monacoRef.current;

    // Create new decorations for other users' cursors
    const newDecorations = users
      .filter(user => user.userId !== userId && user.cursorPosition && user.userName)
      .map(user => {
        const position = user.cursorPosition!;
        const showLabel = visibleLabels.has(user.userId);
        return {
          range: new monaco.Range(
            position.lineNumber,
            position.column,
            position.lineNumber,
            position.column
          ),
          options: {
            className: `cursor-${user.userId}`,
            beforeContentClassName: showLabel ? `cursor-label-${user.userId}` : undefined,
            stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
            hoverMessage: { value: user.userName }
          }
        };
      });

    // Apply decorations immediately (delta from old to new)
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecorations);

    // Create selection decorations for other users
    const selectionDecorations = users
      .filter(user => user.userId !== userId && user.selection && user.userName)
      .map(user => {
        const selection = user.selection!;
        return {
          range: new monaco.Range(
            selection.startLineNumber,
            selection.startColumn,
            selection.endLineNumber,
            selection.endColumn
          ),
          options: {
            className: `selection-${user.userId}`,
            stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          }
        };
      });

    // Apply selection decorations
    selectionDecorationsRef.current = editor.deltaDecorations(selectionDecorationsRef.current, selectionDecorations);

    // Add dynamic styles for each user's cursor and selection
    users
      .filter(user => user.userId !== userId && user.userName)
      .forEach((user, index) => {
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F'];
        const color = colors[index % colors.length];

        // Remove old style if exists
        const oldStyle = document.getElementById(`cursor-style-${user.userId}`);
        if (oldStyle) oldStyle.remove();

        // Add new style
        const style = document.createElement('style');
        style.id = `cursor-style-${user.userId}`;
        style.textContent = `
          .cursor-${user.userId} {
            border-left: 2px solid ${color} !important;
          }
          .cursor-label-${user.userId} {
            position: relative;
          }
          .cursor-label-${user.userId}::before {
            content: "${user.userName}";
            position: absolute;
            top: -18px;
            left: 0;
            background: ${color};
            color: white;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: 500;
            white-space: nowrap;
            z-index: 100;
            pointer-events: none;
          }
          .selection-${user.userId} {
            background-color: ${color}40 !important;
          }
        `;
        document.head.appendChild(style);
      });

    // Cleanup function
    return () => {
      users.forEach(user => {
        const style = document.getElementById(`cursor-style-${user.userId}`);
        if (style) style.remove();
      });
    };
  }, [users, userId, visibleLabels]);

  const availableLanguages = interviewType === 'leetcode'
    ? LANGUAGE_OPTIONS.filter(l => LEETCODE_LANGUAGES.includes(l.value))
    : LANGUAGE_OPTIONS.filter(l => l.value === 'react');
  const selectedLang = LANGUAGE_OPTIONS.find(l => l.value === language)!;
  const showPreview = interviewType === 'react';

  return (
    <div ref={containerRef} className={`relative flex flex-row ${isDark ? 'bg-slate-900' : 'bg-gray-100'} p-6 pt-20`}>
      {/* Language dropdown — only shown for leetcode interviews */}
      {interviewType === 'leetcode' && <div className='absolute top-6 left-6 z-20'>
        <div className='relative'>
          <button
            onClick={() => setLangDropdownOpen(prev => !prev)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isDark
                ? 'bg-slate-800 text-white hover:bg-slate-700 border border-slate-600'
                : 'bg-white text-gray-900 hover:bg-gray-200 border border-gray-300'
            }`}
          >
            {selectedLang.label}
            <svg
              xmlns='http://www.w3.org/2000/svg'
              width='14'
              height='14'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'
              className={`transition-transform ${langDropdownOpen ? 'rotate-180' : ''}`}
            >
              <polyline points='6 9 12 15 18 9' />
            </svg>
          </button>
          {langDropdownOpen && (
            <div className={`absolute top-full mt-1 left-0 rounded-lg shadow-lg overflow-hidden border ${
              isDark ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-200'
            }`}>
              {availableLanguages.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { setLanguage(opt.value); setCode(opt.defaultCode); setLangDropdownOpen(false); }}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                    opt.value === language
                      ? isDark ? 'bg-slate-700 text-white' : 'bg-gray-100 text-gray-900'
                      : isDark ? 'text-white hover:bg-slate-700' : 'text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>}
      {isDragging && <div className='fixed inset-0 z-50 cursor-col-resize' />}
      <div style={{ width: `${leftPercent}%` }} className={`border-2 ${isDark ? 'border-white' : 'border-gray-900'} rounded-lg overflow-hidden`}>
        <Editor
          height='85vh'
          language={selectedLang.monacoLang}
          value={code}
          theme={isDark ? 'slate-dark' : 'vs'}
          beforeMount={handleEditorWillMount}
          onMount={handleEditorDidMount}
          onChange={handleEditorChange}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            padding: { top: 10 },
            scrollBeyondLastLine: false,
          }}
        />
      </div>
      <div
        onMouseDown={handleDividerMouseDown}
        className={`w-3 flex-shrink-0 flex items-center justify-center cursor-col-resize group`}
      >
        <div className={`w-0.5 h-full rounded-full transition-colors ${isDark ? 'bg-slate-700 group-hover:bg-slate-400' : 'bg-gray-300 group-hover:bg-gray-500'}`} />
      </div>
      <div style={{ width: `${100 - leftPercent}%` }} className={`border-2 ${isDark ? 'border-white' : 'border-gray-900'} rounded-lg overflow-hidden h-[85vh] relative`}>
        {showPreview ? (
          <>
            {hasError && (
              <div className='absolute top-2 right-2 z-10'>
                <button
                  onClick={handleSandpackReload}
                  className='bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded'
                >
                  Reload Preview
                </button>
              </div>
            )}
            <SandpackProvider
              key={`${sandpackKey}-${language}`}
              template={selectedLang.sandpackTemplate}
              files={{
                '/App.js': debouncedCode,
              }}
              theme={isDark ? 'dark' : 'light'}
              options={{
                externalResources: [],
                bundlerURL: 'https://sandpack-bundler.codesandbox.io',
                recompileMode: 'delayed',
                recompileDelay: 300,
                autoReload: true,
              }}
              style={{ height: '100%' }}
            >
              <SandpackPreview
                style={{ height: '100%' }}
                showOpenInCodeSandbox={false}
                showRefreshButton={true}
              />
            </SandpackProvider>
          </>
        ) : (
          <div className={`flex items-center justify-center h-full ${isDark ? 'bg-slate-900 text-slate-400' : 'bg-gray-100 text-gray-500'}`}>
            <p className='text-sm'>Preview not available for {selectedLang.label}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default CodeEditor;
