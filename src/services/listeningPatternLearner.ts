import {
  LearnedListeningProfile,
  ListeningSignalType,
  MoodProfile,
  TimeOfDaySlot,
  YouTubeMusicTrack,
  LearnedFeatureWeight,
} from '../types/music';

const STORAGE_KEY_LEARNED_MODEL = 'auratune_learned_listening_profile_v1';

const STOP_WORDS = new Set([
  'official',
  'video',
  'audio',
  'music',
  'song',
  'songs',
  'full',
  'hd',
  '4k',
  'lyrics',
  'lyric',
  'the',
  'and',
  'for',
  'with',
  'from',
  'feat',
  'ft',
  'new',
  'best',
  'top',
  'mix',
  'radio',
  'stream',
  'auratune',
  'personalized',
  'curated',
]);

const KNOWN_GENRE_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: 'Bengali', regex: /\b(bengali|bangla|rabindra|kolkata|anupam|arijit.*bangla|fossils|arnob)\b/i },
  { label: 'Hindi', regex: /\b(hindi|bollywood|arijit|pritam|shreya|jubin|atif|vishal|ar rahman|ap dhillon)\b/i },
  { label: 'Pop', regex: /\b(pop|synthpop|dream pop|indie pop|billie|weeknd|dua lipa|taylor)\b/i },
  { label: 'Hip-Hop', regex: /\b(hip hop|hip-hop|rap|trap|drill|beats|divine|seedhe maut|raftaar|kendrick|drake)\b/i },
  { label: 'EDM', regex: /\b(edm|electronic|house|techno|trance|dubstep|progressive|martin garrix|fred again)\b/i },
  { label: 'Lo-Fi Chill', regex: /\b(lofi|lo-fi|chillhop|study beats|chill beats|lofi girl|sleep|relax)\b/i },
  { label: 'Synthwave', regex: /\b(synthwave|retrowave|vaporwave|cyberpunk|outrun|chill synth)\b/i },
  { label: 'Acoustic & Indie', regex: /\b(acoustic|unplugged|indie|folk|guitar|stripped|prateek kuhad|anuv jain)\b/i },
  { label: 'Jazz & Neo-Soul', regex: /\b(jazz|neo soul|neo-soul|blues|saxophone|r&b|rnb|soul)\b/i },
  { label: 'Ambient & Focus', regex: /\b(ambient|deep focus|meditation|instrumental|piano|rain|soundscape)\b/i },
  { label: 'English Hits', regex: /\b(english|global hits|billboard|uk top|acoustic hits)\b/i },
];

export function getCurrentTimeOfDaySlot(date = new Date()): TimeOfDaySlot {
  const hour = date.getHours();
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'late-night';
}

export function formatTimeOfDayLabel(slot: TimeOfDaySlot): string {
  switch (slot) {
    case 'morning':
      return 'Morning (6AM–12PM)';
    case 'afternoon':
      return 'Afternoon (12PM–5PM)';
    case 'evening':
      return 'Evening (5PM–10PM)';
    case 'late-night':
      return 'Late Night (10PM–6AM)';
  }
}

export function createInitialLearnedProfile(): LearnedListeningProfile {
  return {
    version: 1,
    totalInteractions: 0,
    deepListenCount: 0,
    skipCount: 0,
    replayCount: 0,
    avgListenSeconds: 0,
    explorationRate: 0.25,
    learnedMoodVector: {
      energy: 52,
      valence: 64,
      focus: 78,
      tempo: 96,
    },
    genreWeights: {},
    artistWeights: {},
    keywordWeights: {},
    dislikedVideoIds: [],
    likedVideoIds: [],
    timeOfDayPatterns: {
      morning: {
        slot: 'morning',
        topGenre: 'Acoustic & Indie',
        avgEnergy: 55,
        avgValence: 72,
        avgFocus: 75,
        sessionCount: 0,
      },
      afternoon: {
        slot: 'afternoon',
        topGenre: 'Pop',
        avgEnergy: 68,
        avgValence: 70,
        avgFocus: 65,
        sessionCount: 0,
      },
      evening: {
        slot: 'evening',
        topGenre: 'Hindi',
        avgEnergy: 64,
        avgValence: 68,
        avgFocus: 60,
        sessionCount: 0,
      },
      'late-night': {
        slot: 'late-night',
        topGenre: 'Lo-Fi Chill',
        avgEnergy: 38,
        avgValence: 58,
        avgFocus: 86,
        sessionCount: 0,
      },
    },
    recentSignals: [],
  };
}

