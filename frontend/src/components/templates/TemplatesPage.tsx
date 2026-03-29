import { useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DarkModeContext, UserContext } from '../../App';
import { createRoom } from '../../api/api';
import { TEMPLATES, type Template } from '../../util/reactTemplateContent';

function TemplatesPage() {
  const { isDark } = useContext(DarkModeContext);
  const { userId } = useContext(UserContext);
  const navigate = useNavigate();
  const location = useLocation();
  const { userName, roomName } = (location.state as { userName: string; roomName: string }) || {};

  if (!userName) {
    navigate('/');
    return null;
  }

  const handleSelectTemplate = async (template: Template) => {
    const finalRoomName = roomName || template.name;
    const response = await createRoom(userId, userName, finalRoomName, template.code);
    if (response.ok) {
      const roomId = response.data.roomId;
      const expiry = new Date().getTime() + (24 * 60 * 60 * 1000);
      const data = JSON.stringify({ userName, expiry });
      localStorage.setItem(`goderpad-cookie-${roomId}`, data);
      navigate(`/${roomId}`);
    }
  };

  return (
    <div className={`min-h-screen p-8 ${isDark ? 'bg-slate-900 text-white' : 'bg-gray-100 text-gray-900'}`}>
      <h1 className='text-3xl font-bold text-center mb-2'>choose a template</h1>
      <p className={`text-center mb-10 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
        select a problem for your sce interview
      </p>
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto'>
        {TEMPLATES.map((template) => (
          <button
            key={template.name}
            onClick={() => handleSelectTemplate(template)}
            className={`text-left p-6 rounded-xl border-2 transition-all cursor-pointer hover:scale-[1.02] ${
              isDark
                ? 'bg-slate-800 border-slate-700 hover:border-green-500'
                : 'bg-white border-gray-200 hover:border-green-500'
            }`}
          >
            <h2 className='text-lg font-semibold mb-2'>{template.name}</h2>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{template.description}</p>
            <pre className={`mt-4 text-xs rounded-lg p-3 overflow-hidden max-h-24 leading-relaxed ${
              isDark ? 'bg-slate-900 text-gray-300' : 'bg-gray-50 text-gray-700'
            }`}>
              {template.code.slice(0, 120)}...
            </pre>
          </button>
        ))}
      </div>
    </div>
  );
}

export default TemplatesPage;
