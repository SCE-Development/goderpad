// Copy this file to templateContent.ts and fill in your interview templates.
// templateContent.ts is gitignored and will never be committed.

export const DEFAULT_CODE = `import React from 'react';

function App() {
  return (
    <div>
      <h1>Hello, World!</h1>
    </div>
  );
}
export default App;`;

export interface Template {
  name: string;
  description: string;
  code: string;
}

export const TEMPLATES: Template[] = [
  {
    name: 'standard',
    description: 'start with a clean react component',
    code: DEFAULT_CODE,
  },
  {
    name: 'your template name',
    description: 'short description of the problem',
    code: `// starter code here`,
  },
];
