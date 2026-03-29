import React, { useState, useContext, useEffect } from 'react';
import { createRoom, validateApiKey } from '../../api/api';
import { useNavigate } from 'react-router-dom';
import { DarkModeContext, UserContext } from '../../App';
import Popup from '../popup/Popup';
import { TEMPLATES, DEFAULT_CODE as DEFAULT_REACT_CODE } from '../../util/reactTemplateContent';
import { DEFAULT_JAVASCRIPT_CODE } from '../../util/defaultCode';
import { type InterviewType } from '../room/CodeEditor';

interface TemplateCard {
  name: string;
  description: string;
  code: string;
  interviewType: InterviewType;
}

const REACT_CARD: TemplateCard = {
  name: 'react interview',
  description: 'build and run a react component in real time',
  code: DEFAULT_REACT_CODE,
  interviewType: 'react',
};

const LEETCODE_CARD: TemplateCard = {
  name: 'leetcode interview',
  description: 'write code in python, c++, java, or javascript',
  code: DEFAULT_JAVASCRIPT_CODE,
  interviewType: 'leetcode',
};

// Non-standard templates require an API key — exclude 'standard' since REACT_CARD already covers it
const EXTRA_TEMPLATES: TemplateCard[] = TEMPLATES
  .filter(t => t.name !== 'standard')
  .map(t => ({ ...t, interviewType: 'react' as InterviewType }));

