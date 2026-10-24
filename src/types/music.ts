export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  durationSec: number;
  bpm: number;
  key: string;
  releaseYear: number;
  energy: number; // 0-100
  valence: number; // 0-100 (melancholic -> euphoric)
  focus: number; // 0-100 (ambient/focused -> vocal/busy)
  moodTags: string[];
  coverPalette: {
    primary: string;
    secondary: string;
    accent: string;
    motif: 'vinyl' | 'waves' | 'prism' | 'botanical' | 'horizon' | 'eclipse';
  };
  synthConfig: {
    rootFreq: number;
    scaleIntervals: number[];
    chordProgression: number[][];
    bassPattern: number[];
    arpPattern: number[];
    waveform: OscillatorType;
    filterCutoff: number;
    reverbMix: number;
    swing: number;
  };
  lyricsSnippet: string;
}

export interface YouTubeMusicTrack {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  publishedAt: string;
  sourceType: 'liked' | 'recommended' | 'search';
  matchReason: string;
  matchScore: number;
  categoryTag?: string;
}

export interface SearchCategoryCard {
  id: string;
  name: string;
  subtitle: string;
  query: string;
  accentColor: string;
  bgGradient: string;
  isCustom?: boolean;
}

export interface LibrarySongItem {
  id: string;
  videoId?: string;
  studioTrackId?: string;
  title: string;
  artist: string;
  genre: string;
  thumbnailUrl: string;
  addedAt: string;
  source: 'youtube-music' | 'studio';
}

export interface AutoCachedSongItem {
  id: string;
  videoId?: string;
  studioTrackId?: string;
  title: string;
  artist: string;
  genre: string;
  thumbnailUrl: string;
  lastHeardAt: string;
  playCount: number;
  cacheSizeKb: number;
  moodAtPlay: string;
  source: 'youtube-music' | 'studio';
}

export interface CustomPlaylist {
  id: string;
  name: string;
  description: string;
  moodTag: string;
  accentColor: string;
  createdAt: string;
  songs: LibrarySongItem[];
}

export interface YouTubeMusicPlaylist {
  id: string;
  title: string;
  description: string;
  itemCount: number;
  thumbnailUrl: string;
}

export interface ListeningHistoryEntry {
  id: string;
  trackId: string;
  title: string;
  artist: string;
  genre: string;
  bpm: number;
  moodTag: string;
  listenedAt: string; // ISO timestamp
  listenedSeconds: number;
  source?: 'studio' | 'youtube-music';
  youtubeVideoId?: string;
  thumbnailUrl?: string;
  moodSnapshot: {
    energy: number;
    valence: number;
    focus: number;
  };
}

export interface MoodProfile {
  energy: number; // 0-100
  valence: number; // 0-100
  focus: number; // 0-100
  tempo: number; // 60-150 BPM
  presetName: string;
}

export interface RecommendationItem {
  trackId: string;
  matchScore: number;
  reason: string;
}

export interface RecommendationMix {
  mixTitle: string;
  mixSummary: string;
  recommendations: RecommendationItem[];
  source: 'gemini' | 'harmonic-engine';
  generatedAt: string;
}

export interface KeepNoteItem {
  id: string;
  name?: string; // resource name e.g. notes/123
  title: string;
  body: string;
  updatedAt: string;
  moodHint?: string;
  linkedTrackTitle?: string;
  syncedWithCloud: boolean;
}
