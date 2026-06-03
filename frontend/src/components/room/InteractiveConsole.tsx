import { forwardRef, useImperativeHandle, useState } from 'react';
import { useSandpackConsole } from '@codesandbox/sandpack-react';

interface InteractiveConsoleProps {
  isDark: boolean;
}

export interface InteractiveConsoleHandle {
  reset: () => void;
}

// Sandpack's bundler encodes circular references by inserting a "@r" key
// that points into a references array. We don't try to resolve those —
// we just render the marker so the user can see it happened.
const CIRCULAR_REF_KEY = '@r';
// Special-type marker (Set, Map, etc.) — we display "[<type>]" as a leaf.
const TRANSFORMED_TYPE_KEY = '@t';
const TRANSFORMED_TYPE_KEY_ALT = '#@t';

type Theme = {
  string: string;
  number: string;
  boolean: string;
  nullish: string;
  key: string;
  punctuation: string;
  toggle: string;
};

const darkTheme: Theme = {
  string: 'text-red-300',
  number: 'text-blue-300',
  boolean: 'text-orange-300',
  nullish: 'text-gray-500',
  key: 'text-violet-300',
  punctuation: 'text-gray-400',
  toggle: 'text-gray-400 hover:text-white',
};

const lightTheme: Theme = {
  string: 'text-red-700',
  number: 'text-blue-700',
  boolean: 'text-orange-700',
  nullish: 'text-gray-500',
  key: 'text-violet-700',
  punctuation: 'text-gray-500',
  toggle: 'text-gray-500 hover:text-gray-900',
};

function previewOf(value: unknown): string {
  if (Array.isArray(value)) return `Array(${value.length})`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>);
    if (keys.length === 0) return '{}';
    return `{${keys.slice(0, 3).join(', ')}${keys.length > 3 ? ', …' : ''}}`;
  }
  return '';
}

function ConsoleValue({ value, theme, depth = 0 }: { value: unknown; theme: Theme; depth?: number }) {
  if (value === null) return <span className={theme.nullish}>null</span>;
  if (value === undefined) return <span className={theme.nullish}>undefined</span>;

  const t = typeof value;
  if (t === 'string') return <span className={theme.string}>"{value as string}"</span>;
  if (t === 'number') return <span className={theme.number}>{String(value)}</span>;
  if (t === 'boolean') return <span className={theme.boolean}>{String(value)}</span>;
  if (t === 'bigint') return <span className={theme.number}>{String(value)}n</span>;
  if (t === 'function') return <span className={theme.nullish}>ƒ</span>;
  if (t === 'symbol') return <span className={theme.nullish}>{String(value)}</span>;

  if (t === 'object') {
    const obj = value as Record<string, unknown>;
    if (CIRCULAR_REF_KEY in obj) return <span className={theme.nullish}>[Circular]</span>;
    if (TRANSFORMED_TYPE_KEY in obj) return <span className={theme.nullish}>[{String(obj[TRANSFORMED_TYPE_KEY])}]</span>;
    if (TRANSFORMED_TYPE_KEY_ALT in obj) return <span className={theme.nullish}>[{String(obj[TRANSFORMED_TYPE_KEY_ALT])}]</span>;
    return <ExpandableObject value={value as object} theme={theme} depth={depth} />;
  }

  return <span>{String(value)}</span>;
}

function ExpandableObject({ value, theme, depth }: { value: object; theme: Theme; depth: number }) {
  // Auto-expand the top-level entry for convenience; nested stays collapsed.
  const [open, setOpen] = useState(depth === 0);
  const isArray = Array.isArray(value);
  const entries: Array<[string, unknown]> = isArray
    ? (value as unknown[]).map((v, i) => [String(i), v])
    : Object.entries(value as Record<string, unknown>);

  if (entries.length === 0) {
    return <span className={theme.punctuation}>{isArray ? '[]' : '{}'}</span>;
  }

  const openBracket = isArray ? '[' : '{';
  const closeBracket = isArray ? ']' : '}';

  if (!open) {
    return (
      <button
        type='button'
        onClick={() => setOpen(true)}
        className={`inline text-left ${theme.toggle}`}
      >
        <span className={theme.punctuation}>▶ </span>
        <span className={theme.punctuation}>{previewOf(value)}</span>
      </button>
    );
  }

  return (
    <span>
      <button
        type='button'
        onClick={() => setOpen(false)}
        className={`inline text-left ${theme.toggle}`}
      >
        <span className={theme.punctuation}>▼ {openBracket}</span>
      </button>
      <div className='pl-4'>
        {entries.map(([k, v], i) => (
          <div key={k} className='leading-5'>
            <span className={theme.key}>{isArray ? k : `"${k}"`}</span>
            <span className={theme.punctuation}>: </span>
            <ConsoleValue value={v} theme={theme} depth={depth + 1} />
            {i < entries.length - 1 && <span className={theme.punctuation}>,</span>}
          </div>
        ))}
      </div>
      <span className={theme.punctuation}>{closeBracket}</span>
    </span>
  );
}

function methodStyle(method: string, isDark: boolean): string {
  if (method === 'error') {
    return isDark
      ? 'bg-red-950/40 border-l-2 border-red-500 text-red-200'
      : 'bg-red-50 border-l-2 border-red-500 text-red-900';
  }
  if (method === 'warn' || method === 'warning') {
    return isDark
      ? 'bg-yellow-950/30 border-l-2 border-yellow-500 text-yellow-100'
      : 'bg-yellow-50 border-l-2 border-yellow-500 text-yellow-900';
  }
  if (method === 'clear') {
    return isDark ? 'text-gray-500 italic' : 'text-gray-500 italic';
  }
  return '';
}

const InteractiveConsole = forwardRef<InteractiveConsoleHandle, InteractiveConsoleProps>(({ isDark }, ref) => {
  const { logs, reset } = useSandpackConsole({
    resetOnPreviewRestart: true,
    showSyntaxError: true,
  });
  useImperativeHandle(ref, () => ({ reset }), [reset]);

  const theme = isDark ? darkTheme : lightTheme;

  return (
    <div className={`h-full overflow-y-auto font-mono text-xs ${isDark ? 'bg-slate-900 text-gray-200' : 'bg-white text-gray-900'}`}>
      {logs.length === 0 && (
        <div className={`px-3 py-2 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          console output will appear here
        </div>
      )}
      {logs.map((entry) => {
        const method = String(entry.method);
        const items = entry.data ?? [];
        return (
          <div
            key={entry.id}
            className={`px-3 py-1.5 border-b ${isDark ? 'border-slate-800' : 'border-gray-100'} ${methodStyle(method, isDark)}`}
          >
            {items.map((item, i) => (
              <span key={i} className='align-top inline-block mr-2 whitespace-pre-wrap break-words'>
                <ConsoleValue value={item} theme={theme} />
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
});

export default InteractiveConsole;
