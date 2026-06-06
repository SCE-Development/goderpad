import { useState, useContext, useEffect } from 'react';
import { createRoom, devLogin } from '../../api/api';
import { useNavigate } from 'react-router-dom';
import { DarkModeContext, UserContext } from '../../App';
import Popup from '../popup/Popup';
import { TEMPLATES, DEFAULT_CODE as DEFAULT_REACT_CODE } from '../../util/reactTemplateContent';
import { type InterviewType } from '../room/CodeEditor';

const CLARK_LOGIN_URL = import.meta.env.VITE_CLARK_LOGIN_URL || 'https://sce.sjsu.edu/login';
const DEV_AUTH_ENABLED = import.meta.env.VITE_DEV_AUTH === 'true';

function signInWithSCE() {
  const redirect = encodeURIComponent(window.location.href);
  window.location.href = `${CLARK_LOGIN_URL}?redirect=${redirect}`;
}

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
  code: `def main():\n    print("Hello, World!")\n\nmain()`,
  interviewType: 'leetcode',
};

// Non-standard templates require officer access (Clark accessLevel >= 2).
const EXTRA_TEMPLATES: TemplateCard[] = TEMPLATES
  .filter(t => t.name !== 'standard')
  .map(t => ({ ...t, interviewType: 'react' as InterviewType }));

function HomePage() {
  const { isDark } = useContext(DarkModeContext);
  const { user, refresh } = useContext(UserContext);
  const [guestName, setGuestName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [showPopup, setShowPopup] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const navigate = useNavigate();

  const userName = user.isGuest ? guestName : user.name;
  const isOfficer = !user.isGuest && user.accessLevel >= 2;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showTemplateModal) setShowTemplateModal(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showTemplateModal]);

  const handleSelectTemplate = async (template: TemplateCard) => {
    const finalRoomName = roomName || template.name;
    const language = template.interviewType === 'leetcode' ? 'python' : 'react';
    const response = await createRoom(user.userId, userName, finalRoomName, language, template.code);
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

  const handleDevLogin = async (accessLevel: number, displayName: string) => {
    const response = await devLogin(displayName, accessLevel);
    if (response.ok) await refresh();
  };

  const templates: TemplateCard[] = [
    REACT_CARD,
    LEETCODE_CARD,
    ...(isOfficer ? EXTRA_TEMPLATES : []),
  ];

  return (<>
    <Popup
      message="sorry, an error occurred trying to create the room."
      buttonText="ok"
      isOpen={showPopup}
      onClickButton={() => setShowPopup(false)}
    />

    <div className={`min-h-screen ${isDark ? 'bg-slate-900 text-white' : 'bg-gray-100 text-gray-900'}`}>
      <h1 className='text-4xl font-bold text-center pt-10 sm:pt-20 px-8'>welcome to goderpad</h1>
      <h3 className='text-xl text-center pt-4 px-8'>sce's interview platform</h3>

      <div className='flex justify-center mt-6 px-8'>
        {user.isGuest ? (
          <button
            onClick={signInWithSCE}
            className='px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium'
          >
            sign in with SCE
          </button>
        ) : (
          <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            signed in as <span className='font-semibold'>{user.name || user.email}</span>
            {isOfficer && <span className='ml-2 text-xs px-2 py-0.5 rounded-full bg-green-700 text-green-100'>officer</span>}
          </p>
        )}
      </div>

      {DEV_AUTH_ENABLED && user.isGuest && (
        <div className={`flex flex-wrap gap-2 justify-center mt-3 px-8 text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          <span>dev:</span>
          <button onClick={() => handleDevLogin(1, 'Dev Member')} className='underline hover:text-blue-500'>sign in as member</button>
          <span>·</span>
          <button onClick={() => handleDevLogin(2, 'Dev Officer')} className='underline hover:text-blue-500'>sign in as officer</button>
        </div>
      )}

      <div className='flex flex-row gap-30 justify-center mt-8 sm:mt-12 px-8 sm:px-6'>
        <div className='flex flex-col gap-6 w-full max-w-md mx-auto'>
          <h2 className='text-3xl font-semibold mb-2 text-center'>create an interview room</h2>

          <div className='flex flex-col gap-3'>
            <label htmlFor='name' className='text-lg font-medium'>your name</label>
            <input
              id='name'
              type='text'
              value={userName}
              onChange={(e) => { if (user.isGuest) setGuestName(e.target.value); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && userName.trim()) setShowTemplateModal(true); }}
              placeholder='enter your name'
              disabled={!user.isGuest}
              className={`px-5 py-4 text-lg rounded-lg focus:outline-none focus:border-blue-500 ${isDark
                ? 'bg-slate-800 border border-slate-700 text-white'
                : 'bg-white border border-gray-300 text-gray-900'
              } ${!user.isGuest ? 'opacity-70 cursor-not-allowed' : ''}`}
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

          {!isOfficer && user.isGuest && (
            <div className='mt-6 text-center'>
              <button
                onClick={signInWithSCE}
                className={`text-sm underline transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}
              >
                sign in with SCE to unlock more templates
              </button>
            </div>
          )}
        </div>
      </div>
    )}
  </>);
}

export default HomePage;
