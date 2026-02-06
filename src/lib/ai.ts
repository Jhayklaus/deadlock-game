const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

export async function generateAIResponse(prompt: string): Promise<string> {
  try {
    const response = await fetch(`${SERVER_URL}/api/bot-action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    const data = await response.json();
    return data.text.trim();
  } catch (error) {
    console.error('Error generating AI response:', error);
    return '';
  }
}
