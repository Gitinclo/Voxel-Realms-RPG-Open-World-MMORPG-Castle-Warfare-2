/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ChatTurnMessage {
  role: 'user' | 'model';
  text: string;
}

export async function sendGeminiChatMessage(params: {
  history: ChatTurnMessage[];
  message: string;
  mode: 'argon_thinking' | 'flash_standard' | 'flash_lite_fast';
  rolePersona?: string;
}): Promise<{ text: string; modelUsed: string }> {
  const res = await fetch('/api/gemini/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Chat request failed');
  return data;
}

export async function queryGeminiSearchGrounding(prompt: string): Promise<{
  text: string;
  sources: Array<{ title: string; uri: string }>;
}> {
  const res = await fetch('/api/gemini/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Search grounding failed');
  return data;
}

export async function queryGeminiMapsGrounding(
  prompt: string,
  latitude = 37.78193,
  longitude = -122.40476,
): Promise<{
  text: string;
  places: Array<{ title: string; uri: string }>;
}> {
  const res = await fetch('/api/gemini/maps', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, latitude, longitude }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Maps grounding failed');
  return data;
}

export async function generateOrEditGeminiImage(params: {
  prompt: string;
  model: 'gemini-nano-banana-2.1' | 'gemini-3-pro-image';
  aspectRatio: '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '9:16' | '16:9' | '21:9';
  imageSize: '1K' | '2K' | '4K';
  base64Image?: string;
  mimeType?: string;
}): Promise<{ imageUrl: string; text: string }> {
  const res = await fetch('/api/gemini/image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Image generation failed');
  return data;
}

export async function analyzeMediaWithArgon(params: {
  prompt: string;
  base64Data: string;
  mimeType: string;
}): Promise<{ text: string }> {
  const res = await fetch('/api/gemini/analyze-media', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Media analysis failed');
  return data;
}

export async function generateOmniFlashVideo(params: {
  prompt: string;
  aspectRatio: '16:9' | '9:16';
  base64Image?: string;
  mimeType?: string;
}): Promise<{ videoDataUrl: string }> {
  const res = await fetch('/api/gemini/video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Video generation failed');
  return data;
}

export async function synthesizeGeminiSpeech(params: {
  text: string;
  voiceName?: 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';
  stylePrompt?: string;
}): Promise<{ audioDataUrl: string }> {
  const res = await fetch('/api/gemini/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'TTS failed');
  return data;
}

export async function transcribeAudioWithGemini(params: {
  base64Audio: string;
  mimeType: string;
}): Promise<{ transcript: string }> {
  const res = await fetch('/api/gemini/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Audio transcription failed');
  return data;
}

export async function generateLyriaMusic(params: {
  prompt: string;
  model: 'lyria-3-clip-preview' | 'lyria-3-pro-preview';
}): Promise<{ audioDataUrl: string; lyrics: string }> {
  const res = await fetch('/api/gemini/music', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Music generation failed');
  return data;
}
