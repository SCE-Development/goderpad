import Editor from '@monaco-editor/react';
import { useState, useRef, useContext, useEffect } from 'react';
import { DarkModeContext, UserContext } from '../../App';
import { SandpackProvider, SandpackPreview } from '@codesandbox/sandpack-react';

interface CodeEditorProps {
  code: string;
  setCode: (code: string) => void;
  ws: WebSocket | null;
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

function CodeEditor({ code, setCode, ws, users }: CodeEditorProps) {
  const { isDark } = useContext(DarkModeContext);
  const { userId } = useContext(UserContext);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(ws);
  const [sandpackKey, setSandpackKey] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [debouncedCode, setDebouncedCode] = useState(code);
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
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#0f172a',
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

  return (
    <div className={`flex flex-row gap-4 ${isDark ? 'bg-slate-900' : 'bg-gray-100'} p-6 pt-20`}>
      <div className={`border-2 ${isDark ? 'border-white' : 'border-gray-900'} rounded-lg overflow-hidden w-1/2`}>
        <Editor 
          height='85vh' 
          defaultLanguage={'javascript'} 
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
      <div className={`w-1/2 border-2 ${isDark ? 'border-white' : 'border-gray-900'} rounded-lg overflow-hidden h-[85vh] relative`}>
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
          key={sandpackKey}
          template={'react'}
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
      </div>
    </div>
  );
}

export default CodeEditor;
