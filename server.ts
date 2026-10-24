import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '2mb' }));

const PORT = 3000;

function getAiClient() {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Curated fallback YouTube Music streams (100% embeddable official music streams/videos)
const CURATED_YT_MUSIC_FALLBACKS = [
  {
    videoId: 'jfKfPfyJRdk',
    title: 'lofi hip hop radio — beats to relax/study to',
    channelTitle: 'Lofi Girl',
    thumbnailUrl: 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg',
    genreTag: 'Lo-Fi Chillhop',
  },
  {
    videoId: '4xDzrJKXOOY',
    title: 'synthwave radio — chill synth / retro beats',
    channelTitle: 'Lofi Girl Synthwave',
    thumbnailUrl: 'https://i.ytimg.com/vi/4xDzrJKXOOY/hqdefault.jpg',
    genreTag: 'Synthwave',
  },
  {
    videoId: '5yx6BWlEVcY',
    title: 'Chillhop Radio — jazzy & lofi hip hop beats',
    channelTitle: 'Chillhop Music',
    thumbnailUrl: 'https://i.ytimg.com/vi/5yx6BWlEVcY/hqdefault.jpg',
    genreTag: 'Neo-Soul Jazz',
  },
  {
    videoId: 'DWcJFNfaw9c',
    title: 'Ambient Sleeping Pill — Deep Focus & Ambient Electronic',
    channelTitle: 'Lofi Girl Ambient',
    thumbnailUrl: 'https://i.ytimg.com/vi/DWcJFNfaw9c/hqdefault.jpg',
    genreTag: 'Organic Ambient',
  },
  {
    videoId: 'n61ULEU7CO0',
    title: 'Best of Lofi Hip Hop — Coding & Late Night Beats',
    channelTitle: 'Lofi Girl',
    thumbnailUrl: 'https://i.ytimg.com/vi/n61ULEU7CO0/hqdefault.jpg',
    genreTag: 'Deep Focus',
  },
  {
    videoId: 'lTRiuFIWV54',
    title: '1 A.M Study Session — Melodic Chill Beats',
    channelTitle: 'Lofi Girl',
    thumbnailUrl: 'https://i.ytimg.com/vi/lTRiuFIWV54/hqdefault.jpg',
    genreTag: 'Late Night',
  },
];

// Helper to search live YouTube Music videos server-side without requiring restricted client OAuth scopes
async function searchYouTubeVideosServerSide(query: string) {
  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
      query
    )}&sp=EgIQAQ%253D%253D`;
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      return [];
    }

    const html = await response.text();
    const match = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
    if (!match || !match[1]) {
      return [];
    }

    const data = JSON.parse(match[1]);
    const contents =
      data?.contents?.twoColumnSearchResultsRenderer?.primaryContents
        ?.sectionListRenderer?.contents || [];

    const results: Array<{
      videoId: string;
      title: string;
      channelTitle: string;
      thumbnailUrl: string;
    }> = [];

    for (const section of contents) {
      const items = section?.itemSectionRenderer?.contents || [];
      for (const item of items) {
        const v = item?.videoRenderer;
        if (v && v.videoId) {
          const title =
            v.title?.runs?.map((r: { text: string }) => r.text).join('') ||
            'YouTube Music Track';
          const channelTitle =
            v.ownerText?.runs?.[0]?.text ||
            v.longBylineText?.runs?.[0]?.text ||
            'YouTube Music Artist';
          const thumbs = v.thumbnail?.thumbnails || [];
          const thumbnailUrl =
            thumbs[thumbs.length - 1]?.url ||
            `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`;

          results.push({
            videoId: v.videoId,
            title,
            channelTitle: channelTitle.replace(' - Topic', ''),
            thumbnailUrl,
          });
          if (results.length >= 9) break;
        }
      }
      if (results.length >= 9) break;
    }

    return results;
  } catch (err) {
    console.error('Server-side YouTube search fallback triggered:', err);
    return [];
  }
}

// Server-side YouTube Music discovery endpoint based on user listening history & mood
app.post('/api/youtube/discover', async (req, res) => {
  try {
    const { moodProfile, listeningHistory, activeKeepNote, customSearch } =
      req.body;

    // 1. Build personalized query from user's listening history & mood
    const recentPlayed = Array.isArray(listeningHistory)
      ? listeningHistory.slice(0, 4)
      : [];
    const recentArtists = recentPlayed
      .map((h: { artist?: string }) => h.artist)
      .filter(Boolean);
    const recentGenres = recentPlayed
      .map((h: { genre?: string }) => h.genre)
      .filter((g: string | undefined) => g && g !== 'YouTube Music');

    const moodDesc =
      (moodProfile?.energy ?? 50) >= 75
        ? 'energetic electronic melodic techno synthwave'
        : (moodProfile?.energy ?? 50) <= 38
          ? 'ambient rain lofi chill study instrumental'
          : (moodProfile?.valence ?? 60) >= 75
            ? 'warm indie dream pop uplifting soul'
            : 'neo soul chillhop late night jazz';

    const noteHint = activeKeepNote?.title
      ? activeKeepNote.title
          .replace(/[^a-zA-Z0-9 ]/g, ' ')
          .split(' ')
          .slice(0, 3)
          .join(' ')
      : '';

    const primaryQuery = customSearch?.trim()
      ? `${customSearch.trim()} official audio music`
      : `${recentGenres[0] || 'Lo-Fi Neo Soul'} ${moodDesc} ${noteHint} music mix`.trim();

    const historySeedQuery =
      recentArtists.length > 0
        ? `${recentGenres[0] || 'chillhop'} ${recentPlayed[0]?.title || ''} official audio`.trim()
        : 'chillhop neo soul jazz official audio';

    const [recommendedRaw, historySeedRaw] = await Promise.all([
      searchYouTubeVideosServerSide(primaryQuery),
      searchYouTubeVideosServerSide(historySeedQuery),
    ]);

    const recommendedTracks =
      recommendedRaw.length > 0
        ? recommendedRaw.map((item, idx) => ({
            ...item,
            publishedAt: new Date().toISOString(),
            sourceType: customSearch ? 'search' : 'recommended',
            matchReason: customSearch
              ? `Matched YouTube Music search "${customSearch}"`
              : `Recommended from your ${
                  recentGenres[0] || 'recent'
                } listening & ${moodProfile?.presetName || 'Custom'} mood (${
                  moodProfile?.energy ?? 50
                }% Energy)`,
            matchScore: Math.max(85, 98 - idx * 2),
          }))
        : CURATED_YT_MUSIC_FALLBACKS.map((item, idx) => ({
            videoId: item.videoId,
            title: item.title,
            channelTitle: item.channelTitle,
            thumbnailUrl: item.thumbnailUrl,
            publishedAt: new Date().toISOString(),
            sourceType: 'recommended',
            matchReason: `Curated for ${
              moodProfile?.presetName || 'your mood'
            } & ${item.genreTag} affinity`,
            matchScore: 96 - idx * 2,
          }));

    const likedOrHistoryTracks =
      historySeedRaw.length > 0
        ? historySeedRaw.slice(0, 6).map((item, idx) => ({
            ...item,
            publishedAt: new Date().toISOString(),
            sourceType: 'liked',
            matchReason: `Matched to your recent play "${
              recentPlayed[0]?.title || 'Midnight Velvet'
            }"`,
            matchScore: Math.max(88, 99 - idx * 2),
          }))
        : CURATED_YT_MUSIC_FALLBACKS.slice(0, 4).map((item, idx) => ({
            videoId: item.videoId,
            title: item.title,
            channelTitle: item.channelTitle,
            thumbnailUrl: item.thumbnailUrl,
            publishedAt: new Date().toISOString(),
            sourceType: 'liked',
            matchReason: `Synced for your ${item.genreTag} listening profile`,
            matchScore: 97 - idx * 2,
          }));

    return res.json({
      recommendedTracks,
      likedTracks: likedOrHistoryTracks,
      queryUsed: primaryQuery,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: errMsg });
  }
});

