import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useContext, useRef } from 'react';
import { joinRoom, getRoomName } from '../../api/api';
import EnterName from './EnterName';
import CodeEditor, { type InterviewType } from './CodeEditor';
import Popup from '../popup/Popup';
import { DarkModeContext, UserContext } from '../../App';
import { DEFAULT_CODE } from '../../util/reactTemplateContent';
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:7778';

interface RoomPageProps {
  interviewType?: InterviewType;
}

function RoomPage({ interviewType = 'react' }: RoomPageProps) {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { isDark } = useContext(DarkModeContext);
  const { userId } = useContext(UserContext);
  const [userName, setUserName] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [roomName, setRoomName] = useState('sce interview');
  const [code, setCode] = useState(DEFAULT_CODE);
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

  const handleJoinRoom = async () => {
    if (!userName.trim() || !roomId) return;
    
    setIsLoading(true);
    const response = await joinRoom(userId, userName, roomId);
    setIsLoading(false);

    if (response.ok) {
      setRoomName(response.data.roomName || 'sce interview');
      setCode(response.data.document || DEFAULT_CODE);
      setUsers(response.data.users || []);
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
  }, [roomId, userId, navigate]);

  // Setup WebSocket connection and handlers when the user successfully joins the room
  useEffect(() => {
    if (!isJoined || !roomId) return;
    const websocket = new WebSocket(`${WS_URL}/ws/${roomId}?userId=${userId}`);
    setWs(websocket);

    websocket.onopen = async () => {
      websocket.send(JSON.stringify({
        userId,
        type: 'user_joined',
        payload: {
          userId,
          roomId,
          userName
        }
      }));
    }

    websocket.onclose = () => {
    }

    websocket.onmessage = (event) => {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case 'user_joined':
          setUsers(prevUsers => [
            ...prevUsers,
            {
              userId: message.payload.userId,
              userName: message.payload.userName,
              cursorPosition: {
                lineNumber: 1,
                column: 1
              },
              selection: null
            }
          ]);
          // Show toast for new user joining
          const joinToastId = ++toastIdRef.current;
          setToasts(prev => [...prev, { id: joinToastId, message: `${message.payload.userName} joined the room` }]);
          setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== joinToastId));
          }, 3000);
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
                          endColumn: message.payload.endColumn
                        }
                  }
                : u
            )
          );
          break;

        case 'code_update':
          setCode(message.payload.code);
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
          // Auto-remove toast after 3 seconds
          setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== newToastId));
          }, 3000);
          break;
        }

        default:
          break;
      }
    }

    return () => {
      // Send user_left before closing
      if (websocket.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({
          userId,
          type: 'user_left',
          payload: { roomId }
        }));
      }
      websocket.close();
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
      <div className='relative'>
        <h1 className={`absolute top-6 left-0 right-0 text-center text-2xl font-bold z-10 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {roomName}
        </h1>
      </div>
      <CodeEditor
        code={code}
        setCode={setCode}
        ws={ws}
        interviewType={interviewType}
        users={users}
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
    </div>
  );
}

export default RoomPage;