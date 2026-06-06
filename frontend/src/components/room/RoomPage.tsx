import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useContext, useRef } from 'react';
import { joinRoom, getRoomName } from '../../api/api';
import EnterName from './EnterName';
import CodeEditor, { type InterviewType } from './CodeEditor';
import EndInterviewModal from './EndInterviewModal';
import Popup from '../popup/Popup';
import { DarkModeContext, UserContext } from '../../App';
import { DEFAULT_CODE } from '../../util/reactTemplateContent';
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:7778';

interface RoomPageProps {
  interviewType?: InterviewType;
}

function RoomPage({ interviewType: propInterviewType }: RoomPageProps) {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const fallbackInterviewType: InterviewType =
    (location.state as { interviewType?: InterviewType })?.interviewType ?? propInterviewType ?? 'react';
  const { isDark } = useContext(DarkModeContext);
  const { userId } = useContext(UserContext);
  const [userName, setUserName] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [roomName, setRoomName] = useState('sce interview');
  const [code, setCode] = useState(DEFAULT_CODE);
  const [language, setLanguage] = useState<string>(fallbackInterviewType === 'leetcode' ? 'python' : 'react');
  const [interviewType, setInterviewType] = useState<InterviewType>(fallbackInterviewType);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [users, setUsers] = useState<Array<{
    userId: string;
    userName: string;
    cursorPosition: {
      lineNumber: number;
      column: number 
    } | null;
    selection: {
      startLineNumber: number;
      startColumn: number;
      endLineNumber: number;
      endColumn: number;
    } | null;
  }>>([]);
  const [toasts, setToasts] = useState<Array<{ id: number; message: string }>>([]);
  const toastIdRef = useRef(0);
  const [showEndConfirmModal, setShowEndConfirmModal] = useState(false);
  const [endedByMe, setEndedByMe] = useState(false);
  const [endedByOther, setEndedByOther] = useState(false);
  const endedByMeRef = useRef(false);
  const [connectionState, setConnectionState] = useState<'connected' | 'reconnecting' | 'failed'>('connected');
  const shouldReconnectRef = useRef(true);

  // Duplicate-tab detection: if another tab in this browser already has this
  // room open (same origin → same userId in localStorage), block joining here
  // and prompt the user back to their original tab. Without this, both tabs
  // race to be the active connection for the same userID and the server thrashes.
  const [duplicateTabDetected, setDuplicateTabDetected] = useState(false);
  const [tabCheckComplete, setTabCheckComplete] = useState(false);
  const tabIdRef = useRef<string>(crypto.randomUUID());
  const isJoinedRef = useRef(false);
  useEffect(() => { isJoinedRef.current = isJoined; }, [isJoined]);

  // Detect another tab already in this room before we try to join. Sends a
  // ping on a per-room BroadcastChannel; any already-joined tab answers with
  // a pong. If we hear a pong within the grace window we flip duplicateTab
  // and stop the join flow. Otherwise we mark the check complete and the
  // auto-join effect proceeds normally.
  useEffect(() => {
    if (!roomId) return;
    if (typeof BroadcastChannel === 'undefined') {
      setTabCheckComplete(true);
      return;
    }

    const channel = new BroadcastChannel(`goderpad-room-${roomId}`);

    const onMessage = (e: MessageEvent) => {
      if (!e.data || e.data.from === tabIdRef.current) return;
      if (e.data.type === 'ping' && isJoinedRef.current) {
        channel.postMessage({ type: 'pong', from: tabIdRef.current });
      } else if (e.data.type === 'pong') {
        setDuplicateTabDetected(true);
        setTabCheckComplete(true);
      }
    };
    channel.addEventListener('message', onMessage);

    channel.postMessage({ type: 'ping', from: tabIdRef.current });
    const timer = setTimeout(() => setTabCheckComplete(true), 300);

    return () => {
      clearTimeout(timer);
      channel.removeEventListener('message', onMessage);
      channel.close();
    };
  }, [roomId]);

  const handleJoinRoom = async () => {
    if (!userName.trim() || !roomId || duplicateTabDetected) return;

    setIsLoading(true);
    const response = await joinRoom(userId, userName, roomId);
    setIsLoading(false);

    if (response.ok) {
      setRoomName(response.data.roomName || 'sce interview');
      setCode(response.data.document || DEFAULT_CODE);
      setUsers(response.data.users || []);
      const serverLanguage: string = response.data.language || (fallbackInterviewType === 'leetcode' ? 'python' : 'react');
      setLanguage(serverLanguage);
      setInterviewType(serverLanguage === 'react' ? 'react' : 'leetcode');
      const now = new Date().getTime();
      const expiry = now + (24 * 60 * 60 * 1000);
      const data = JSON.stringify({ userName, expiry });
      localStorage.setItem(`goderpad-cookie-${roomId}`, data);
      setIsJoined(true);
    } else {
      setShowPopup(true);
    }
  };

  useEffect(() => {
    if (!roomId) {
      navigate('/');
      return;
    }

    const fetchRoomName = async () => {
      try {
        const response = await getRoomName(roomId);
        if (response.ok) {
          setRoomName(response.data.roomName || 'sce interview');
        } else {
          setShowPopup(true);
        }
      } catch (err) {
        setShowPopup(true);
      }
    };

    fetchRoomName();
  }, [roomId, navigate]);

  useEffect(() => {
    if (!roomId) {
      navigate('/');
      return;
    }
    if (!tabCheckComplete || duplicateTabDetected) return;

    const storedData = localStorage.getItem(`goderpad-cookie-${roomId}`);
    if (!storedData) return;

    const joinWithStoredData = async () => {
      try {
        const { userName: storedUserName, expiry } = JSON.parse(storedData);
        const now = new Date().getTime();
        
        if (now >= expiry) {
          localStorage.removeItem(`goderpad-cookie-${roomId}`);
          return;
        }

        const response = await joinRoom(userId, storedUserName, roomId);
        
        if (response.ok) {
          setRoomName(response.data.roomName || 'sce interview');
          setCode(response.data.document || DEFAULT_CODE);
          setUsers(response.data.users || []);
          const serverLanguage: string = response.data.language || (fallbackInterviewType === 'leetcode' ? 'python' : 'react');
          setLanguage(serverLanguage);
          setInterviewType(serverLanguage === 'react' ? 'react' : 'leetcode');
          setUserName(storedUserName);
          setIsJoined(true);
          
          // Update expiry
          const updatedExpiry = now + (24 * 60 * 60 * 1000);
          localStorage.setItem(`goderpad-cookie-${roomId}`, JSON.stringify({ userName: storedUserName, expiry: updatedExpiry }));
        } else {
          localStorage.removeItem(`goderpad-cookie-${roomId}`);
        }
      } catch (e) {
        localStorage.removeItem(`goderpad-cookie-${roomId}`);
      }
    };

    joinWithStoredData();
  }, [roomId, userId, navigate, tabCheckComplete, duplicateTabDetected]);

  // Setup WebSocket connection and handlers when the user successfully joins the room.
  // Automatically reconnects on close/error with exponential backoff. The server-side
  // ping/pong (PingPeriod=30s, PongWait=60s) keeps healthy connections alive through
  // NAT/proxy idle-timeouts; this client logic handles the rare case where a connection
  // really does die (server restart, network drop, laptop sleep, etc.).
  useEffect(() => {
    if (!isJoined || !roomId) return;

    shouldReconnectRef.current = true;
    setConnectionState('connected');

    let attempt = 0;
    let activeWs: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const attachHandlers = (websocket: WebSocket) => {
      websocket.onopen = () => {
        attempt = 0;
        setConnectionState('connected');
        websocket.send(JSON.stringify({
          userId,
          type: 'user_joined',
          payload: { userId, roomId, userName },
        }));
      };

      websocket.onmessage = (event) => {
        const message = JSON.parse(event.data);

        switch (message.type) {
          case 'user_joined':
            // De-dup: on reconnect, other clients may still have us in their
            // user list (their server-side cleanup may not have fired). Skip
            // adding a duplicate and skip the join toast in that case.
            setUsers(prevUsers => {
              if (prevUsers.some(u => u.userId === message.payload.userId)) return prevUsers;
              const joinToastId = ++toastIdRef.current;
              setToasts(prev => [...prev, { id: joinToastId, message: `${message.payload.userName} joined the room` }]);
              setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== joinToastId));
              }, 3000);
              return [
                ...prevUsers,
                {
                  userId: message.payload.userId,
                  userName: message.payload.userName,
                  cursorPosition: { lineNumber: 1, column: 1 },
                  selection: null,
                },
              ];
            });
            break;

          case 'user_left':
            setUsers(prevUsers => prevUsers.filter(u => u.userId !== message.userId));
            break;

          case 'cursor_update':
            setUsers(prevUsers =>
              prevUsers.map(u =>
                u.userId === message.userId
                  ? { ...u, cursorPosition: { lineNumber: message.payload.lineNumber, column: message.payload.column } }
                  : u
              )
            );
            break;

          case 'selection_update':
            setUsers(prevUsers =>
              prevUsers.map(u =>
                u.userId === message.userId
                  ? {
                      ...u,
                      selection: message.payload.startLineNumber === message.payload.endLineNumber &&
                                 message.payload.startColumn === message.payload.endColumn
                        ? null
                        : {
                            startLineNumber: message.payload.startLineNumber,
                            startColumn: message.payload.startColumn,
                            endLineNumber: message.payload.endLineNumber,
                            endColumn: message.payload.endColumn,
                          },
                    }
                  : u
              )
            );
            break;

          case 'code_update':
            setCode(message.payload.code);
            break;

          case 'interview_ended':
            // Don't try to reconnect after an explicit end — the room is gone.
            shouldReconnectRef.current = false;
            if (!endedByMeRef.current) {
              setEndedByOther(true);
            }
            break;

          case 'visibility_change': {
            const user = users.find(u => u.userId === message.userId);
            const name = message.payload.userName || user?.userName || 'Someone';
            const isVisible = message.payload.isVisible;
            const toastMessage = isVisible
              ? `${name} returned to goderpad`
              : `${name} exited goderpad`;
            const newToastId = ++toastIdRef.current;
            setToasts(prev => [...prev, { id: newToastId, message: toastMessage }]);
            setTimeout(() => {
              setToasts(prev => prev.filter(t => t.id !== newToastId));
            }, 3000);
            break;
          }

          default:
            break;
        }
      };

      websocket.onclose = () => {
        if (!shouldReconnectRef.current) return;
        scheduleReconnect();
      };

      websocket.onerror = () => {
        // onclose fires right after; let it handle reconnect scheduling.
      };
    };

    const scheduleReconnect = () => {
      if (!shouldReconnectRef.current) return;
      if (attempt >= 10) {
        setConnectionState('failed');
        return;
      }
      setConnectionState('reconnecting');
      const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
      attempt += 1;
      reconnectTimer = setTimeout(() => { connect(); }, delay);
    };

    const connect = async () => {
      if (!shouldReconnectRef.current) return;

      // On reconnect attempts (not the initial connect), re-join via HTTP to
      // refresh the server's user record and pull the latest state. The
      // server's JoinRoom tears down our stale User if it's still around
      // (see services/room.go), so we don't leak goroutines.
      if (attempt > 0) {
        const response = await joinRoom(userId, userName, roomId);
        if (!shouldReconnectRef.current) return;
        if (!response.ok) {
          // Room may be gone (expired or ended) or server is down; back off.
          scheduleReconnect();
          return;
        }
        // Trust the server's view. Any local edits made during the disconnect
        // window are lost — same behavior as a manual refresh today.
        setCode(response.data.document || DEFAULT_CODE);
        setUsers(response.data.users || []);
        const serverLanguage: string = response.data.language || (interviewType === 'leetcode' ? 'python' : 'react');
        setLanguage(serverLanguage);
      }

      const websocket = new WebSocket(`${WS_URL}/ws/${roomId}?userId=${userId}`);
      activeWs = websocket;
      setWs(websocket);
      attachHandlers(websocket);
    };

    connect();

    return () => {
      shouldReconnectRef.current = false;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (activeWs) {
        if (activeWs.readyState === WebSocket.OPEN) {
          activeWs.send(JSON.stringify({
            userId,
            type: 'user_left',
            payload: { roomId },
          }));
        }
        activeWs.close();
        activeWs = null;
      }
      setWs(null);
    };
  }, [isJoined, roomId]);

  // Detect tab visibility changes and window focus changes, broadcast to other users
  useEffect(() => {
    if (!ws || !isJoined) return;

    let lastVisibleState: boolean | null = null;

    const sendVisibilityChange = (isVisible: boolean) => {
      // Only send if the state actually changed
      if (lastVisibleState === isVisible) return;
      lastVisibleState = isVisible;

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          userId,
          type: 'visibility_change',
          payload: {
            userName,
            isVisible
          }
        }));
      }
    };

    const handleVisibilityChange = () => {
      sendVisibilityChange(!document.hidden);
    };

    const handleWindowBlur = () => {
      sendVisibilityChange(false);
    };

    const handleWindowFocus = () => {
      sendVisibilityChange(true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [ws, isJoined, userId, userName]);

  if (!isJoined) {
    if (duplicateTabDetected) {
      return (
        <Popup
          message="you're already in this room in another tab!"
          buttonText="ok"
          isOpen={true}
          onClickButton={() => {
            // window.close() only works on tabs the script itself opened, so
            // it's a best-effort; fall back to navigating home if the browser
            // blocks it.
            window.close();
            setTimeout(() => navigate('/'), 100);
          }}
        />
      );
    }
    return (<>
      <Popup
        message="sorry, an error occurred trying to join the room"
        buttonText="return to home"
        isOpen={showPopup}
        onClickButton={() => {
          setShowPopup(false);
          navigate('/');
        }}
      />
      <EnterName
        roomName={roomName}
        userName={userName}
        setUserName={setUserName}
        isLoading={isLoading}
        onJoinRoom={handleJoinRoom}
      />
    </>);
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-900 text-white' : 'bg-gray-100 text-gray-900'}`}>
      <button
        onClick={() => setShowEndConfirmModal(true)}
        className={`absolute top-6 right-24 z-50 px-4 py-2 rounded-lg font-semibold transition-colors ${
          isDark
            ? 'bg-red-700 text-white hover:bg-red-600'
            : 'bg-red-600 text-white hover:bg-red-700'
        }`}
      >
        End Interview
      </button>
      <div className='relative'>
        <h1 className={`absolute top-6 left-0 right-0 text-center text-2xl font-bold z-10 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {roomName}
        </h1>
      </div>
      <CodeEditor
        code={code}
        setCode={setCode}
        ws={ws}
        roomId={roomId!}
        interviewType={interviewType}
        users={users}
        initialLanguage={language}
      />
      {/* Toast notifications */}
      <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-lg shadow-lg animate-slide-in ${
              isDark ? 'bg-slate-700 text-white' : 'bg-white text-gray-900 border border-gray-200'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>

      {connectionState !== 'connected' && (
        <div className='fixed bottom-4 left-4 z-50'>
          <div className={`px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 ${
            connectionState === 'failed'
              ? 'bg-red-600 text-white'
              : isDark ? 'bg-yellow-600 text-white' : 'bg-yellow-500 text-white'
          }`}>
            {connectionState === 'reconnecting' && (
              <svg className='animate-spin' xmlns='http://www.w3.org/2000/svg' width='14' height='14' fill='none' viewBox='0 0 24 24'>
                <circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4' />
                <path className='opacity-75' fill='currentColor' d='M4 12a8 8 0 018-8v8z' />
              </svg>
            )}
            <span className='text-sm font-medium'>
              {connectionState === 'reconnecting' ? 'reconnecting…' : 'connection failed — please refresh'}
            </span>
          </div>
        </div>
      )}

      <EndInterviewModal
        roomId={roomId!}
        isOpen={showEndConfirmModal && !endedByMe && !endedByOther}
        onClose={() => setShowEndConfirmModal(false)}
        onAttemptStart={() => {
          endedByMeRef.current = true;
          shouldReconnectRef.current = false;
        }}
        onAttemptError={() => {
          endedByMeRef.current = false;
          shouldReconnectRef.current = true;
        }}
        onEnded={() => {
          endedByMeRef.current = true;
          shouldReconnectRef.current = false;
          setEndedByMe(true);
          setShowEndConfirmModal(false);
        }}
      />

      <Popup
        message='You have successfully ended the interview.'
        buttonText='Return to home'
        isOpen={endedByMe}
        onClickButton={() => navigate('/')}
      />

      <Popup
        message='The interview has ended.'
        buttonText='Return to home'
        isOpen={!endedByMe && endedByOther}
        onClickButton={() => navigate('/')}
      />
    </div>
  );
}

export default RoomPage;