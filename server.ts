import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, ThinkingLevel, Modality } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '50mb' }));

function getAI() {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });
}

// 1. Multi-Turn Chat & Thinking / Fast Intelligence
app.post('/api/gemini/chat', async (req, res) => {
  try {
    const ai = getAI();
    const {
      history = [],
      message = '',
      mode = 'argon_thinking',
      rolePersona = 'You are the Grand Immortal Strategist and Royal Tactician of Voxel Realms XR. Give concise, actionable advice on Castle Warfare (T1-T20 counter matrix), Four-Path Cultivation (Qi, Body, Soul, Mind across 23 Realms, 100x Realm Suppression, Karma & Tribulation Lightning), and Protein/Bioscience structure discoveries.',
    } = req.body;

    const modelUsed =
      mode === 'argon_thinking'
        ? 'gemini-4-argon'
        : mode === 'flash_lite_fast'
          ? 'gemini-3.1-flash-lite'
          : 'gemini-3.8-flash';

    const contents = [
      ...history.map((m: { role: string; text: string }) => ({
        role: m.role === 'model' ? 'model' : 'user',
        parts: [{ text: m.text }],
      })),
      ...(message ? [{ role: 'user', parts: [{ text: message }] }] : []),
    ];

    const config: Record<string, unknown> = {
      systemInstruction: rolePersona,
    };

    if (mode === 'argon_thinking') {
      config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
    }

    const response = await ai.models.generateContent({
      model: modelUsed,
      contents,
      config,
    });

    res.json({ text: response.text || '', modelUsed });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// 2. Google Search Grounding (gemini-3.8-flash)
app.post('/api/gemini/search', async (req, res) => {
  try {
    const ai = getAI();
    const { prompt, query } = req.body;
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt || query || 'Latest WebXR and AlphaFold discoveries',
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = chunks
      .map((chunk: any) => ({
        title: chunk.web?.title || 'Web Source',
        uri: chunk.web?.uri || '',
      }))
      .filter((s: { uri: string }) => Boolean(s.uri));

    res.json({
      text: response.text || '',
      sources,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// 3. Google Maps Grounding (gemini-3.8-flash)
app.post('/api/gemini/maps', async (req, res) => {
  try {
    const ai = getAI();
    const { prompt, query, latitude = 37.78193, longitude = -122.40476 } = req.body;
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt || query || 'Historic castles and landmarks nearby',
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: {
              latitude: Number(latitude),
              longitude: Number(longitude),
            },
          },
        },
      },
    });

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const places = chunks
      .map((chunk: any) => ({
        title: chunk.maps?.title || chunk.web?.title || 'Map Location',
        uri: chunk.maps?.uri || chunk.web?.uri || '',
      }))
      .filter((p: { uri: string }) => Boolean(p.uri));

    res.json({
      text: response.text || '',
      places,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// 4. Image Generation & Editing (gemini-nano-banana-2.1 & gemini-3-pro-image)
app.post('/api/gemini/image', async (req, res) => {
  try {
    const ai = getAI();
    const {
      prompt,
      model = 'gemini-nano-banana-2.1',
      aspectRatio = '1:1',
      imageSize = '1K',
      base64Image,
      mimeType = 'image/png',
    } = req.body;

    const parts: any[] = [];
    if (base64Image) {
      const stripped = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
      parts.push({
        inlineData: {
          data: stripped,
          mimeType,
        },
      });
    }
    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio,
          imageSize,
        },
      },
    });

    let imageUrl = '';
    let text = '';
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        imageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
      } else if (part.text) {
        text += part.text;
      }
    }

    if (!imageUrl) {
      throw new Error('No image returned by model.');
    }

    res.json({ imageUrl, text });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// 5. Image & Video Understanding (gemini-4-argon)
app.post('/api/gemini/analyze-media', async (req, res) => {
  try {
    const ai = getAI();
    const { prompt = 'Analyze this media in detail.', base64Data, mimeType = 'image/png' } = req.body;
    const stripped = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;

    const response = await ai.models.generateContent({
      model: 'gemini-4-argon',
      contents: {
        parts: [
          {
            inlineData: {
              data: stripped,
              mimeType,
            },
          },
          { text: prompt },
        ],
      },
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
      },
    });

    res.json({ text: response.text || '' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// 6. Video Generation & Image-to-Video (gemini-omni-1.1-flash via Interactions API)
app.post('/api/gemini/video', async (req, res) => {
  try {
    const ai = getAI();
    const {
      prompt,
      aspectRatio = '16:9',
      duration = 4,
      resolution = '720p',
      base64Image,
      mimeType = 'image/png',
    } = req.body;

    let input: any = prompt;
    if (base64Image) {
      const stripped = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
      input = [
        { type: 'text', text: prompt },
        { type: 'image', data: stripped, mime_type: mimeType },
      ];
    }

    const interaction = await (ai as any).interactions.create({
      model: 'gemini-omni-1.1-flash',
      input,
      response_format: {
        type: 'video',
        aspect_ratio: aspectRatio,
        duration,
        resolution,
      },
    });

    let videoDataUrl = '';
    for (const output of interaction.outputs || []) {
      if (output.type === 'video' && output.data) {
        videoDataUrl = `data:${output.mime_type || 'video/mp4'};base64,${output.data}`;
        break;
      }
    }

    if (!videoDataUrl) {
      throw new Error('No video output returned from gemini-omni-1.1-flash.');
    }

    res.json({ videoDataUrl });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// 7. Text-to-Speech (gemini-3.8-flash-tts)
app.post('/api/gemini/tts', async (req, res) => {
  try {
    const ai = getAI();
    const { text, voiceName = 'Kore', stylePrompt } = req.body;
    const finalPrompt = stylePrompt ? `${stylePrompt}: ${text}` : text;
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-tts',
      contents: [{ parts: [{ text: finalPrompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const inlineData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (!inlineData?.data) {
      throw new Error('No audio generated by TTS.');
    }

    res.json({
      audioDataUrl: `data:${inlineData.mimeType || 'audio/wav'};base64,${inlineData.data}`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// 8. Audio Transcription (gemini-3.5-transcribe)
app.post('/api/gemini/transcribe', async (req, res) => {
  try {
    const ai = getAI();
    const { base64Audio, mimeType = 'audio/webm' } = req.body;
    const stripped = base64Audio.includes(',') ? base64Audio.split(',')[1] : base64Audio;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-transcribe',
      contents: [
        {
          inlineData: {
            mimeType,
            data: stripped,
          },
        },
        'Transcribe the spoken audio accurately.',
      ],
    });

    res.json({ transcript: response.text || '' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// 9. Music Generation (lyria-3-clip-preview & lyria-3-pro-preview)
app.post('/api/gemini/music', async (req, res) => {
  try {
    const ai = getAI();
    const { prompt, model = 'lyria-3-clip-preview' } = req.body;
    const responseStream = await ai.models.generateContentStream({
      model,
      contents: prompt,
      config: {
        responseModalities: ['AUDIO', 'TEXT'],
      },
    });

    const audioChunks: Buffer[] = [];
    let audioMimeType = 'audio/mpeg';
    let lyrics = '';

    for await (const chunk of responseStream) {
      const parts = chunk.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        if (part.inlineData?.data) {
          if (part.inlineData.mimeType) {
            audioMimeType = part.inlineData.mimeType;
          }
          audioChunks.push(Buffer.from(part.inlineData.data, 'base64'));
        } else if (part.text) {
          lyrics += part.text;
        }
      }
    }

    if (audioChunks.length === 0) {
      throw new Error('No audio stream returned by Lyria.');
    }

    const combinedBase64 = Buffer.concat(audioChunks).toString('base64');
    res.json({
      audioDataUrl: `data:${audioMimeType};base64,${combinedBase64}`,
      lyrics,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

async function startServer() {
  const server = http.createServer(app);

  // 10. Real-Time Live Voice WebSocket Proxy (gemini-3.8-live)
  const wss = new WebSocketServer({ server, path: '/live' });

  wss.on('connection', async (ws: WebSocket) => {
    const ai = getAI();
    let session: any = null;

    try {
      session = await ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction:
            'You are the Immortal Voice Spirit of Voxel Realms XR. Respond concisely and vividly to the Lord Commander.',
        },
        callbacks: {
          onmessage: (message: any) => {
            if (ws.readyState !== WebSocket.OPEN) return;
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              ws.send(JSON.stringify({ type: 'audio', data: base64Audio }));
            }
            const outText = message.serverContent?.outputTranscription?.text;
            if (outText) {
              ws.send(JSON.stringify({ type: 'transcript', speaker: 'Spirit', text: outText }));
            }
            const inText = message.serverContent?.inputTranscription?.text;
            if (inText) {
              ws.send(JSON.stringify({ type: 'transcript', speaker: 'You', text: inText }));
            }
            if (message.serverContent?.interrupted) {
              ws.send(JSON.stringify({ type: 'interrupted' }));
            }
          },
          onerror: (err: any) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'error', message: err?.message || 'Live API error' }));
            }
          },
        },
      });
    } catch (err: unknown) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'error',
            message: err instanceof Error ? err.message : 'Failed to connect to gemini-3.8-live',
          })
        );
      }
      ws.close();
      return;
    }

    ws.on('message', (raw) => {
      if (!session) return;
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'audio' && msg.data) {
          session.sendRealtimeInput({
            audio: { data: msg.data, mimeType: 'audio/pcm;rate=16000' },
          });
        } else if (msg.type === 'text' && msg.text) {
          session.sendClientContent({
            turns: [{ role: 'user', parts: [{ text: msg.text }] }],
            turnComplete: true,
          });
        }
      } catch (e) {
        console.error('Error forwarding WS message to Gemini Live:', e);
      }
    });

    ws.on('close', () => {
      try {
        session?.close?.();
      } catch {
        // ignore
      }
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Voxel Realms XR Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
