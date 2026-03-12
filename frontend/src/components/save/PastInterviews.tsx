import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DarkModeContext } from '../../App';
import Popup from '../popup/Popup';
import { getInterviewContent } from '../../api/api';

function PastInterviewPage() {
  const { isDark } = useContext(DarkModeContext);
  const navigate = useNavigate();
  const { interviewId } = useParams<{ interviewId: string }>();
  const [showPopup, setShowPopup] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [interviewContent, setInterviewContent] = useState<string>('');
  const [roomName, setRoomName] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>(() => sessionStorage.getItem('api_key') || '');
  const [keyInput, setKeyInput] = useState('');

  const attemptFetch = async (key: string) => {
    try {
      const response = await getInterviewContent(interviewId!, key);
      if (!response.ok) {
        setErrorMessage(response.error || 'an error occurred trying to fetch the interview content');
        setShowPopup(true);
        return;
      }
      sessionStorage.setItem('api_key', key);
      setApiKey(key);
      setInterviewContent(response.data.document);
      setRoomName(response.data.roomName);
    } catch (err) {
      setErrorMessage('an error occurred trying to fetch the interview content');
      setShowPopup(true);
    }
  };

  useEffect(() => {
    if (!interviewId) { navigate('/'); return; }
    if (!apiKey) return;
    attemptFetch(apiKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await attemptFetch(keyInput);
  };

  return (
    <div className={`min-h-screen ${interviewContent ? 'p-8' : 'flex items-center justify-center'} ${isDark ? 'bg-slate-900 text-white' : 'bg-gray-100 text-gray-900'}`}>
      <Popup
        message={errorMessage}
        buttonText="ok"
        isOpen={showPopup}
        onClickButton={() => { setShowPopup(false); setKeyInput(''); }}
      />
      {interviewContent ? (
        <>
          <h1 className='text-3xl font-bold text-center mb-6'>{roomName}</h1>
          <pre className={`whitespace-pre-wrap break-all p-6 rounded-lg shadow-md
            ${isDark ? 'bg-slate-800 text-white' : 'bg-white text-gray-900'}`}>
            {interviewContent}
          </pre>
        </>
      ) : (
        <form onSubmit={handleKeySubmit} className={`rounded-xl shadow-2xl p-8 max-w-sm w-full mx-4 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
          <h2 className="text-xl font-bold mb-4">Enter API Key</h2>
          <p className={`text-sm mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>An API key is required to view interview saves.</p>
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="API key"
            className={`w-full px-4 py-2 rounded-lg border mb-4 outline-none ${isDark ? 'bg-slate-700 border-slate-600 text-white placeholder-gray-400' : 'bg-gray-50 border-gray-300 text-gray-900'}`}
            autoFocus
          />
          <button
            type="submit"
            disabled={!keyInput}
            className="w-full px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold disabled:opacity-50"
          >
            Continue
          </button>
        </form>
      )}
    </div>
  );
}

export default PastInterviewPage;