function HomePage() {
  const { isDark } = useContext(DarkModeContext);
  const [userName, setUserName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [showPopup, setShowPopup] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiKeyError, setApiKeyError] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();
  const { userId } = useContext(UserContext);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showApiKeyModal) setShowApiKeyModal(false);
        else if (showTemplateModal) setShowTemplateModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showApiKeyModal, showTemplateModal]);

  const handleSelectTemplate = async (template: TemplateCard) => {
    const finalRoomName = roomName || template.name;
    const language = template.interviewType === 'leetcode' ? 'javascript' : 'react';
    const response = await createRoom(userId, userName, finalRoomName, language, template.code);
    if (response.ok) {
      const roomId = response.data.roomId;
      const expiry = new Date().getTime() + (24 * 60 * 60 * 1000);
      localStorage.setItem(`goderpad-cookie-${roomId}`, JSON.stringify({ userName, expiry }));
      navigate(`/${roomId}`, { state: { interviewType: template.interviewType } });
    } else {
      setShowTemplateModal(false);
      setShowPopup(true);
    }
  };

  const handleApiKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsValidating(true);
    setApiKeyError('');
    const response = await validateApiKey(apiKeyInput);
    setIsValidating(false);
    if (!response.ok) {
      setApiKeyError(response.error || 'invalid api key');
      setApiKeyInput('');
      return;
    }
    sessionStorage.setItem('api_key', apiKeyInput);
    setIsAuthenticated(true);
    setShowApiKeyModal(false);
  };

  const templates: TemplateCard[] = [
    REACT_CARD,
    LEETCODE_CARD,
    ...(isAuthenticated ? EXTRA_TEMPLATES : []),
  ];

  return (<>
    <Popup
      message="sorry, an error occurred trying to create the room."
      buttonText="ok"
      isOpen={showPopup}
      onClickButton={() => setShowPopup(false)}
    />

    <div className={`min-h-screen ${isDark ? 'bg-slate-900 text-white' : 'bg-gray-100 text-gray-900'}`}>
      <h1 className='text-4xl font-bold text-center pt-20'>welcome to goderpad</h1>
      <h3 className='text-xl text-center pt-4'>sce's interview platform</h3>
      <div className='flex flex-row gap-30 justify-center mt-20'>
        <div className='flex flex-col gap-6 w-full max-w-md mx-auto'>
          <h2 className='text-3xl font-semibold mb-2 text-center'>create an interview room</h2>

          <div className='flex flex-col gap-3'>
            <label htmlFor='name' className='text-lg font-medium'>your name</label>
            <input
              id='name'
              type='text'
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && userName.trim()) setShowTemplateModal(true); }}
              placeholder='enter your name'
              className={`px-5 py-4 text-lg rounded-lg focus:outline-none focus:border-blue-500 ${isDark
                ? 'bg-slate-800 border border-slate-700 text-white'
                : 'bg-white border border-gray-300 text-gray-900'
              }`}
            />
          </div>

          <div className='flex flex-col gap-3'>
            <label htmlFor='roomName' className='text-lg font-medium'>
              room name <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>(optional)</span>
            </label>
            <input
              id='roomName'
              type='text'
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && userName.trim()) setShowTemplateModal(true); }}
              placeholder='name your room'
              className={`px-5 py-4 text-lg rounded-lg focus:outline-none focus:border-blue-500 ${isDark
                ? 'bg-slate-800 border border-slate-700 text-white'
                : 'bg-white border border-gray-300 text-gray-900'
              }`}
            />
          </div>

          <button
            onClick={() => setShowTemplateModal(true)}
            className='mt-4 px-6 py-4 text-lg bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer transition-colors disabled:opacity-50'
            disabled={!userName.trim()}
          >
            create room
          </button>
        </div>
      </div>
    </div>

    {/* Template selection modal */}
    {showTemplateModal && (
      <div
        className='fixed inset-0 z-40 flex items-center justify-center backdrop-blur-sm'
        onClick={() => setShowTemplateModal(false)}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className={`relative rounded-2xl shadow-2xl p-8 w-full max-w-3xl mx-4 max-h-[85vh] overflow-y-auto ${isDark ? 'bg-slate-800' : 'bg-white'}`}
        >
          <div className='flex items-center justify-between mb-6'>
            <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>choose a template</h2>
            <button
              onClick={() => setShowTemplateModal(false)}
              className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:text-white hover:bg-slate-700' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
            >
              <svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
                <line x1='18' y1='6' x2='6' y2='18' /><line x1='6' y1='6' x2='18' y2='18' />
              </svg>
            </button>
          </div>

          <div className={`grid gap-4 ${templates.length > 2 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
            {templates.map((template) => (
              <button
                key={template.name}
                onClick={() => handleSelectTemplate(template)}
                className={`text-left p-6 rounded-xl border-2 transition-all cursor-pointer hover:scale-[1.02] ${
                  isDark
                    ? 'bg-slate-900 border-slate-700 hover:border-green-500'
                    : 'bg-gray-50 border-gray-200 hover:border-green-500'
                }`}
              >
                <div className='flex items-center gap-2 mb-2'>
                  <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{template.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    template.interviewType === 'leetcode'
                      ? isDark ? 'bg-blue-900 text-blue-300' : 'bg-blue-100 text-blue-700'
                      : isDark ? 'bg-green-900 text-green-300' : 'bg-green-100 text-green-700'
                  }`}>
                    {template.interviewType === 'leetcode' ? 'leetcode' : 'react'}
                  </span>
                </div>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{template.description}</p>
                <pre className={`mt-3 text-xs rounded-lg p-3 overflow-hidden max-h-20 leading-relaxed ${
                  isDark ? 'bg-slate-800 text-gray-300' : 'bg-white text-gray-700'
                }`}>
                  {template.code.slice(0, 120)}...
                </pre>
              </button>
            ))}
          </div>

          {!isAuthenticated && (
            <div className='mt-6 text-center'>
              <button
                onClick={() => { setApiKeyInput(''); setApiKeyError(''); setShowApiKeyModal(true); }}
                className={`text-sm underline transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}
              >
                have an api key? unlock more templates
              </button>
            </div>
          )}
        </div>
      </div>
    )}

    {/* API key modal */}
    {showApiKeyModal && (
      <div className='fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm' onClick={() => setShowApiKeyModal(false)}>
        <form onSubmit={handleApiKeySubmit} onClick={(e) => e.stopPropagation()} className={`rounded-xl shadow-2xl p-8 max-w-sm w-full mx-4 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
          <h2 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Enter API Key</h2>
          <p className={`text-sm mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>An API key is required to access interview templates.</p>
          <input
            type='password'
            value={apiKeyInput}
            onChange={(e) => { setApiKeyInput(e.target.value); setApiKeyError(''); }}
            placeholder='API key'
            className={`w-full px-4 py-2 rounded-lg border outline-none mb-2 ${isDark ? 'bg-slate-700 border-slate-600 text-white placeholder-gray-400' : 'bg-gray-50 border-gray-300 text-gray-900'}`}
            autoFocus
          />
          <p className='text-red-500 text-sm h-5 mb-2'>{apiKeyError}</p>
          <div className='flex gap-3'>
            <button
              type='button'
              onClick={() => setShowApiKeyModal(false)}
              className={`flex-1 px-6 py-2.5 rounded-lg transition-colors font-semibold ${isDark ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`}
            >
              Cancel
            </button>
            <button
              type='submit'
              disabled={!apiKeyInput || isValidating}
              className='flex-1 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold disabled:opacity-50'
            >
              {isValidating ? 'Checking...' : 'Continue'}
            </button>
          </div>
        </form>
      </div>
    )}
  </>);
}

export default HomePage;
