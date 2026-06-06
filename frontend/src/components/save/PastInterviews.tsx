import { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { DarkModeContext, UserContext } from '../../App';
import Popup from '../popup/Popup';
import { getInterviewContent, listPastInterviews } from '../../api/api';

const CLARK_LOGIN_URL = import.meta.env.VITE_CLARK_LOGIN_URL || 'https://sce.sjsu.edu/login';

function signInWithSCE() {
  const redirect = encodeURIComponent(window.location.href);
  window.location.href = `${CLARK_LOGIN_URL}?redirect=${redirect}`;
}

interface SavedFile {
  name: string;
  content: string;
}

function PastInterviewPage() {
  const { isDark } = useContext(DarkModeContext);
  const { user } = useContext(UserContext);
  const navigate = useNavigate();
  const location = useLocation();
  const { interviewId } = useParams<{ interviewId: string }>();
  const [showPopup, setShowPopup] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [files, setFiles] = useState<SavedFile[]>(location.state?.files || []);
  const [selectedFile, setSelectedFile] = useState<number>(0);
  const [roomName, setRoomName] = useState<string>(location.state?.roomName || '');
  const [goingBack, setGoingBack] = useState(false);

  const isOfficer = !user.isGuest && user.accessLevel >= 2;

  useEffect(() => {
    if (!interviewId) { navigate('/'); return; }
    if (files.length > 0) return;
    if (!isOfficer) return;
    let cancelled = false;
    (async () => {
      const response = await getInterviewContent(interviewId);
      if (cancelled) return;
      if (!response.ok) {
        setErrorMessage(response.error || 'an error occurred trying to fetch the interview content');
        setShowPopup(true);
        return;
      }
      setRoomName(response.data.roomName);
      if (response.data.files) {
        setFiles(response.data.files);
        setSelectedFile(0);
      } else if (response.data.document) {
        // Backwards compatibility with old save format
        setFiles([{ name: response.data.roomName, content: response.data.document }]);
        setSelectedFile(0);
      }
    })();
    return () => { cancelled = true; };
  }, [interviewId, files.length, isOfficer, navigate]);

  const handleBack = async () => {
    if (location.state?.interviews) {
      navigate('/past', { state: { interviews: location.state.interviews } });
      return;
    }
    setGoingBack(true);
    try {
      const response = await listPastInterviews();
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
        onClickButton={() => setShowPopup(false)}
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
      ) : (
        <div className={`rounded-xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
          <h2 className='text-xl font-bold mb-4'>officers only</h2>
          <p className={`text-sm mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            interview saves are visible to SCE officers. sign in to continue.
          </p>
          <button
            onClick={signInWithSCE}
            className='w-full px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold'
          >
            sign in with SCE
          </button>
        </div>
      )}
    </div>
  );
}

export default PastInterviewPage;
