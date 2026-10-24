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

// Helper to parse "3:42" or "1:04:15" into seconds
function parseDurationTextToSec(text?: string): number | undefined {
  if (!text) return undefined;
  const parts = text
    .trim()
    .split(':')
    .map((p) => parseInt(p, 10));
  if (parts.some((n) => Number.isNaN(n))) return undefined;
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return undefined;
}

// In-memory cache for stream search results to prevent duplicate network calls
const streamSearchCache = new Map<
  string,
  {
    timestamp: number;
    results: Array<{
      videoId: string;
      title: string;
      channelTitle: string;
      thumbnailUrl: string;
      durationSec?: number;
    }>;
  }
>();

// Helper to search live music streams server-side using the direct JSON API (avoids consent redirect loops)
async function searchYouTubeVideosServerSide(query: string) {
  const normalizedKey = query.trim().toLowerCase();
  const cached = streamSearchCache.get(normalizedKey);
  if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) {
    return cached.results;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5500);

    const response = await fetch(
      'https://www.youtube.com/youtubei/v1/search?prettyPrint=false',
      {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
          Cookie: 'SOCS=CAI; CONSENT=YES+cb.20240101-17-p0.en+FX+999',
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: 'WEB',
              clientVersion: '2.20240313.05.00',
              hl: 'en',
              gl: 'US',
            },
          },
          query,
          params: 'EgIQAQ%3D%3D', // Filter: Videos only
        }),
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const contents =
      data?.contents?.twoColumnSearchResultsRenderer?.primaryContents
        ?.sectionListRenderer?.contents || [];

    const results: Array<{
      videoId: string;
      title: string;
      channelTitle: string;
      thumbnailUrl: string;
      durationSec?: number;
    }> = [];

    for (const section of contents) {
      const items = section?.itemSectionRenderer?.contents || [];
      for (const item of items) {
        const v = item?.videoRenderer;
        if (v && v.videoId) {
          const title =
            v.title?.runs?.map((r: { text: string }) => r.text).join('') ||
            'AuraTune Track';
          const channelTitle =
            v.ownerText?.runs?.[0]?.text ||
            v.longBylineText?.runs?.[0]?.text ||
            'AuraTune Artist';
          const thumbs = v.thumbnail?.thumbnails || [];
          const thumbnailUrl =
            thumbs[thumbs.length - 1]?.url ||
            `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`;
          const durationSec = parseDurationTextToSec(
            v.lengthText?.simpleText ||
              v.lengthText?.runs?.[0]?.text
          );

          results.push({
            videoId: v.videoId,
            title,
            channelTitle: channelTitle.replace(' - Topic', ''),
            thumbnailUrl,
            durationSec,
          });
          if (results.length >= 12) break;
        }
      }
      if (results.length >= 12) break;
    }

    if (results.length > 0) {
      streamSearchCache.set(normalizedKey, {
        timestamp: Date.now(),
        results,
      });
    }

    return results;
  } catch {
    // Gracefully fall back to curated streams without noisy console errors
    return [];
  }
}

