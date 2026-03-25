import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { createContext, useState } from 'react';
import RoomPage from './components/room/RoomPage';
import HomePage from './components/home/HomePage';
import PastInterviewPage from './components/save/PastInterviews';
import TemplatesPage from './components/templates/TemplatesPage';
import { v4 as uuidv4 } from 'uuid';

export const DarkModeContext = createContext<{
  isDark: boolean;
  setIsDark: (isDark: boolean) => void;
}>({ isDark: true, setIsDark: () => {} });

export const UserContext = createContext<{
  userId: string;
}>({ userId: '' });

function App() {
  const [isDark, setIsDark] = useState(true);
  const [userId] = useState(() => {
    let id = localStorage.getItem('goderpad-userId');
    if (!id) {
      id = uuidv4();
      localStorage.setItem('goderpad-userId', id);
    }
    return id;
  })

  return (
    <UserContext.Provider value={{ userId }}>
      <DarkModeContext.Provider value={{ isDark, setIsDark }}>
        <BrowserRouter basename="/interview">
          <div className='relative'>
            <div className='absolute top-6 right-6 z-50'>
              <button
                onClick={() => setIsDark(!isDark)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  isDark 
                    ? 'bg-slate-800 text-white hover:bg-slate-700' 
                    : 'bg-white text-gray-900 hover:bg-gray-200 border border-gray-300'
                }`}
              >
                {isDark ? (
                  <svg 
                    xmlns='http://www.w3.org/2000/svg'
                    width='24'
                    height='24'
                    viewBox='0 0 24 24'
                    className='cursor-pointer'
                  >
                    <path
                      fill='currentColor'
                      d='M12 15q1.25 0 2.125-.875T15 12t-.875-2.125T12 9t-2.125.875T9 12t.875 2.125T12 15m0 1q-1.671 0-2.835-1.164Q8 13.67 8 12t1.165-2.835T12 8t2.836 1.165T16 12t-1.164 2.836T12 16m-7-3.5H1.5v-1H5zm17.5 0H19v-1h3.5zM11.5 5V1.5h1V5zm0 17.5V19h1v3.5zM6.746 7.404l-2.16-2.098l.695-.745l2.111 2.135zM18.72 19.439l-2.117-2.141l.652-.702l2.16 2.098zM16.596 6.745l2.098-2.16l.745.695l-2.135 2.111zM4.562 18.72l2.14-2.117l.664.652l-2.08 2.179zM12 12'
                    />
                  </svg>
                ) : (
                  <svg
                    xmlns='http://www.w3.org/2000/svg'
                    width='24'
                    height='24'
                    viewBox='0 0 24 24'
                    className='cursor-pointer'
                  >
                    <path
                      fill='none'
                      stroke='currentColor'
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      d='M12 21a9 9 0 0 0 8.997-9.252a7 7 0 0 1-10.371-8.643A9 9 0 0 0 12 21'
                      strokeWidth='1'
                    />
                  </svg>
                )}
              </button>
            </div>
            <Routes>
              <Route path='/' element={<HomePage />} />
              <Route path='/:roomId' element={<RoomPage />} />
              <Route path='/past/:interviewId' element={<PastInterviewPage />} />
              <Route path='/templates' element={<TemplatesPage />} />
            </Routes>
          </div>
        </BrowserRouter>
      </DarkModeContext.Provider>
    </UserContext.Provider>
  );
}

export default App