export function loadLearnedProfile(): LearnedListeningProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LEARNED_MODEL);
    if (!raw) return createInitialLearnedProfile();
    const parsed = JSON.parse(raw);
    return {
      ...createInitialLearnedProfile(),
      ...parsed,
    };
  } catch {
    return createInitialLearnedProfile();
  }
}

export function saveLearnedProfile(profile: LearnedListeningProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY_LEARNED_MODEL, JSON.stringify(profile));
  } catch {
    // ignore storage quota errors
  }
}

export function inferGenreAndKeywords(
  title: string,
  artist: string,
  explicitCategory?: string
): { inferredGenre: string; keywords: string[] } {
  const combined = `${title} ${artist} ${explicitCategory || ''}`;

  let inferredGenre =
    explicitCategory &&
    explicitCategory !== 'AuraTune Stream' &&
    explicitCategory !== 'Search' &&
    explicitCategory !== 'Featured Track'
      ? explicitCategory
      : '';

  if (!inferredGenre) {
    for (const pattern of KNOWN_GENRE_PATTERNS) {
      if (pattern.regex.test(combined)) {
        inferredGenre = pattern.label;
        break;
      }
    }
  }

  if (!inferredGenre) {
    inferredGenre = 'Lo-Fi Chill';
  }

  const rawTokens = `${title} ${artist}`
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((tok) => tok.length >= 3 && !STOP_WORDS.has(tok) && !/^\d+$/.test(tok));

  const uniqueKeywords = Array.from(new Set(rawTokens)).slice(0, 6);
  return { inferredGenre, keywords: uniqueKeywords };
}

const SIGNAL_WEIGHT_DELTAS: Record<ListeningSignalType, number> = {
  play_start: 0.8,
  deep_listen: 2.4,
  early_skip: -1.8,
  replay: 2.8,
  save_library: 3.2,
  add_playlist: 2.6,
  search_intent: 1.5,
  explicit_like: 3.5,
  explicit_dislike: -4.0,
};

function updateFeatureMap(
  map: Record<string, LearnedFeatureWeight>,
  key: string,
  delta: number,
  nowIso: string
): Record<string, LearnedFeatureWeight> {
  if (!key || !key.trim()) return map;
  const cleanKey = key.trim();
  const next = { ...map };

  // Apply gentle recency decay (0.985) so evolving tastes adapt naturally
  for (const k of Object.keys(next)) {
    next[k] = {
      ...next[k],
      score: Number((next[k].score * 0.985).toFixed(3)),
    };
  }

  const existing = next[cleanKey];
  const prevScore = existing ? existing.score : 0;
  const newScore = Math.max(-12, Math.min(35, Number((prevScore + delta).toFixed(2))));

  next[cleanKey] = {
    name: cleanKey,
    score: newScore,
    interactions: (existing?.interactions || 0) + 1,
    lastUpdated: nowIso,
  };

  return next;
}

