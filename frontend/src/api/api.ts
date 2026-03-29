const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:7778';

export async function createRoom(userId: string, name: string, roomName: string, language: string, initialCode?: string) {
  try {
    const response = await fetch(`${API_URL}/createRoom`, {
      method: 'POST',
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

export async function getRoomName(roomId: string) {
  try {
    const response = await fetch(`${API_URL}/getRoomName/${roomId}`);
    return await response.json();
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Error fetching room name'
    };
  }
}

export async function validateApiKey(apiKey: string) {
  try {
    const response = await fetch(`${API_URL}/validateKey`, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      }
    });
    return await response.json();
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Error validating key'
    };
  }
}

export async function getInterviewContent(interviewId: string, apiKey: string) {
  try {
    const response = await fetch(`${API_URL}/past/${interviewId}`, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      }
    });
    return await response.json();
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Error fetching interview content'
    };
  }
}
