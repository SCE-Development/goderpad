import { useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DarkModeContext, UserContext } from '../../App';
import { createRoom } from '../../api/api';

interface Template {
  name: string;
  description: string;
  code: string;
}

const TEMPLATES: Template[] = [
  {
    name: 'blank',
    description: 'start with a clean react component',
    code: `import React from 'react';

function App() {
  return (
    <div>
      <h1>Hello, World!</h1>
    </div>
  );
}
export default App;`,
  },
  {
    name: 'counter',
    description: 'useState with increment/decrement buttons',
    code: `import React, { useState } from 'react';

function App() {
  const [count, setCount] = useState(0);

  return (
    <div style={{ textAlign: 'center', padding: '2rem' }}>
      <h1>Counter</h1>
      <p style={{ fontSize: '3rem' }}>{count}</p>
      <button onClick={() => setCount(count - 1)} style={{ marginRight: '1rem' }}>-</button>
      <button onClick={() => setCount(count + 1)}>+</button>
    </div>
  );
}
export default App;`,
  },
  {
    name: 'todo list',
    description: 'add and remove items from a list',
    code: `import React, { useState } from 'react';

function App() {
  const [todos, setTodos] = useState([]);
  const [input, setInput] = useState('');

  const addTodo = () => {
    if (!input.trim()) return;
    setTodos([...todos, { id: Date.now(), text: input }]);
    setInput('');
  };

  const removeTodo = (id) => {
    setTodos(todos.filter(t => t.id !== id));
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '400px', margin: '0 auto' }}>
      <h1>Todo List</h1>
      <div>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTodo()}
          placeholder="add a todo"
          style={{ padding: '0.5rem', marginRight: '0.5rem' }}
        />
        <button onClick={addTodo}>add</button>
      </div>
      <ul style={{ marginTop: '1rem', listStyle: 'none', padding: 0 }}>
        {todos.map(t => (
          <li key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0' }}>
            {t.text}
            <button onClick={() => removeTodo(t.id)}>x</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
export default App;`,
  },
  {
    name: 'fetch & display',
    description: 'fetch data from an api and render it',
    code: `import React, { useState, useEffect } from 'react';

function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('https://jsonplaceholder.typicode.com/posts/1')
      .then(res => res.json())
      .then(json => { setData(json); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, []);

  if (loading) return <p>loading...</p>;
  if (error) return <p>error: {error}</p>;

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Fetched Post</h1>
      <h2>{data.title}</h2>
      <p>{data.body}</p>
    </div>
  );
}
export default App;`,
  },
  {
    name: 'form',
    description: 'controlled inputs with validation',
    code: `import React, { useState } from 'react';

function App() {
  const [form, setForm] = useState({ name: '', email: '' });
  const [submitted, setSubmitted] = useState(null);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'name is required';
    if (!form.email.includes('@')) e.email = 'valid email required';
    return e;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSubmitted(form);
    setErrors({});
  };

  if (submitted) return (
    <div style={{ padding: '2rem' }}>
      <h2>submitted!</h2>
      <p>name: {submitted.name}</p>
      <p>email: {submitted.email}</p>
      <button onClick={() => setSubmitted(null)}>reset</button>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '300px' }}>
      <h1>form</h1>
      <div>
        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="name" style={{ width: '100%', padding: '0.5rem' }} />
        {errors.name && <p style={{ color: 'red', margin: '0.25rem 0 0' }}>{errors.name}</p>}
      </div>
      <div>
        <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email" style={{ width: '100%', padding: '0.5rem' }} />
        {errors.email && <p style={{ color: 'red', margin: '0.25rem 0 0' }}>{errors.email}</p>}
      </div>
      <button type="submit">submit</button>
    </form>
  );
}
export default App;`,
  },
  {
    name: 'timer',
    description: 'countdown timer with start/pause/reset',
    code: `import React, { useState, useEffect, useRef } from 'react';

function App() {
  const [seconds, setSeconds] = useState(60);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (running && seconds > 0) {
      intervalRef.current = setInterval(() => setSeconds(s => s - 1), 1000);
    } else {
      clearInterval(intervalRef.current);
      if (seconds === 0) setRunning(false);
    }
    return () => clearInterval(intervalRef.current);
  }, [running, seconds]);

  const reset = () => { setRunning(false); setSeconds(60); };

  const pad = n => String(n).padStart(2, '0');
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return (
    <div style={{ textAlign: 'center', padding: '2rem' }}>
      <h1>Timer</h1>
      <p style={{ fontSize: '4rem', fontFamily: 'monospace' }}>{pad(mins)}:{pad(secs)}</p>
      <button onClick={() => setRunning(!running)} style={{ marginRight: '1rem' }}>
        {running ? 'pause' : 'start'}
      </button>
      <button onClick={reset}>reset</button>
    </div>
  );
}
export default App;`,
  },
];

function TemplatesPage() {
  const { isDark } = useContext(DarkModeContext);
  const { userId } = useContext(UserContext);
  const navigate = useNavigate();
  const location = useLocation();
  const { userName, roomName } = (location.state as { userName: string; roomName: string }) || {};

  if (!userName) {
    navigate('/');
    return null;
  }

  const handleSelectTemplate = async (template: Template) => {
    const finalRoomName = roomName || template.name;
    const response = await createRoom(userId, userName, finalRoomName, template.code);
    if (response.ok) {
      const roomId = response.data.roomId;
      const expiry = new Date().getTime() + (24 * 60 * 60 * 1000);
      const data = JSON.stringify({ userName, expiry });
      localStorage.setItem(`goderpad-cookie-${roomId}`, data);
      navigate(`/${roomId}`);
    }
  };

  return (
    <div className={`min-h-screen p-8 ${isDark ? 'bg-slate-900 text-white' : 'bg-gray-100 text-gray-900'}`}>
      <h1 className='text-3xl font-bold text-center mb-2'>choose a template</h1>
      <p className={`text-center mb-10 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
        select a starting point for your interview room
      </p>
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto'>
        {TEMPLATES.map((template) => (
          <button
            key={template.name}
            onClick={() => handleSelectTemplate(template)}
            className={`text-left p-6 rounded-xl border-2 transition-all cursor-pointer hover:scale-[1.02] ${
              isDark
                ? 'bg-slate-800 border-slate-700 hover:border-green-500'
                : 'bg-white border-gray-200 hover:border-green-500'
            }`}
          >
            <h2 className='text-lg font-semibold mb-2'>{template.name}</h2>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{template.description}</p>
            <pre className={`mt-4 text-xs rounded-lg p-3 overflow-hidden max-h-24 leading-relaxed ${
              isDark ? 'bg-slate-900 text-gray-300' : 'bg-gray-50 text-gray-700'
            }`}>
              {template.code.slice(0, 120)}...
            </pre>
          </button>
        ))}
      </div>
    </div>
  );
}

export default TemplatesPage;