// Server-side music discovery endpoint powered by the Learning-Based Recommendation System
app.post('/api/youtube/discover', async (req, res) => {
  try {
    const {
      moodProfile,
      listeningHistory,
      activeKeepNote,
      customSearch,
      learnedSummary,
      currentTrack,
    } = req.body;

    // 1. Extract learned pattern signals (genres, artists, keywords, time-of-day)
    const recentPlayed = Array.isArray(listeningHistory)
      ? listeningHistory.slice(0, 4)
      : [];
    const recentArtists = recentPlayed
      .map((h: { artist?: string }) => h.artist)
      .filter(Boolean);
    const recentGenres = recentPlayed
      .map((h: { genre?: string }) => h.genre)
      .filter((g: string | undefined) => g && g !== 'AuraTune Stream');

    const learnedTopGenres: string[] = Array.isArray(learnedSummary?.topGenres)
      ? learnedSummary.topGenres
      : [];
    const learnedTopArtists: string[] = Array.isArray(learnedSummary?.topArtists)
      ? learnedSummary.topArtists
      : [];
    const learnedTopKeywords: string[] = Array.isArray(
      learnedSummary?.topKeywords
    )
      ? learnedSummary.topKeywords
      : [];
    const avoidedTerms: string[] = Array.isArray(
      learnedSummary?.avoidedKeywords
    )
      ? learnedSummary.avoidedKeywords.map((t: string) => t.toLowerCase())
      : [];

    const effectiveEnergy =
      learnedSummary?.totalInteractions > 2 &&
      learnedSummary?.learnedMoodVector?.energy
        ? Math.round(
            (moodProfile?.energy ?? 50) * 0.6 +
              learnedSummary.learnedMoodVector.energy * 0.4
          )
        : moodProfile?.energy ?? 50;

    const effectiveValence =
      learnedSummary?.totalInteractions > 2 &&
      learnedSummary?.learnedMoodVector?.valence
        ? Math.round(
            (moodProfile?.valence ?? 60) * 0.6 +
              learnedSummary.learnedMoodVector.valence * 0.4
          )
        : moodProfile?.valence ?? 60;

    const moodDesc =
      effectiveEnergy >= 75
        ? 'energetic electronic melodic synthwave upbeat'
        : effectiveEnergy <= 38
          ? 'ambient rain lofi chill study instrumental'
          : effectiveValence >= 75
            ? 'warm indie acoustic pop uplifting soul'
            : 'neo soul chillhop late night melodic';

    const noteHint = activeKeepNote?.title
      ? activeKeepNote.title
          .replace(/[^a-zA-Z0-9 ]/g, ' ')
          .split(' ')
          .slice(0, 3)
          .join(' ')
      : '';

    const dominantGenre =
      (currentTrack?.categoryTag &&
      currentTrack.categoryTag !== 'AuraTune Stream' &&
      currentTrack.categoryTag !== 'Search'
        ? currentTrack.categoryTag
        : '') ||
      learnedTopGenres[0] ||
      recentGenres[0] ||
      learnedSummary?.slotTopGenre ||
      'Lo-Fi Chill';

    const secondaryGenreOrArtist =
      learnedTopArtists[0] ||
      learnedTopGenres[1] ||
      recentArtists[0] ||
      learnedTopKeywords.slice(0, 2).join(' ') ||
      'chillhop neo soul';

    const primaryQuery = customSearch?.trim()
      ? `${customSearch.trim()} official audio music`
      : `${dominantGenre} ${learnedTopKeywords[0] || ''} ${moodDesc} ${noteHint} music mix`
          .replace(/\s+/g, ' ')
          .trim();

    // Build Next Suggested Songs query directly from the user's current listening song when available
    const currentArtistClean = currentTrack?.channelTitle
      ? String(currentTrack.channelTitle).replace(' - Topic', '').trim()
      : '';
    const currentTitleKeywords = currentTrack?.title
      ? String(currentTrack.title)
          .replace(/\(.*?\)|\[.*?\]/g, ' ')
          .replace(
            /\b(official|video|audio|music|full|hd|4k|lyrics|lyric|song)\b/gi,
            ' '
          )
          .replace(/[^a-zA-Z0-9 ]/g, ' ')
          .trim()
          .split(/\s+/)
          .slice(0, 4)
          .join(' ')
      : '';

    const historySeedQuery = currentTrack
      ? `${currentArtistClean} ${currentTitleKeywords} ${dominantGenre} official audio`
          .replace(/\s+/g, ' ')
          .trim()
      : learnedTopArtists.length > 0 || recentArtists.length > 0
        ? `${secondaryGenreOrArtist} ${dominantGenre} official audio`
            .replace(/\s+/g, ' ')
            .trim()
        : `${dominantGenre} acoustic chillhop official audio`;

    const [recommendedRaw, historySeedRaw] = await Promise.all([
      searchYouTubeVideosServerSide(primaryQuery),
      searchYouTubeVideosServerSide(historySeedQuery),
    ]);

    const filterAvoided = (
      items: Array<{
        videoId: string;
        title: string;
        channelTitle: string;
        thumbnailUrl: string;
      }>,
      excludeCurrentId?: string
    ) => {
      const withoutCurrent = excludeCurrentId
        ? items.filter((item) => item.videoId !== excludeCurrentId)
        : items;
      if (avoidedTerms.length === 0) return withoutCurrent;
      const filtered = withoutCurrent.filter((item) => {
        const text = `${item.title} ${item.channelTitle}`.toLowerCase();
        return !avoidedTerms.some((term) => term.length > 2 && text.includes(term));
      });
      return filtered.length >= 3 ? filtered : withoutCurrent;
    };

    const cleanRecommendedRaw = filterAvoided(recommendedRaw);
    const cleanHistoryRaw = filterAvoided(
      historySeedRaw,
      currentTrack?.videoId
    );

    const recommendedTracks =
      cleanRecommendedRaw.length > 0
        ? cleanRecommendedRaw.map((item, idx) => ({
            ...item,
            publishedAt: new Date().toISOString(),
            sourceType: customSearch ? 'search' : 'recommended',
            matchReason: customSearch
              ? `Matched search "${customSearch}"`
              : `Recommended for your ${dominantGenre} & ${
                  moodProfile?.presetName || 'Custom'
                } mood`,
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
            } & ${item.genreTag}`,
            matchScore: 96 - idx * 2,
          }));

    const likedOrHistoryTracks =
      cleanHistoryRaw.length > 0
        ? cleanHistoryRaw.slice(0, 6).map((item, idx) => ({
            ...item,
            publishedAt: new Date().toISOString(),
            sourceType: 'liked',
            matchReason: currentTrack?.title
              ? `Because you're listening to "${currentTrack.title}"`
              : learnedTopArtists[0]
                ? `Inspired by ${learnedTopArtists[0]} & ${dominantGenre}`
                : `Matched to your recent play "${
                    recentPlayed[0]?.title || dominantGenre
                  }"`,
            matchScore: Math.max(88, 99 - idx * 2),
          }))
        : CURATED_YT_MUSIC_FALLBACKS.filter(
            (item) => item.videoId !== currentTrack?.videoId
          )
            .slice(0, 4)
            .map((item, idx) => ({
              videoId: item.videoId,
              title: item.title,
              channelTitle: item.channelTitle,
              thumbnailUrl: item.thumbnailUrl,
              publishedAt: new Date().toISOString(),
              sourceType: 'liked',
              matchReason: `Next suggested for your ${item.genreTag} session`,
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

// Digital Asset Links for Trusted Web Activity (TWA) / PWABuilder APK packaging
app.get('/.well-known/assetlinks.json', (_req, res) => {
  res.json([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: 'com.auratune.music',
        sha256_cert_fingerprints: [
          '00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00',
        ],
      },
    },
  ]);
});

// Pure-Node ZIP archive builder (store mode) for downloading the Android APK Project bundle
function createZipBuffer(files: Array<{ name: string; content: string }>): Buffer {
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c;
  }
  function crc32(buf: Buffer): number {
    let crc = -1;
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ -1) >>> 0;
  }

  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBuf = Buffer.from(file.name, 'utf8');
    const dataBuf = Buffer.from(file.content, 'utf8');
    const crc = crc32(dataBuf);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(dataBuf.length, 18);
    localHeader.writeUInt32LE(dataBuf.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    const localEntry = Buffer.concat([localHeader, nameBuf, dataBuf]);
    localParts.push(localEntry);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(dataBuf.length, 20);
    centralHeader.writeUInt32LE(dataBuf.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(Buffer.concat([centralHeader, nameBuf]));
    offset += localEntry.length;
  }

  const centralDir = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDir, eocd]);
}