export function recordListeningSignal(
  prev: LearnedListeningProfile,
  params: {
    type: ListeningSignalType;
    track?: YouTubeMusicTrack;
    customGenre?: string;
    customQuery?: string;
    listenedSeconds?: number;
    mood?: MoodProfile;
  }
): LearnedListeningProfile {
  const nowIso = new Date().toISOString();
  const delta = SIGNAL_WEIGHT_DELTAS[params.type];

  const title = params.track?.title || params.customQuery || 'Stream';
  const artist = (params.track?.channelTitle || 'Artist').replace(' - Topic', '').trim();
  const { inferredGenre, keywords } = inferGenreAndKeywords(
    title,
    artist,
    params.customGenre || params.track?.categoryTag
  );

  let genreWeights = updateFeatureMap(prev.genreWeights, inferredGenre, delta, nowIso);
  let artistWeights = prev.artistWeights;
  if (params.track?.channelTitle) {
    artistWeights = updateFeatureMap(prev.artistWeights, artist, delta * 0.9, nowIso);
  }

  let keywordWeights = { ...prev.keywordWeights };
  for (const kw of keywords) {
    keywordWeights = updateFeatureMap(keywordWeights, kw, delta * 0.55, nowIso);
  }

  // Update liked / disliked video IDs
  let dislikedVideoIds = [...prev.dislikedVideoIds];
  let likedVideoIds = [...prev.likedVideoIds];
  const vid = params.track?.videoId;
  if (vid) {
    if (params.type === 'explicit_dislike' || params.type === 'early_skip') {
      if (params.type === 'explicit_dislike' && !dislikedVideoIds.includes(vid)) {
        dislikedVideoIds = [vid, ...dislikedVideoIds].slice(0, 50);
      }
      likedVideoIds = likedVideoIds.filter((id) => id !== vid);
    } else if (
      params.type === 'explicit_like' ||
      params.type === 'save_library' ||
      params.type === 'deep_listen' ||
      params.type === 'replay'
    ) {
      if (!likedVideoIds.includes(vid)) {
        likedVideoIds = [vid, ...likedVideoIds].slice(0, 60);
      }
      dislikedVideoIds = dislikedVideoIds.filter((id) => id !== vid);
    }
  }

  // Update Time-of-Day Pattern
  const slot = getCurrentTimeOfDaySlot();
  const prevSlot = prev.timeOfDayPatterns[slot];
  const mood = params.mood;
  const isPositive = delta > 0;

  // Determine top genre for this time slot
  const topGenreEntry = Object.values(genreWeights).sort((a, b) => b.score - a.score)[0];
  const updatedSlotPattern = {
    ...prevSlot,
    topGenre: isPositive && topGenreEntry ? topGenreEntry.name : prevSlot.topGenre,
    avgEnergy:
      mood && isPositive
        ? Math.round(prevSlot.avgEnergy * 0.75 + mood.energy * 0.25)
        : prevSlot.avgEnergy,
    avgValence:
      mood && isPositive
        ? Math.round(prevSlot.avgValence * 0.75 + mood.valence * 0.25)
        : prevSlot.avgValence,
    avgFocus:
      mood && isPositive
        ? Math.round(prevSlot.avgFocus * 0.75 + mood.focus * 0.25)
        : prevSlot.avgFocus,
    sessionCount: prevSlot.sessionCount + 1,
  };

  // Update Exponential Moving Average of Mood Vector on positive signals
  const alpha = params.type === 'deep_listen' || params.type === 'replay' ? 0.28 : 0.15;
  const learnedMoodVector =
    mood && isPositive
      ? {
          energy: Math.round(prev.learnedMoodVector.energy * (1 - alpha) + mood.energy * alpha),
          valence: Math.round(prev.learnedMoodVector.valence * (1 - alpha) + mood.valence * alpha),
          focus: Math.round(prev.learnedMoodVector.focus * (1 - alpha) + mood.focus * alpha),
          tempo: Math.round(prev.learnedMoodVector.tempo * (1 - alpha) + mood.tempo * alpha),
        }
      : prev.learnedMoodVector;

  // Update listening duration stats
  let avgListenSeconds = prev.avgListenSeconds;
  if (typeof params.listenedSeconds === 'number' && params.listenedSeconds > 0) {
    const completedTotal = prev.deepListenCount + prev.skipCount + 1;
    avgListenSeconds = Math.round(
      (prev.avgListenSeconds * Math.max(0, completedTotal - 1) + params.listenedSeconds) /
        completedTotal
    );
  }

  const signalEntry = {
    id: `sig-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: params.type,
    trackTitle: title,
    artist,
    genre: inferredGenre,
    deltaScore: delta,
    timestamp: nowIso,
  };

  return {
    ...prev,
    totalInteractions: prev.totalInteractions + 1,
    deepListenCount:
      params.type === 'deep_listen' ? prev.deepListenCount + 1 : prev.deepListenCount,
    skipCount: params.type === 'early_skip' ? prev.skipCount + 1 : prev.skipCount,
    replayCount: params.type === 'replay' ? prev.replayCount + 1 : prev.replayCount,
    avgListenSeconds,
    learnedMoodVector,
    genreWeights,
    artistWeights,
    keywordWeights,
    dislikedVideoIds,
    likedVideoIds,
    timeOfDayPatterns: {
      ...prev.timeOfDayPatterns,
      [slot]: updatedSlotPattern,
    },
    recentSignals: [signalEntry, ...prev.recentSignals].slice(0, 25),
  };
}

export function getTopFeatures(
  map: Record<string, LearnedFeatureWeight>,
  limit = 5
): LearnedFeatureWeight[] {
  return Object.values(map)
    .filter((f) => f.score > 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function getAvoidedFeatures(
  map: Record<string, LearnedFeatureWeight>,
  limit = 4
): LearnedFeatureWeight[] {
  return Object.values(map)
    .filter((f) => f.score < -0.5)
    .sort((a, b) => a.score - b.score)
    .slice(0, limit);
}

export function getModelConfidencePercent(profile: LearnedListeningProfile): number {
  if (profile.totalInteractions === 0) return 24;
  const raw =
    24 +
    Math.min(45, profile.totalInteractions * 4.5) +
    Math.min(20, profile.deepListenCount * 3.5) +
    Math.min(10, profile.replayCount * 2.5);
  return Math.min(99, Math.round(raw));
}

export function scoreAndRankTracks(
  tracks: YouTubeMusicTrack[],
  profile: LearnedListeningProfile,
  currentMood: MoodProfile
): YouTubeMusicTrack[] {
  const slot = getCurrentTimeOfDaySlot();
  const activeSlotPattern = profile.timeOfDayPatterns[slot];
  const topGenres = getTopFeatures(profile.genreWeights, 4);
  const topArtists = getTopFeatures(profile.artistWeights, 4);

  return tracks
    .filter((t) => !profile.dislikedVideoIds.includes(t.videoId))
    .map((track, idx) => {
      const cleanArtist = track.channelTitle.replace(' - Topic', '').trim();
      const { inferredGenre, keywords } = inferGenreAndKeywords(
        track.title,
        cleanArtist,
        track.categoryTag
      );

      const genreWeight = profile.genreWeights[inferredGenre]?.score || 0;
      const artistWeight = profile.artistWeights[cleanArtist]?.score || 0;
      let keywordScore = 0;
      let matchedKeyword = '';

      for (const kw of keywords) {
        const w = profile.keywordWeights[kw]?.score || 0;
        if (w > 0) {
          keywordScore += w;
          if (!matchedKeyword || w > (profile.keywordWeights[matchedKeyword]?.score || 0)) {
            matchedKeyword = kw;
          }
        } else if (w < 0) {
          keywordScore += w * 0.8;
        }
      }

      const isLiked = profile.likedVideoIds.includes(track.videoId);
      const matchesTimeSlot = activeSlotPattern?.topGenre === inferredGenre;

      const compositeBoost =
        genreWeight * 1.9 +
        artistWeight * 2.2 +
        keywordScore * 1.1 +
        (isLiked ? 6 : 0) +
        (matchesTimeSlot ? 3.5 : 0);

      const baseScore = track.matchScore || Math.max(82, 95 - idx * 2);
      const calibratedScore = Math.max(
        68,
        Math.min(99, Math.round(baseScore + compositeBoost * 0.9))
      );

      // Build natural musical match reason without exposing internal model telemetry
      const reasons: string[] = [];
      if (artistWeight >= 1.5) {
        reasons.push(`Similar to ${cleanArtist}`);
      }
      if (genreWeight >= 1.2) {
        reasons.push(`${inferredGenre} affinity`);
      } else if (topGenres[0] && inferredGenre === topGenres[0].name) {
        reasons.push(`${inferredGenre} mix`);
      }
      if (matchesTimeSlot && activeSlotPattern.sessionCount > 0) {
        reasons.push(`${slot} vibe`);
      }
      if (matchedKeyword && (profile.keywordWeights[matchedKeyword]?.score || 0) >= 1.0) {
        reasons.push(`${matchedKeyword} style`);
      }

      const matchReason =
        reasons.length > 0
          ? `Recommended for your ${reasons.slice(0, 2).join(' · ')}`
          : track.matchReason ||
            `Matched to ${currentMood.presetName} & ${
              topArtists[0]?.name || topGenres[0]?.name || inferredGenre
            }`;

      return {
        ...track,
        categoryTag: inferredGenre,
        matchScore: calibratedScore,
        matchReason,
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore);
}

export function buildLearnedSummaryPayload(profile: LearnedListeningProfile) {
  const slot = getCurrentTimeOfDaySlot();
  const topGenres = getTopFeatures(profile.genreWeights, 3).map((g) => g.name);
  const topArtists = getTopFeatures(profile.artistWeights, 3).map((a) => a.name);
  const topKeywords = getTopFeatures(profile.keywordWeights, 5).map((k) => k.name);
  const avoidedKeywords = getAvoidedFeatures(profile.keywordWeights, 4).map((k) => k.name);
  const avoidedGenres = getAvoidedFeatures(profile.genreWeights, 2).map((g) => g.name);

  return {
    timeOfDaySlot: slot,
    slotTopGenre: profile.timeOfDayPatterns[slot]?.topGenre || 'Lo-Fi Chill',
    topGenres,
    topArtists,
    topKeywords,
    avoidedKeywords: [...avoidedGenres, ...avoidedKeywords],
    explorationRate: profile.explorationRate,
    learnedMoodVector: profile.learnedMoodVector,
    totalInteractions: profile.totalInteractions,
  };
}

export interface PlayedSongSignature {
  videoId?: string;
  title: string;
  artist: string;
  durationSec?: number;
}

export function normalizeArtistName(artist: string): string {
  return (artist || '')
    .toLowerCase()
    .replace(/\b(topic|vevo|official|music|records|channel|label)\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeSongTitle(title: string, artist?: string): string {
  let cleaned = (title || '').toLowerCase();

  // Remove parenthetical and bracketed metadata like (Official Video), [Full Song], etc.
  cleaned = cleaned.replace(/\(.*?\)|\[.*?\]|\{.*?\}/g, ' ');

  // If the artist name appears in the title (e.g. "Arijit Singh - Kesariya"), strip the artist prefix/suffix
  if (artist) {
    const normArtist = normalizeArtistName(artist);
    if (normArtist.length >= 3) {
      for (const part of normArtist.split(' ')) {
        if (part.length >= 3) {
          cleaned = cleaned.replace(new RegExp(`\\b${part}\\b`, 'g'), ' ');
        }
      }
    }
  }

  cleaned = cleaned
    .replace(
      /\b(official|video|audio|music|full|song|songs|hd|4k|hq|lyrics|lyric|visualizer|remastered|remaster|version|mv|feat|ft|prod|by|live|session|ost|soundtrack)\b/g,
      ' '
    )
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned || (title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function isSameSongSignature(
  a: PlayedSongSignature,
  b: PlayedSongSignature
): boolean {
  // 1. Exact videoId match
  if (a.videoId && b.videoId && a.videoId === b.videoId) {
    return true;
  }

  const normTitleA = normalizeSongTitle(a.title, a.artist);
  const normTitleB = normalizeSongTitle(b.title, b.artist);
  const normArtistA = normalizeArtistName(a.artist);
  const normArtistB = normalizeArtistName(b.artist);

  // 2. Exact normalized song title match
  if (normTitleA && normTitleB && normTitleA === normTitleB) {
    return true;
  }

  // 3. Substring / Core Title Containment (e.g. "kesariya" inside "kesariya brahmastra")
  if (
    normTitleA.length >= 5 &&
    normTitleB.length >= 5 &&
    (normTitleA.includes(normTitleB) || normTitleB.includes(normTitleA))
  ) {
    return true;
  }

  // 4. Token overlap check on normalized title words
  const wordsA = normTitleA.split(' ').filter((w) => w.length >= 3);
  const wordsB = normTitleB.split(' ').filter((w) => w.length >= 3);
  let titleOverlapRatio = 0;
  if (wordsA.length > 0 && wordsB.length > 0) {
    const setB = new Set(wordsB);
    const shared = wordsA.filter((w) => setB.has(w)).length;
    titleOverlapRatio = shared / Math.min(wordsA.length, wordsB.length);
    if (titleOverlapRatio >= 0.75 && Math.min(wordsA.length, wordsB.length) >= 2) {
      return true;
    }
  }

  // 5. Artist + Duration match or Title + Duration match (within ±2 seconds)
  const durA = a.durationSec || 0;
  const durB = b.durationSec || 0;
  const sameDuration = durA > 20 && durB > 20 && Math.abs(durA - durB) <= 2;

  const sameArtist =
    normArtistA.length >= 3 &&
    normArtistB.length >= 3 &&
    (normArtistA === normArtistB ||
      normArtistA.includes(normArtistB) ||
      normArtistB.includes(normArtistA));

  if (sameDuration && (sameArtist || titleOverlapRatio >= 0.4)) {
    return true;
  }

  // 6. Same artist + strong title token overlap (>= 60%)
  if (sameArtist && titleOverlapRatio >= 0.6 && wordsA.length >= 1) {
    return true;
  }

  return false;
}

export function hasSongBeenPlayedBefore(
  candidate: PlayedSongSignature,
  playedList: PlayedSongSignature[]
): boolean {
  return playedList.some((played) => isSameSongSignature(candidate, played));
}

export function filterOutPlayedAndDuplicateTracks(
  candidates: YouTubeMusicTrack[],
  playedList: PlayedSongSignature[]
): YouTubeMusicTrack[] {
  const accepted: YouTubeMusicTrack[] = [];

  for (const track of candidates) {
    const candidateSig: PlayedSongSignature = {
      videoId: track.videoId,
      title: track.title,
      artist: track.channelTitle,
      durationSec: track.durationSec,
    };

    // Skip if already played before (by videoId, song title, artist+duration, or title+duration)
    if (hasSongBeenPlayedBefore(candidateSig, playedList)) {
      continue;
    }

    // Also skip if duplicate of another track already accepted in this list
    const isDuplicateInBatch = accepted.some((existing) =>
      isSameSongSignature(candidateSig, {
        videoId: existing.videoId,
        title: existing.title,
        artist: existing.channelTitle,
        durationSec: existing.durationSec,
      })
    );

    if (!isDuplicateInBatch) {
      accepted.push(track);
    }
  }

  return accepted;
}

