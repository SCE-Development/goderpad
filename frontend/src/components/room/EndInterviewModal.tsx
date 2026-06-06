import { useContext, useEffect, useState } from 'react';
import { DarkModeContext } from '../../App';
import { endInterview } from '../../api/api';

interface EndInterviewModalProps {
  roomId: string;
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  onAttemptStart: () => void;
  onAttemptError: () => void;
  onEnded: () => void;
}

function EndInterviewModal({ roomId, userId, isOpen, onClose, onAttemptStart, onAttemptError, onEnded }: EndInterviewModalProps) {
  const { isDark } = useContext(DarkModeContext);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setError('');
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    // Mark "we're ending this" before the request so the parent can
    // suppress the incoming `interview_ended` broadcast (which arrives
    // ~250ms before the HTTP response returns) from triggering the
    // "interview has ended" popup intended for other users.
    onAttemptStart();
    const response = await endInterview(roomId, userId);
    setIsSubmitting(false);

    if (response.ok) {
      onEnded();
      return;
    }
    onAttemptError();
    setError(response.error || 'Failed to end interview');
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm' onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className={`rounded-xl shadow-2xl p-8 max-w-sm w-full mx-4 ${isDark ? 'bg-slate-800' : 'bg-white'}`}
      >
        <h2 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>End interview?</h2>
        <p className={`text-sm mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          This will save the code to past interviews and disconnect everyone.
        </p>
        <p className='text-red-500 text-sm h-5 mb-2'>{error}</p>
        <div className='flex gap-3'>
          <button
            type='button'
            onClick={onClose}
            className={`flex-1 px-6 py-2.5 rounded-lg transition-colors font-semibold ${isDark ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`}
          >
            Cancel
          </button>
          <button
            type='submit'
            disabled={isSubmitting}
            className='flex-1 px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold disabled:opacity-50'
          >
            {isSubmitting ? 'Ending...' : 'End interview'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default EndInterviewModal;
