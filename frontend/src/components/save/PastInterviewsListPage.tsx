import { useEffect, useState, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DarkModeContext, UserContext } from '../../App';
import Popup from '../popup/Popup';
import { listPastInterviews, getInterviewContent } from '../../api/api';

const CLARK_LOGIN_URL = import.meta.env.VITE_CLARK_LOGIN_URL || 'https://sce.sjsu.edu/login';

function signInWithSCE() {
  const redirect = encodeURIComponent(window.location.href);
  window.location.href = `${CLARK_LOGIN_URL}?redirect=${redirect}`;
}

interface PastInterview {
  roomId: string;
  roomName: string;
  files: string[];
}

function PastInterviewsListPage() {
  const { isDark } = useContext(DarkModeContext);
  const { user } = useContext(UserContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [showPopup, setShowPopup] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [interviews, setInterviews] = useState<PastInterview[]>(location.state?.interviews || []);
  const [loadingInterview, setLoadingInterview] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(!!location.state?.interviews);

  const isOfficer = !user.isGuest && user.accessLevel >= 2;

  useEffect(() => {
    if (!isOfficer || hasFetched) return;
    let cancelled = false;
    (async () => {
      const response = await listPastInterviews();
      if (cancelled) return;
      setHasFetched(true);
      if (!response.ok) {
        setErrorMessage(response.error || 'an error occurred');
        setShowPopup(true);
        return;
      }
      setInterviews(response.data || []);
    })();
    return () => { cancelled = true; };
  }, [isOfficer, hasFetched]);

  const handleCardClick = async (roomId: string) => {
    setLoadingInterview(roomId);
    try {
      const response = await getInterviewContent(roomId);
      if (!response.ok) {
        setErrorMessage(response.error || 'an error occurred');
        setShowPopup(true);
        setLoadingInterview(null);
        return;
      }
      navigate(`/past/${roomId}`, {
        state: {
          roomName: response.data.roomName,
          files: response.data.files || [{ name: response.data.roomName, content: response.data.document }],
          interviews,
        },
      });
    } catch {
      setErrorMessage('an error occurred trying to fetch the interview content');
      setShowPopup(true);
      setLoadingInterview(null);
    }
  };

  return (
    <div className={`min-h-screen ${isOfficer ? 'p-8' : 'flex items-center justify-center'} ${isDark ? 'bg-slate-900 text-white' : 'bg-gray-100 text-gray-900'}`}>
      <Popup
        message={errorMessage}
        buttonText="ok"
        isOpen={showPopup}
        onClickButton={() => setShowPopup(false)}
      />
      {isOfficer ? (
        <>
          <h1 className='text-3xl font-bold text-center mb-2'>past interviews</h1>
          <p className={`text-center mb-10 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            saved interview sessions
          </p>
          {interviews.length === 0 ? (
            <p className={`text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>no saved interviews found</p>
          ) : (
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto'>
              {interviews.map((interview) => (
                <button
                  key={interview.roomId}
                  onClick={() => handleCardClick(interview.roomId)}
                  disabled={loadingInterview !== null}
                  className={`text-left p-6 rounded-xl border-2 transition-all cursor-pointer hover:scale-[1.02] ${
                    loadingInterview === interview.roomId ? 'opacity-60' : ''
                  } ${
                    isDark
                      ? 'bg-slate-800 border-slate-700 hover:border-green-500'
                      : 'bg-white border-gray-200 hover:border-green-500'
                  }`}
                >
                  <h2 className='text-lg font-semibold mb-2'>{interview.roomName}</h2>
                  <p className={`text-sm font-mono ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{interview.roomId}</p>
                  <div className='mt-4 flex flex-wrap gap-2'>
                    {interview.files.map((file) => (
                      <span
                        key={file}
                        className={`text-xs font-mono px-2 py-1 rounded ${
                          isDark ? 'bg-slate-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {file}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className={`rounded-xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
          <h2 className='text-xl font-bold mb-4'>officers only</h2>
          <p className={`text-sm mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            past interviews are visible to SCE officers. sign in to continue.
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

export default PastInterviewsListPage;