// Server-side Personalized Music Recommendation Engine using Gemini API
app.post('/api/recommendations', async (req, res) => {
  try {
    const { moodProfile, listeningHistory, activeKeepNote, catalog } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({
        error: 'GEMINI_API_KEY is not configured on the server.',
      });
    }

    const ai = getAiClient();

    const prompt = `You are an expert musicologist and personal streaming curator for AuraTune.
Analyze the user's current mood preferences, recent listening history, and optional Google Keep mood note to curate a deeply personalized set of 6 track recommendations from the provided catalog.

User Current Mood Profile (0-100 scale):
- Energy: ${moodProfile?.energy ?? 55}
- Valence (Emotional Positivity/Warmth): ${moodProfile?.valence ?? 60}
- Focus / Acousticness: ${moodProfile?.focus ?? 70}
- Preferred Tempo (BPM): ${moodProfile?.tempo ?? 102}
- Selected Mood Preset: ${moodProfile?.presetName ?? 'Custom Balance'}

Recent Listening History (Most recent first):
${
  Array.isArray(listeningHistory) && listeningHistory.length > 0
    ? listeningHistory
        .slice(0, 8)
        .map(
          (item: {
            title: string;
            artist: string;
            genre: string;
            listenedAt: string;
            moodTag: string;
          }) =>
            `- "${item.title}" by ${item.artist} (${item.genre}, Mood: ${item.moodTag})`
        )
        .join('\n')
    : '- Fresh session (no prior tracks played yet)'
}

Active Google Keep Mood / Reflection Note:
${
  activeKeepNote
    ? `Title: "${activeKeepNote.title}"\nContent: "${activeKeepNote.body}"`
    : 'None selected'
}

Available Catalog Tracks:
${(catalog || [])
  .map(
    (t: {
      id: string;
      title: string;
      artist: string;
      genre: string;
      bpm: number;
      key: string;
      energy: number;
      valence: number;
      focus: number;
      moodTags: string[];
    }) =>
      `ID: ${t.id} | "${t.title}" by ${t.artist} | Genre: ${t.genre} | ${t.bpm} BPM | Key: ${t.key} | Energy:${t.energy} Valence:${t.valence} Focus:${t.focus} | Tags: ${t.moodTags?.join(', ')}`
  )
  .join('\n')}

Return a JSON object containing:
1. "mixTitle": A poetic, evocative 2-5 word title for this custom recommendation mix.
2. "mixSummary": A concise 1-2 sentence explanation of how their listening history, mood sliders, and Keep note shaped this sonic direction.
3. "recommendations": An array of 6 items, each with:
   - "trackId": Exact ID from the catalog
   - "matchScore": Integer from 82 to 99 representing sonic & mood alignment
   - "reason": Specific 1-sentence musical rationale referencing their history, mood vector, or Keep note.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            mixTitle: {
              type: Type.STRING,
              description: 'Evocative title for the personalized mix.',
            },
            mixSummary: {
              type: Type.STRING,
              description:
                'Concise explanation of how history, mood, and Keep notes shaped the mix.',
            },
            recommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  trackId: { type: Type.STRING },
                  matchScore: { type: Type.INTEGER },
                  reason: { type: Type.STRING },
                },
                required: ['trackId', 'matchScore', 'reason'],
              },
            },
          },
          required: ['mixTitle', 'mixSummary', 'recommendations'],
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('Empty response from recommendation model');
    }

    const parsed = JSON.parse(text.trim());
    return res.json(parsed);
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Gemini recommendation error:', errMsg);
    return res.status(500).json({
      error: errMsg || 'Failed to generate AI recommendations',
    });
  }
});

// Google Keep API Proxy Routes
app.get('/api/keep/notes', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing Authorization Bearer token' });
  }

  try {
    const response = await fetch(
      'https://keep.googleapis.com/v1/notes?pageSize=25',
      {
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
      }
    );
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: errMsg });
  }
});

app.post('/api/keep/notes', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing Authorization Bearer token' });
  }

  try {
    const { title, bodyText } = req.body;
    const payload = {
      title: title || 'AuraTune Mood & Track Note',
      body: {
        text: {
          text: bodyText || '',
        },
      },
    };

    const response = await fetch('https://keep.googleapis.com/v1/notes', {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: errMsg });
  }
});

app.delete('/api/keep/notes/:noteId', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing Authorization Bearer token' });
  }

  try {
    const noteId = req.params.noteId;
    const response = await fetch(
      `https://keep.googleapis.com/v1/notes/${encodeURIComponent(noteId)}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: authHeader,
        },
      }
    );
    if (response.status === 200 || response.status === 204) {
      return res.json({ success: true });
    }
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: errMsg });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AuraTune server listening on http://localhost:${PORT}`);
  });
}

startServer();