app.get('/api/android/apk-project.zip', (_req, res) => {
  const hostedUrl =
    process.env.APP_URL ||
    'https://ais-pre-frzgcxu5ds5tqipptgqcsd-370355383358.asia-southeast1.run.app';

  const files = [
    {
      name: 'AuraTune-Android/README_BUILD_APK.md',
      content: `# AuraTune Android APK Project

This package contains the complete native Android wrapper project for **AuraTune** (\`${hostedUrl}\`).

## Option 1: Instant Signed APK in 60 Seconds (No Android Studio Needed)
1. Open **https://www.pwabuilder.com** in your browser.
2. Paste your AuraTune URL:
   \`${hostedUrl}\`
3. Click **Start** -> **Package for stores** -> **Android** -> **Download Package**.
4. Extract the downloaded zip — it contains \`AuraTune.apk\` ready to install on your Android phone!

## Option 2: Compile APK Free on GitHub Actions
1. Create a new repository on GitHub and upload the contents of this \`AuraTune-Android\` folder.
2. Go to the **Actions** tab in your GitHub repository.
3. The included workflow (\`.github/workflows/build-apk.yml\`) will automatically build \`AuraTune-debug.apk\` and attach it as a downloadable artifact!

## Option 3: Build Locally in Android Studio
1. Open this \`AuraTune-Android\` folder in **Android Studio**.
2. Click **Build -> Build Bundle(s) / APK(s) -> Build APK(s)**.
3. Your installable APK will be generated at \`app/build/outputs/apk/debug/app-debug.apk\`.
`,
    },
    {
      name: 'AuraTune-Android/settings.gradle',
      content: `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "AuraTune"
include ':app'
`,
    },
    {
      name: 'AuraTune-Android/build.gradle',
      content: `plugins {
    id 'com.android.application' version '8.2.2' apply false
}
`,
    },
    {
      name: 'AuraTune-Android/app/build.gradle',
      content: `plugins {
    id 'com.android.application'
}

android {
    namespace 'com.auratune.music'
    compileSdk 34

    defaultConfig {
        applicationId "com.auratune.music"
        minSdk 24
        targetSdk 34
        versionCode 1
        versionName "1.0.0"
    }

    buildTypes {
        release {
            minifyEnabled false
        }
    }
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
}

dependencies {
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'androidx.webkit:webkit:1.10.0'
}
`,
    },
    {
      name: 'AuraTune-Android/app/src/main/AndroidManifest.xml',
      content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <application
        android:allowBackup="true"
        android:hardwareAccelerated="true"
        android:label="AuraTune"
        android:supportsRtl="true"
        android:usesCleartextTraffic="true"
        android:theme="@style/Theme.AppCompat.NoActionBar">
        <activity
            android:name=".MainActivity"
            android:configChanges="orientation|screenSize|keyboardHidden"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
`,
    },
    {
      name: 'AuraTune-Android/app/src/main/java/com/auratune/music/MainActivity.java',
      content: `package com.auratune.music;

import android.annotation.SuppressLint;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Window;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {
    private static final String APP_URL = "${hostedUrl}";
    private WebView webView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        window.setStatusBarColor(Color.parseColor("#090d16"));
        window.setNavigationBarColor(Color.parseColor("#090d16"));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#090d16"));
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setUserAgentString(settings.getUserAgentString().replace("; wv", ""));

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient());
        webView.loadUrl(APP_URL);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
`,
    },
    {
      name: 'AuraTune-Android/.github/workflows/build-apk.yml',
      content: `name: Build AuraTune Android APK

on:
  push:
    branches: [ "main", "master" ]
  workflow_dispatch:

jobs:
  build-apk:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'
      - name: Setup Gradle
        uses: gradle/actions/setup-gradle@v3
        with:
          gradle-version: '8.5'
      - name: Build Debug APK
        run: gradle assembleDebug
      - name: Upload AuraTune APK
        uses: actions/upload-artifact@v4
        with:
          name: AuraTune-Android-APK
          path: app/build/outputs/apk/debug/app-debug.apk
`,
    },
  ];

  const zipBuf = createZipBuffer(files);
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader(
    'Content-Disposition',
    'attachment; filename="AuraTune-Android-APK-Project.zip"'
  );
  res.send(zipBuf);
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null,
      },
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
