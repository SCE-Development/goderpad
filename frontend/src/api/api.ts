const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:7778';

export interface MeResponse {
  isGuest: boolean;
  userId?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  accessLevel?: number;
}

export async function fetchMe(): Promise<MeResponse> {
  try {
    const response = await fetch(`${API_URL}/me`, {
      credentials: 'include',
    });
    if (!response.ok) return { isGuest: true };
    return await response.json();
  } catch {
    return { isGuest: true };
  }
}

export async function devLogin(name: string, accessLevel: number) {
  try {
    const response = await fetch(`${API_URL}/dev/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, accessLevel }),
    });
    return await response.json();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error signing in' };
  }
}

export async function executeCode(language: string, code: string) {
  try {
    const response = await fetch(`${API_URL}/execute`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language, code }),
    });
    return await response.json();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'failed to reach execution service' };
  }
}

export async function createRoom(userId: string, name: string, roomName: string, language: string, initialCode?: string) {
  try {
    const response = await fetch(`${API_URL}/createRoom`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        name,
        roomName,
        language,
        ...(initialCode !== undefined && { initialCode }),
      }),
    });
    return await response.json();
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Error creating room'
    };
  }
}

export async function joinRoom(userId: string, name: string, roomId: string) {
  try {
    const response = await fetch(`${API_URL}/joinRoom`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        name,
        roomId
      }),
    });
    return await response.json();
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Error joining room'
    };
  }
}

export async function switchLanguage(roomId: string, language: string) {
  try {
    const response = await fetch(`${API_URL}/switchLanguage`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ roomId, language }),
    });
    return await response.json();
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Error switching language'
    };
  }
}

export async function getRoomName(roomId: string) {
  try {
    const response = await fetch(`${API_URL}/getRoomName/${roomId}`, {
      credentials: 'include',
    });
    return await response.json();
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Error fetching room name'
    };
  }
}

export async function listPastInterviews() {
  try {
    const response = await fetch(`${API_URL}/pastInterviews`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    return await response.json();
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Error fetching past interviews'
    };
  }
}

export async function endInterview(roomId: string, userId: string) {
  try {
    const response = await fetch(`${API_URL}/endInterview/${roomId}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    return await response.json();
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Error ending interview'
    };
  }
}

export async function getInterviewContent(interviewId: string) {
  try {
    const response = await fetch(`${API_URL}/past/${interviewId}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    return await response.json();
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Error fetching interview content'
    };
  }
}
