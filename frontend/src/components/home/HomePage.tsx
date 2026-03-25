import React, { useState, useContext, useEffect } from 'react';
import { createRoom, validateApiKey } from '../../api/api';
import { useNavigate } from 'react-router-dom';
import { DarkModeContext } from '../../App';
import { UserContext } from '../../App';
import Popup from '../popup/Popup';

function HomePage() {
  const { isDark } = useContext(DarkModeContext);
  const [userName, setUserName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [showPopup, setShowPopup] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiKeyError, setApiKeyError] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const navigate = useNavigate();
  const { userId } = useContext(UserContext);

  const handleCreateRoom = async () => {
    let response;
    if (roomName === '') {
      response = await createRoom(userId, userName, `${userName}'s sce interview`);
    } else {
      response = await createRoom(userId, userName, roomName);
    }
    if (response.ok) {
      const roomId = response.data.roomId;
      const expiry = new Date().getTime() + (24 * 60 * 60 * 1000); // 24 hours
      const data = JSON.stringify({ userName, expiry });
      localStorage.setItem(`goderpad-cookie-${roomId}`, data);
      navigate(`/${roomId}`);
    } else {
      setShowPopup(true);
    }
  };

  useEffect(() => {
    if (!showApiKeyModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowApiKeyModal(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showApiKeyModal]);

  const handleTemplateButtonClick = () => {
    setApiKeyInput('');
    setApiKeyError('');
    setShowApiKeyModal(true);
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
    navigate('/templates', { state: { userName, roomName, userId } });
  };

  return (<>
    <Popup
      message="sorry, an error occurred trying to create the room."
      buttonText="ok"
      isOpen={showPopup}
      onClickButton={() => {
        setShowPopup(false);
      }}
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
              onKeyDown={(e) => {
                if (e.key === 'Enter' && userName.trim()) {
                  handleCreateRoom();
                }
              }}
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
              onKeyDown={(e) => {
                if (e.key === 'Enter' && userName.trim()) {
                  handleCreateRoom();
                }
              }}
              placeholder='name your room'
              className={`px-5 py-4 text-lg rounded-lg focus:outline-none focus:border-blue-500 ${isDark
                  ? 'bg-slate-800 border border-slate-700 text-white'
                  : 'bg-white border border-gray-300 text-gray-900'
                }`}
            />
          </div>

          <button
            onClick={handleCreateRoom}
            className='mt-4 px-6 py-4 text-lg bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer transition-colors disabled:opacity-50'
            disabled={!userName.trim()}
          >
            create room
          </button>

          <button
            onClick={handleTemplateButtonClick}
            className={`text-base cursor-pointer transition-colors underline disabled:opacity-50 disabled:cursor-not-allowed ${isDark ? 'text-white hover:text-gray-300' : 'text-gray-900 hover:text-gray-700'}`}
            disabled={!userName.trim() || !roomName.trim()}
          >
            or choose a template
          </button>
        </div>
      </div>
    </div>

    {showApiKeyModal && (
      <div className='fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm' onClick={() => setShowApiKeyModal(false)}>
        <form onSubmit={handleApiKeySubmit} onClick={(e) => e.stopPropagation()} className={`rounded-xl shadow-2xl p-8 max-w-sm w-full mx-4 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
          <h2 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Enter API Key</h2>
          <p className={`text-sm mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>An API key is required to access interview templates.</p>
          <input
            type="password"
            value={apiKeyInput}
            onChange={(e) => { setApiKeyInput(e.target.value); setApiKeyError(''); }}
            placeholder="API key"
            className={`w-full px-4 py-2 rounded-lg border outline-none mb-2 ${isDark ? 'bg-slate-700 border-slate-600 text-white placeholder-gray-400' : 'bg-gray-50 border-gray-300 text-gray-900'}`}
            autoFocus
          />
          <p className="text-red-500 text-sm h-5 mb-2">{apiKeyError}</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowApiKeyModal(false)}
              className={`flex-1 px-6 py-2.5 rounded-lg transition-colors font-semibold ${isDark ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!apiKeyInput || isValidating}
              className="flex-1 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold disabled:opacity-50"
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
