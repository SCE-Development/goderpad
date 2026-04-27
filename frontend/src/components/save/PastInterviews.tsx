import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { DarkModeContext } from '../../App';
import Popup from '../popup/Popup';
import { getInterviewContent, listPastInterviews } from '../../api/api';

interface SavedFile {
  name: string;
  content: string;
}

function PastInterviewPage() {
  const { isDark } = useContext(DarkModeContext);
  const navigate = useNavigate();
  const location = useLocation();
  const { interviewId } = useParams<{ interviewId: string }>();
  const [showPopup, setShowPopup] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [files, setFiles] = useState<SavedFile[]>(location.state?.files || []);
  const [selectedFile, setSelectedFile] = useState<number>(0);
  const [roomName, setRoomName] = useState<string>(location.state?.roomName || '');
  const [apiKey, setApiKey] = useState<string>(() => sessionStorage.getItem('api_key') || '');
  const [keyInput, setKeyInput] = useState('');
  const [goingBack, setGoingBack] = useState(false);

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
      setRoomName(response.data.roomName);
      if (response.data.files) {
        setFiles(response.data.files);
        setSelectedFile(0);
      } else if (response.data.document) {
        // Backwards compatibility with old save format
        setFiles([{ name: response.data.roomName, content: response.data.document }]);
        setSelectedFile(0);
      }
    } catch (err) {
      setErrorMessage('an error occurred trying to fetch the interview content');
      setShowPopup(true);
    }
  };

  useEffect(() => {
    if (!interviewId) { navigate('/'); return; }
    // Skip fetch if we already have data from navigation state
    if (files.length > 0) return;
    if (!apiKey) return;
    attemptFetch(apiKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await attemptFetch(keyInput);
  };

  const handleBack = async () => {
    // If we already have the interviews list from navigation state, pass it back
    if (location.state?.interviews) {
      navigate('/past', { state: { interviews: location.state.interviews } });
      return;
    }
    // Otherwise fetch the list before navigating
    setGoingBack(true);
    try {
      const response = await listPastInterviews(apiKey);
      if (response.ok) {
        navigate('/past', { state: { interviews: response.data || [] } });
      } else {
        navigate('/past');
      }
    } catch {
      navigate('/past');
    }
  };

  return (
    <div className={`min-h-screen ${files.length > 0 ? 'p-8' : 'flex items-center justify-center'} ${isDark ? 'bg-slate-900 text-white' : 'bg-gray-100 text-gray-900'}`}>
      <Popup
        message={errorMessage}
        buttonText="ok"
        isOpen={showPopup}
        onClickButton={() => { setShowPopup(false); setKeyInput(''); }}
      />
      {files.length > 0 ? (
        <>
          <button
            onClick={handleBack}
            disabled={goingBack}
            className={`mb-6 px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
              goingBack ? 'opacity-60' : ''
            } ${
              isDark
                ? 'bg-slate-800 text-gray-300 hover:bg-slate-700'
                : 'bg-white text-gray-700 hover:bg-gray-200 border border-gray-300'
            }`}
          >
            &larr; back to past interviews
          </button>
          <h1 className='text-3xl font-bold text-center mb-6'>{roomName}</h1>
          {files.length > 1 && (
            <div className="flex gap-2 mb-4 justify-center flex-wrap">
              {files.map((file, index) => (
                <button
                  key={file.name}
                  onClick={() => setSelectedFile(index)}
                  className={`px-4 py-2 rounded-lg font-mono text-sm transition-colors ${
                    selectedFile === index
                      ? 'bg-green-600 text-white'
                      : isDark
                        ? 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {file.name}
                </button>
              ))}
            </div>
          )}
          {files.length === 1 && (
            <p className={`text-center mb-4 font-mono text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {files[0].name}
            </p>
          )}
          <pre className={`whitespace-pre overflow-x-auto p-6 rounded-lg shadow-md
            ${isDark ? 'bg-slate-800 text-white' : 'bg-white text-gray-900'}`}>
            {files[selectedFile]?.content}
          </pre>
        </>
      ) : !apiKey ? (
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
      ) : null}
    </div>
  );
}

export default PastInterviewPage;
