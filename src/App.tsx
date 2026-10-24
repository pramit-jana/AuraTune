/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Play,
  Pause,
  Sliders,
  Sparkles,
  Search,
  Plus,
  Trash2,
  RefreshCw,
  Check,
  Radio,
  Heart,
  HardDrive,
  ListMusic,
  FolderPlus,
  StickyNote,
  LogOut,
  X,
  Smartphone,
  Download,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  MoodProfile,
  ListeningHistoryEntry,
  KeepNoteItem,
  YouTubeMusicTrack,
  SearchCategoryCard,
  LibrarySongItem,
  AutoCachedSongItem,
  CustomPlaylist,
} from './types/music';
import { MOOD_PRESETS, INITIAL_KEEP_NOTES } from './data/catalog';
import { DEFAULT_SEARCH_CATEGORIES } from './data/searchCategories';
import { ytAudioController } from './services/ytAudioController';
import { initAuth, googleSignIn, logout } from './services/auth';
import {
  listGoogleKeepNotes,
  createGoogleKeepNote,
  deleteGoogleKeepNote,
} from './services/keepService';
import { fetchPersonalizedYouTubeMusic } from './services/youtubeMusicService';
import { PlayerBar } from './components/PlayerBar';
import { ConfirmModal } from './components/ConfirmModal';
import { usePWAInstall } from './hooks/usePWAInstall';
import { AndroidInstallModal } from './components/AndroidInstallModal';

// Strictly 4 Main Sections: Home, Search, Library, Create Playlist
type MainSection = 'home' | 'search' | 'library' | 'create-playlist';
type LibrarySubTab = 'saved-songs' | 'auto-cache' | 'keep-notes';

const STORAGE_KEYS = {
  CATEGORIES: 'auratune_custom_search_categories_v2',
  LIBRARY_SONGS: 'auratune_yt_library_songs_v2',
  AUTO_CACHE: 'auratune_yt_autocache_recent_v2',
  AUTO_CACHE_ENABLED: 'auratune_autocache_enabled_v2',
  PLAYLISTS: 'auratune_yt_playlists_v2',
};

const CARD_COLOR_OPTIONS = [
  {
    label: 'Emerald',
    accent: '#10b981',
    gradient: 'linear-gradient(135deg, #091917 0%, #063e31 100%)',
  },
  {
    label: 'Amber Sunset',
    accent: '#f59e0b',
    gradient: 'linear-gradient(135deg, #1c1917 0%, #3b230b 100%)',
  },
  {
    label: 'Rose Pop',
    accent: '#ec4899',
    gradient: 'linear-gradient(135deg, #1f122b 0%, #3b0d2c 100%)',
  },
  {
    label: 'Cobalt Sky',
    accent: '#38bdf8',
    gradient: 'linear-gradient(135deg, #0c1928 0%, #102a45 100%)',
  },
  {
    label: 'Violet Haze',
    accent: '#a855f7',
    gradient: 'linear-gradient(135deg, #1a1228 0%, #2e1446 100%)',
  },
];

export default function App() {
  // 4 Primary Sections: Home, Search, Library, Create Playlist
  const [activeSection, setActiveSection] = useState<MainSection>('home');
  const [librarySubTab, setLibrarySubTab] =
    useState<LibrarySubTab>('saved-songs');

  // Mood Calibration Drawer Toggle on Home
  const [showMoodSlidersOnHome, setShowMoodSlidersOnHome] = useState(false);
  const [isAndroidModalOpen, setIsAndroidModalOpen] = useState(false);
  const { isInstallable, isInstalled, promptInstall } = usePWAInstall();

  // Background Audio Playback State (100% YouTube Music Audio, no video popup)
  const [currentTrack, setCurrentTrack] = useState<YouTubeMusicTrack | null>(
    null
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isRepeat, setIsRepeat] = useState(false);

  // Mood & Listening History State (No demo tracks)
  const [moodProfile, setMoodProfile] = useState<MoodProfile>(MOOD_PRESETS[0]);
  const [listeningHistory, setListeningHistory] = useState<
    ListeningHistoryEntry[]
  >([]);

  // Google Auth State
  const [user, setUser] = useState<User | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // YouTube Music Recommendations (Home)
  const [ytRecommendedTracks, setYtRecommendedTracks] = useState<
    YouTubeMusicTrack[]
  >([]);
  const [ytLikedSeedTracks, setYtLikedSeedTracks] = useState<
    YouTubeMusicTrack[]
  >([]);
  const [ytActiveQueryUsed, setYtActiveQueryUsed] = useState<string>('');
  const [isLoadingYouTube, setIsLoadingYouTube] = useState(false);

  // Search Section State & User-Customizable Category Cards
  const [searchInput, setSearchInput] = useState('');
  const [activeSearchCategory, setActiveSearchCategory] =
    useState<SearchCategoryCard | null>(null);
  const [searchResultsYt, setSearchResultsYt] = useState<YouTubeMusicTrack[]>(
    []
  );
  const [isSearchingYt, setIsSearchingYt] = useState(false);
  const [searchCategories, setSearchCategories] = useState<
    SearchCategoryCard[]
  >(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
      return saved ? JSON.parse(saved) : DEFAULT_SEARCH_CATEGORIES;
    } catch {
      return DEFAULT_SEARCH_CATEGORIES;
    }
  });
  const [isCustomizingCards, setIsCustomizingCards] = useState(false);
  const [newCardName, setNewCardName] = useState('');
  const [newCardSubtitle, setNewCardSubtitle] = useState('');
  const [newCardQuery, setNewCardQuery] = useState('');
  const [newCardColorIdx, setNewCardColorIdx] = useState(0);

  // Library Section State: Saved Songs & Auto-Caching Recent Hearing (No demo music)
  const [savedLibrarySongs, setSavedLibrarySongs] = useState<LibrarySongItem[]>(
    () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEYS.LIBRARY_SONGS);
        if (!saved) return [];
        const parsed: LibrarySongItem[] = JSON.parse(saved);
        return parsed.filter((s) => Boolean(s.videoId));
      } catch {
        return [];
      }
    }
  );

  const [autoCacheEnabled, setAutoCacheEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.AUTO_CACHE_ENABLED);
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const [autoCacheLimit, setAutoCacheLimit] = useState<number>(50);

  const [autoCachedSongs, setAutoCachedSongs] = useState<AutoCachedSongItem[]>(
    () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEYS.AUTO_CACHE);
        if (!saved) return [];
        const parsed: AutoCachedSongItem[] = JSON.parse(saved);
        return parsed.filter((c) => Boolean(c.videoId));
      } catch {
        return [];
      }
    }
  );

  // Create Playlist Section State
  const [playlists, setPlaylists] = useState<CustomPlaylist[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PLAYLISTS);
      if (saved) {
        return JSON.parse(saved);
      }
      return [
        {
          id: 'pl-default-1',
          name: 'My Favorites Mix',
          description: 'Personal YouTube Music playlist',
          moodTag: 'Deep Focus & Flow',
          accentColor: '#10b981',
          createdAt: new Date().toISOString(),
          songs: [],
        },
      ];
    } catch {
      return [];
    }
  });
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>(
    () => playlists[0]?.id || 'pl-default-1'
  );
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistDesc, setNewPlaylistDesc] = useState('');
  const [newPlaylistMood, setNewPlaylistMood] = useState(
    MOOD_PRESETS[0].presetName
  );
  const [playlistSearchQuery, setPlaylistSearchQuery] = useState('');
  const [playlistSearchResults, setPlaylistSearchResults] = useState<
    YouTubeMusicTrack[]
  >([]);
  const [isSearchingForPlaylist, setIsSearchingForPlaylist] = useState(false);

  // Google Keep Notes State
  const [keepNotes, setKeepNotes] =
    useState<KeepNoteItem[]>(INITIAL_KEEP_NOTES);
  const [activeKeepNoteId, setActiveKeepNoteId] = useState<string | null>(
    INITIAL_KEEP_NOTES[0].id
  );
  const [isSyncingKeep, setIsSyncingKeep] = useState(false);
  const [keepStatusBanner, setKeepStatusBanner] = useState<string | null>(null);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteBody, setNewNoteBody] = useState('');
  const [isCreatingNote, setIsCreatingNote] = useState(false);

  // Confirmation Modals
  const [notePendingDelete, setNotePendingDelete] =
    useState<KeepNoteItem | null>(null);
  const [isConfirmClearCacheOpen, setIsConfirmClearCacheOpen] = useState(false);
  const [playlistPendingDelete, setPlaylistPendingDelete] =
    useState<CustomPlaylist | null>(null);

  // Persist user customizations & library/cache to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.CATEGORIES,
        JSON.stringify(searchCategories)
      );
    } catch {
      // ignore
    }
  }, [searchCategories]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.LIBRARY_SONGS,
        JSON.stringify(savedLibrarySongs)
      );
    } catch {
      // ignore
    }
  }, [savedLibrarySongs]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.AUTO_CACHE,
        JSON.stringify(autoCachedSongs)
      );
    } catch {
      // ignore
    }
  }, [autoCachedSongs]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.AUTO_CACHE_ENABLED,
        JSON.stringify(autoCacheEnabled)
      );
    } catch {
      // ignore
    }
  }, [autoCacheEnabled]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(playlists));
    } catch {
      // ignore
    }
  }, [playlists]);

  const activeKeepNote = useMemo(
    () => keepNotes.find((n) => n.id === activeKeepNoteId) || null,
    [keepNotes, activeKeepNoteId]
  );

  // Auto-Cache helper: automatically caches any YouTube Music song the user hears
  const recordSongInAutoCache = useCallback(
    (ytTrack: YouTubeMusicTrack) => {
      if (!autoCacheEnabled) return;
      const cacheKey = `cache-yt-${ytTrack.videoId}`;

      setAutoCachedSongs((prev) => {
        const existing = prev.find((c) => c.id === cacheKey);
        if (existing) {
          const updated: AutoCachedSongItem = {
            ...existing,
            lastHeardAt: new Date().toISOString(),
            playCount: existing.playCount + 1,
            moodAtPlay: moodProfile.presetName,
          };
          return [
            updated,
            ...prev.filter((c) => c.id !== cacheKey),
          ].slice(0, autoCacheLimit);
        }

        const newCached: AutoCachedSongItem = {
          id: cacheKey,
          videoId: ytTrack.videoId,
          title: ytTrack.title,
          artist: ytTrack.channelTitle,
          genre: ytTrack.categoryTag || 'YouTube Music',
          thumbnailUrl: ytTrack.thumbnailUrl,
          lastHeardAt: new Date().toISOString(),
          playCount: 1,
          cacheSizeKb: 2800 + Math.floor(Math.random() * 1400),
          moodAtPlay: moodProfile.presetName,
          source: 'youtube-music',
        };
        return [newCached, ...prev].slice(0, autoCacheLimit);
      });
    },
    [autoCacheEnabled, autoCacheLimit, moodProfile.presetName]
  );

  // Fetch Recommended YouTube Music for Home Section based on Listening & Mood
  const syncHomeYouTubeRecommendations = useCallback(async () => {
    setIsLoadingYouTube(true);
    try {
      const res = await fetchPersonalizedYouTubeMusic(
        moodProfile,
        listeningHistory,
        activeKeepNote
      );
      setYtRecommendedTracks(res.recommendedTracks);
      setYtLikedSeedTracks(res.likedTracks);
      setYtActiveQueryUsed(res.queryUsed);
      if (!currentTrack && res.recommendedTracks.length > 0) {
        setCurrentTrack(res.recommendedTracks[0]);
        ytAudioController.cueTrack(res.recommendedTracks[0]);
      }
    } catch {
      // ignore transient errors
    } finally {
      setIsLoadingYouTube(false);
    }
  }, [moodProfile, listeningHistory, activeKeepNote, currentTrack]);

  // Load Home YouTube Music recommendations on initial mount and when mood preset changes
  useEffect(() => {
    syncHomeYouTubeRecommendations();
  }, [moodProfile.presetName]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize Firebase Auth listener
  useEffect(() => {
    const unsub = initAuth(
      (authedUser) => {
        setUser(authedUser);
        setNeedsAuth(false);
      },
      () => {
        setUser(null);
        setNeedsAuth(true);
      }
    );
    return () => unsub();
  }, []);

  // Subscribe to Hidden YouTube Audio Controller updates
  useEffect(() => {
    const unsub = ytAudioController.subscribe((state) => {
      setIsPlaying(state.isPlaying);
      setCurrentTime(state.currentTime);
      setDuration(state.duration);
    });
    return () => unsub();
  }, []);

  // Play a YouTube Music Track in background audio (NO video popup), log to Listening History & Auto-Cache
  const handlePlayYouTubeTrack = useCallback(
    (ytTrack: YouTubeMusicTrack) => {
      if (currentTrack?.videoId === ytTrack.videoId) {
        ytAudioController.togglePlayPause(ytTrack);
        return;
      }

      setCurrentTrack(ytTrack);
      ytAudioController.loadAndPlay(ytTrack);

      const entry: ListeningHistoryEntry = {
        id: `hist-yt-${Date.now()}`,
        trackId: ytTrack.videoId,
        title: ytTrack.title,
        artist: ytTrack.channelTitle,
        genre: ytTrack.categoryTag || 'YouTube Music',
        bpm: moodProfile.tempo,
        moodTag: moodProfile.presetName,
        listenedAt: new Date().toISOString(),
        listenedSeconds: 210,
        source: 'youtube-music',
        youtubeVideoId: ytTrack.videoId,
        thumbnailUrl: ytTrack.thumbnailUrl,
        moodSnapshot: {
          energy: moodProfile.energy,
          valence: moodProfile.valence,
          focus: moodProfile.focus,
        },
      };
      setListeningHistory((prev) => [entry, ...prev.slice(0, 39)]);
      recordSongInAutoCache(ytTrack);
    },
    [currentTrack?.videoId, moodProfile, recordSongInAutoCache]
  );

  // Active playback queue for Next / Previous buttons in PlayerBar
  const activeQueue = useMemo(() => {
    if (activeSection === 'search' && searchResultsYt.length > 0) {
      return searchResultsYt;
    }
    return [...ytRecommendedTracks, ...ytLikedSeedTracks];
  }, [activeSection, searchResultsYt, ytRecommendedTracks, ytLikedSeedTracks]);

  const handleNextTrack = useCallback(() => {
    if (activeQueue.length === 0) return;
    const idx = activeQueue.findIndex(
      (t) => t.videoId === currentTrack?.videoId
    );
    const nextTrack = activeQueue[(idx + 1) % activeQueue.length];
    if (nextTrack) {
      handlePlayYouTubeTrack(nextTrack);
    }
  }, [activeQueue, currentTrack?.videoId, handlePlayYouTubeTrack]);

  const handlePrevTrack = useCallback(() => {
    if (activeQueue.length === 0) return;
    const idx = activeQueue.findIndex(
      (t) => t.videoId === currentTrack?.videoId
    );
    const prevTrack =
      activeQueue[(idx - 1 + activeQueue.length) % activeQueue.length];
    if (prevTrack) {
      handlePlayYouTubeTrack(prevTrack);
    }
  }, [activeQueue, currentTrack?.videoId, handlePlayYouTubeTrack]);

  useEffect(() => {
    ytAudioController.onTrackEnd(() => {
      if (isRepeat && currentTrack) {
        ytAudioController.loadAndPlay(currentTrack);
      } else {
        handleNextTrack();
      }
    });
  }, [isRepeat, currentTrack, handleNextTrack]);

  // Library Helpers: Add / Remove Song to Library
  const isYtTrackInLibrary = useCallback(
    (videoId: string) => savedLibrarySongs.some((s) => s.videoId === videoId),
    [savedLibrarySongs]
  );

  const handleToggleYtLibrary = useCallback((yt: YouTubeMusicTrack) => {
    setSavedLibrarySongs((prev) => {
      const exists = prev.some((s) => s.videoId === yt.videoId);
      if (exists) {
        return prev.filter((s) => s.videoId !== yt.videoId);
      }
      const newItem: LibrarySongItem = {
        id: `lib-yt-${yt.videoId}`,
        videoId: yt.videoId,
        title: yt.title,
        artist: yt.channelTitle,
        genre: yt.categoryTag || 'YouTube Music',
        thumbnailUrl: yt.thumbnailUrl,
        addedAt: new Date().toISOString(),
        source: 'youtube-music',
      };
      return [newItem, ...prev];
    });
  }, []);

  // Search Section Handlers
  const executeSearchQuery = async (
    queryText: string,
    categoryCard?: SearchCategoryCard
  ) => {
    if (!queryText.trim()) return;
    setIsSearchingYt(true);
    if (categoryCard) {
      setActiveSearchCategory(categoryCard);
    } else {
      setActiveSearchCategory(null);
    }
    try {
      const res = await fetchPersonalizedYouTubeMusic(
        moodProfile,
        listeningHistory,
        activeKeepNote,
        queryText
      );
      const tagged = res.recommendedTracks.map((t) => ({
        ...t,
        categoryTag: categoryCard?.name || 'Search',
      }));
      setSearchResultsYt(tagged);
    } finally {
      setIsSearchingYt(false);
    }
  };

  const handleAddCustomCategoryCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCardName.trim()) return;
    const colorChoice =
      CARD_COLOR_OPTIONS[newCardColorIdx % CARD_COLOR_OPTIONS.length];
    const query =
      newCardQuery.trim() || `${newCardName.trim()} hit songs official audio`;
    const newCard: SearchCategoryCard = {
      id: `cat-custom-${Date.now()}`,
      name: newCardName.trim(),
      subtitle:
        newCardSubtitle.trim() || `Custom ${newCardName.trim()} music stream`,
      query,
      accentColor: colorChoice.accent,
      bgGradient: colorChoice.gradient,
      isCustom: true,
    };
    setSearchCategories((prev) => [newCard, ...prev]);
    setNewCardName('');
    setNewCardSubtitle('');
    setNewCardQuery('');
    executeSearchQuery(newCard.query, newCard);
  };

  const handleDeleteCategoryCard = (cardId: string) => {
    setSearchCategories((prev) => prev.filter((c) => c.id !== cardId));
    if (activeSearchCategory?.id === cardId) {
      setActiveSearchCategory(null);
    }
  };

  // Create Playlist Section Handlers
  const selectedPlaylist = useMemo(
    () => playlists.find((p) => p.id === selectedPlaylistId) || playlists[0],
    [playlists, selectedPlaylistId]
  );

  const handleCreateNewPlaylist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    const created: CustomPlaylist = {
      id: `pl-${Date.now()}`,
      name: newPlaylistName.trim(),
      description: newPlaylistDesc.trim() || `Curated for ${newPlaylistMood}`,
      moodTag: newPlaylistMood,
      accentColor: '#10b981',
      createdAt: new Date().toISOString(),
      songs: [],
    };
    setPlaylists((prev) => [created, ...prev]);
    setSelectedPlaylistId(created.id);
    setNewPlaylistName('');
    setNewPlaylistDesc('');
  };

  const handleAddSongToSelectedPlaylist = (song: LibrarySongItem) => {
    if (!selectedPlaylist) return;
    setPlaylists((prev) =>
      prev.map((pl) => {
        if (pl.id !== selectedPlaylist.id) return pl;
        const alreadyExists = pl.songs.some(
          (s) => song.videoId && s.videoId === song.videoId
        );
        if (alreadyExists) return pl;
        return {
          ...pl,
          songs: [...pl.songs, song],
        };
      })
    );
  };

  const handleRemoveSongFromPlaylist = (playlistId: string, songId: string) => {
    setPlaylists((prev) =>
      prev.map((pl) =>
        pl.id === playlistId
          ? { ...pl, songs: pl.songs.filter((s) => s.id !== songId) }
          : pl
      )
    );
  };

  const handleSearchSongsForPlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playlistSearchQuery.trim()) return;
    setIsSearchingForPlaylist(true);
    try {
      const res = await fetchPersonalizedYouTubeMusic(
        moodProfile,
        listeningHistory,
        activeKeepNote,
        playlistSearchQuery
      );
      setPlaylistSearchResults(res.recommendedTracks);
    } finally {
      setIsSearchingForPlaylist(false);
    }
  };

  // Google Sign-In -> Immediately Syncs Personalized YouTube Music on Home
  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (!result) return;
      setUser(result.user);
      setNeedsAuth(false);
      await syncHomeYouTubeRecommendations();
    } catch {
      // handled gracefully
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Google Keep Handlers
  const handleSyncKeepNotes = async () => {
    if (needsAuth) {
      await handleGoogleLogin();
      return;
    }
    setIsSyncingKeep(true);
    try {
      const syncRes = await listGoogleKeepNotes(keepNotes);
      setKeepNotes(syncRes.notes);
      setKeepStatusBanner(
        'Keep notes synced with your YouTube Music recommendation engine.'
      );
    } finally {
      setIsSyncingKeep(false);
    }
  };

  const handleCreateKeepNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteTitle.trim() && !newNoteBody.trim()) return;
    setIsCreatingNote(true);
    try {
      const res = await createGoogleKeepNote(
        newNoteTitle.trim() || `${moodProfile.presetName} Note`,
        newNoteBody.trim(),
        moodProfile.presetName,
        currentTrack?.title || 'YouTube Music'
      );
      setKeepNotes((prev) => [res.note, ...prev]);
      setActiveKeepNoteId(res.note.id);
      setNewNoteTitle('');
      setNewNoteBody('');
    } finally {
      setIsCreatingNote(false);
    }
  };

  const handleSaveYouTubeTrackToKeep = (ytTrack: YouTubeMusicTrack) => {
    setNewNoteTitle(`YouTube Music Note: ${ytTrack.title}`);
    setNewNoteBody(
      `Track: "${ytTrack.title}" by ${ytTrack.channelTitle} (https://music.youtube.com/watch?v=${ytTrack.videoId}). Mood: ${moodProfile.presetName}.`
    );
    setActiveSection('library');
    setLibrarySubTab('keep-notes');
  };

  const totalCacheSizeMb = useMemo(() => {
    const totalKb = autoCachedSongs.reduce(
      (sum, item) => sum + item.cacheSizeKb,
      0
    );
    return (totalKb / 1024).toFixed(1);
  }, [autoCachedSongs]);

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 pb-32 overflow-x-hidden">
      {/* Mandatory 3-Zone Top Bar Contract with the 4 Requested Sections (Responsive 2-row on 6.2" mobile, 1-row on md+) */}
      <header className="sticky top-0 z-30 flex flex-wrap md:flex-nowrap items-center justify-between gap-x-3 gap-y-2 md:gap-8 px-3.5 sm:px-6 py-2.5 sm:py-3.5 border-b border-slate-800/80 bg-[#090d16]/95 backdrop-blur-md">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#home"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection('home');
          }}
          className="order-1 text-base sm:text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          AuraTune
        </a>

        {/* Zone 2: 4 Navigation Links: Home, Search, Library, Create Playlist */}
        <nav
          aria-label="Primary Navigation"
          className="order-3 md:order-2 w-full md:w-auto grid grid-cols-4 md:flex items-center gap-1 md:gap-6 pt-2 md:pt-0 border-t border-slate-800/70 md:border-t-0 text-xs sm:text-sm font-medium text-slate-400"
        >
          <button
            type="button"
            onClick={() => setActiveSection('home')}
            className={`py-1.5 md:py-1 text-center transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeSection === 'home'
                ? 'text-white border-emerald-400 font-semibold'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            Home
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('search')}
            className={`py-1.5 md:py-1 text-center transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeSection === 'search'
                ? 'text-white border-emerald-400 font-semibold'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            Search
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('library')}
            className={`py-1.5 md:py-1 text-center transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeSection === 'library'
                ? 'text-white border-emerald-400 font-semibold'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            Library
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('create-playlist')}
            className={`py-1.5 md:py-1 text-center transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeSection === 'create-playlist'
                ? 'text-white border-emerald-400 font-semibold'
                : 'border-transparent hover:text-slate-200'
            }`}
          >
            Create Playlist
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="order-2 md:order-3 flex items-center shrink-0">
          {needsAuth ? (
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoggingIn}
              className="gsi-material-button"
            >
              <div className="gsi-material-button-state"></div>
              <div className="gsi-material-button-content-wrapper">
                <div className="gsi-material-button-icon">
                  <svg
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 48 48"
                    style={{ display: 'block' }}
                  >
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    ></path>
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    ></path>
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    ></path>
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    ></path>
                    <path fill="none" d="M0 0h48v48H0z"></path>
                  </svg>
                </div>
                <span className="gsi-material-button-contents">
                  {isLoggingIn ? 'Connecting...' : 'Sign in with Google'}
                </span>
              </div>
            </button>
          ) : (
            <button
              type="button"
              onClick={syncHomeYouTubeRecommendations}
              disabled={isLoadingYouTube}
              className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="sm:hidden">
                {isLoadingYouTube ? 'Updating...' : 'Refresh Mix'}
              </span>
              <span className="hidden sm:inline">
                {isLoadingYouTube
                  ? 'Updating Mix...'
                  : 'Refresh Recommendations'}
              </span>
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-[1380px] px-3.5 sm:px-6 pt-4 sm:pt-8 space-y-6 sm:space-y-10">
        {/* Android / Mobile PWA Install Bar */}
        {!isInstalled && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-xl bg-slate-900/90 border border-slate-800/90">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <Smartphone className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate">
                  Install AuraTune on Your Android Phone
                </p>
                <p className="text-[11px] text-slate-400 line-clamp-1">
                  Full-screen mobile playback & auto-cached recent songs
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
              {isInstallable && (
                <button
                  type="button"
                  onClick={promptInstall}
                  className="flex-1 sm:flex-initial justify-center px-3 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Install App</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsAndroidModalOpen(true)}
                className="flex-1 sm:flex-initial justify-center px-3 py-1.5 text-xs font-medium text-emerald-300 bg-slate-950/90 hover:bg-slate-800 border border-emerald-500/30 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Android Setup & QR</span>
              </button>
            </div>
          </div>
        )}

        {/* =========================================================
            SECTION 1: HOME (Recommended YouTube Music Based on Listening & Mood)
           ========================================================= */}
        {activeSection === 'home' && (
          <div className="space-y-6 sm:space-y-10">
            {/* Hero Split: Listening-Driven YouTube Music + Mood Calibration */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-8 items-stretch border-b border-slate-800/80 pb-6 sm:pb-10">
              <div className="lg:col-span-7 flex flex-col justify-between space-y-4 sm:space-y-6">
                <div className="space-y-2 sm:space-y-3">
                  <p className="text-[11px] sm:text-xs font-medium text-emerald-400 tracking-wide truncate">
                    Home · YouTube Music & Mood Discovery{' '}
                    {user
                      ? `· ${user.displayName || user.email}`
                      : ''}
                  </p>
                  <h1
                    className="text-2xl sm:text-4xl lg:text-[40px] font-bold tracking-tight text-white leading-[1.18]"
                    style={{ textWrap: 'balance' }}
                  >
                    Recommended YouTube Music shaped by your recent listening.
                  </h1>
                  <p className="text-xs sm:text-base text-slate-300 max-w-2xl leading-relaxed">
                    Every song you play streams seamlessly in the background
                    audio bar and is automatically cached to personalize your
                    YouTube Music recommendations ({moodProfile.presetName}).
                  </p>
                </div>

                {/* Quick Mood Preset Bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Current Listening Mood</span>
                    <button
                      type="button"
                      onClick={() => setShowMoodSlidersOnHome((s) => !s)}
                      className="text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>
                        {showMoodSlidersOnHome
                          ? 'Hide Sliders'
                          : 'Mood Sliders'}
                      </span>
                    </button>
                  </div>
                  <div className="flex overflow-x-auto no-scrollbar sm:flex-wrap items-center gap-1.5 p-1.5 bg-slate-900/90 border border-slate-800/80 rounded-xl">
                    {MOOD_PRESETS.map((preset) => {
                      const isActive =
                        moodProfile.presetName === preset.presetName;
                      return (
                        <button
                          key={preset.presetName}
                          type="button"
                          onClick={() => setMoodProfile(preset)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                            isActive
                              ? 'bg-emerald-500 text-slate-950 font-semibold'
                              : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                          }`}
                        >
                          {preset.presetName}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Optional Fine-Tune Mood Sliders Drawer on Home */}
                {showMoodSlidersOnHome && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-800/80">
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-300">Energy</span>
                        <span className="font-mono-tabular text-emerald-400">
                          {moodProfile.energy}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={10}
                        max={100}
                        value={moodProfile.energy}
                        onChange={(e) =>
                          setMoodProfile((p) => ({
                            ...p,
                            presetName: 'Custom Mood',
                            energy: Number(e.target.value),
                          }))
                        }
                        className="mood-slider w-full"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-300">Warmth / Valence</span>
                        <span className="font-mono-tabular text-emerald-400">
                          {moodProfile.valence}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={10}
                        max={100}
                        value={moodProfile.valence}
                        onChange={(e) =>
                          setMoodProfile((p) => ({
                            ...p,
                            presetName: 'Custom Mood',
                            valence: Number(e.target.value),
                          }))
                        }
                        className="mood-slider w-full"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-300">Focus</span>
                        <span className="font-mono-tabular text-emerald-400">
                          {moodProfile.focus}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={10}
                        max={100}
                        value={moodProfile.focus}
                        onChange={(e) =>
                          setMoodProfile((p) => ({
                            ...p,
                            presetName: 'Custom Mood',
                            focus: Number(e.target.value),
                          }))
                        }
                        className="mood-slider w-full"
                      />
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  {ytRecommendedTracks[0] && (
                    <button
                      type="button"
                      onClick={() =>
                        handlePlayYouTubeTrack(ytRecommendedTracks[0])
                      }
                      className="flex-1 sm:flex-initial justify-center px-4 sm:px-5 py-2.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
                    >
                      {isPlaying &&
                      currentTrack?.videoId ===
                        ytRecommendedTracks[0].videoId ? (
                        <>
                          <Pause className="w-4 h-4 fill-current" />
                          <span>Pause Top Match</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 fill-current" />
                          <span>Play Top Match</span>
                        </>
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={syncHomeYouTubeRecommendations}
                    disabled={isLoadingYouTube}
                    className="flex-1 sm:flex-initial justify-center px-3.5 sm:px-4 py-2.5 text-xs font-semibold text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 text-emerald-400 ${
                        isLoadingYouTube ? 'animate-spin' : ''
                      }`}
                    />
                    <span>Refresh From History</span>
                  </button>
                </div>
              </div>

              {/* Right Spotlight: Recent Hearing & Auto-Cache Status Card */}
              <div className="lg:col-span-5 rounded-xl border border-slate-800/80 bg-slate-900/50 p-4 sm:p-6 flex flex-col justify-between gap-4 sm:gap-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-emerald-400">
                      Listening Profile & Auto-Cache Active
                    </span>
                    <span className="text-xs font-mono-tabular text-slate-400">
                      {autoCachedSongs.length} Cached · {totalCacheSizeMb} MB
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-white">
                    Recent Hearing Influence
                  </h2>
                  <p className="text-xs text-slate-400">
                    Songs you listen to are auto-cached and used to tailor your
                    Home YouTube Music recommendations:
                  </p>
                </div>

                {autoCachedSongs.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400 border-y border-slate-800/70">
                    Click Play on any recommended song below to start building
                    your auto-cached recent hearing history.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800/70">
                    {autoCachedSongs.slice(0, 3).map((item) => (
                      <div
                        key={item.id}
                        className="py-2.5 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-white truncate">
                            {item.title}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate">
                            {item.artist} · Heard {item.playCount}x
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (item.videoId) {
                              handlePlayYouTubeTrack({
                                videoId: item.videoId,
                                title: item.title,
                                channelTitle: item.artist,
                                thumbnailUrl: item.thumbnailUrl,
                                publishedAt: item.lastHeardAt,
                                sourceType: 'recommended',
                                matchReason: 'Replayed from Auto-Cache',
                                matchScore: 98,
                              });
                            }
                          }}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-md transition-colors shrink-0"
                        >
                          Replay
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                  <span className="text-slate-400 truncate">
                    Active Profile: {ytActiveQueryUsed || moodProfile.presetName}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSection('library');
                      setLibrarySubTab('auto-cache');
                    }}
                    className="text-emerald-400 hover:text-emerald-300 font-medium whitespace-nowrap ml-2"
                  >
                    View Auto-Cache
                  </button>
                </div>
              </div>
            </section>

            {/* Primary Home Feed: Recommended YouTube Music Based on Listening */}
            <section className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white">
                    01. Recommended YouTube Music For Your Mood & Listening
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Plays directly in the bottom audio player with zero video
                    popups
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSection('search')}
                  className="text-xs font-medium text-emerald-400 hover:text-emerald-300 whitespace-nowrap shrink-0"
                >
                  Explore Genres & Languages in Search
                </button>
              </div>

              {isLoadingYouTube && ytRecommendedTracks.length === 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <div
                      key={n}
                      className="h-40 rounded-xl border border-slate-800/80 bg-slate-900/40 animate-pulse p-5"
                    />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {ytRecommendedTracks.map((yt) => {
                    const isCurrent = currentTrack?.videoId === yt.videoId;
                    const inLib = isYtTrackInLibrary(yt.videoId);
                    return (
                      <div
                        key={yt.videoId}
                        className={`rounded-xl border p-4 transition-colors flex flex-col justify-between gap-4 ${
                          isCurrent
                            ? 'border-emerald-500/60 bg-slate-900/90'
                            : 'border-slate-800/80 bg-slate-900/40 hover:bg-slate-900/75'
                        }`}
                      >
                        <div className="flex items-start gap-3.5">
                          {yt.thumbnailUrl ? (
                            <img
                              src={yt.thumbnailUrl}
                              alt={yt.title}
                              referrerPolicy="no-referrer"
                              className="w-16 h-16 rounded-lg object-cover border border-slate-800 shrink-0"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                              <Radio className="w-5 h-5 text-emerald-400" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-mono-tabular text-emerald-400">
                              {yt.matchScore}% Match · YouTube Music
                            </p>
                            <h3 className="text-sm font-semibold text-white line-clamp-2 mt-0.5">
                              {yt.title}
                            </h3>
                            <p className="text-xs text-slate-400 truncate mt-1">
                              {yt.channelTitle}
                            </p>
                          </div>
                        </div>

                        <p className="text-xs text-slate-400 line-clamp-1">
                          {yt.matchReason}
                        </p>

                        <div className="flex items-center justify-between pt-3 border-t border-slate-800/70">
                          <button
                            type="button"
                            onClick={() => handleToggleYtLibrary(yt)}
                            className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 ${
                              inLib
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-slate-800/80 text-slate-300 hover:text-white'
                            }`}
                          >
                            {inLib ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>In Library</span>
                              </>
                            ) : (
                              <>
                                <Heart className="w-3.5 h-3.5" />
                                <span>+ Library</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handlePlayYouTubeTrack(yt)}
                            className="px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                          >
                            {isCurrent && isPlaying ? (
                              <>
                                <Pause className="w-3.5 h-3.5 fill-current" />
                                <span>Pause</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-3.5 h-3.5 fill-current" />
                                <span>Play Audio</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Secondary Home Feed: More YouTube Music Picks From Listening Affinity */}
            {ytLikedSeedTracks.length > 0 && (
              <section className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold text-white">
                    02. More YouTube Music Picks From Your Listening Affinity
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Additional YouTube Music streams matched to your listening
                    session
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {ytLikedSeedTracks.map((yt) => {
                    const isCurrent = currentTrack?.videoId === yt.videoId;
                    const inLib = isYtTrackInLibrary(yt.videoId);
                    return (
                      <div
                        key={`seed-${yt.videoId}`}
                        className={`rounded-xl border p-4 transition-colors flex flex-col justify-between gap-4 ${
                          isCurrent
                            ? 'border-emerald-500/60 bg-slate-900/90'
                            : 'border-slate-800/80 bg-slate-900/40 hover:bg-slate-900/75'
                        }`}
                      >
                        <div className="flex items-start gap-3.5">
                          {yt.thumbnailUrl ? (
                            <img
                              src={yt.thumbnailUrl}
                              alt={yt.title}
                              referrerPolicy="no-referrer"
                              className="w-14 h-14 rounded-lg object-cover border border-slate-800 shrink-0"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                              <Radio className="w-5 h-5 text-emerald-400" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-emerald-400">
                              Listening Affinity · YouTube Music
                            </p>
                            <h3 className="text-sm font-semibold text-white line-clamp-2 mt-0.5">
                              {yt.title}
                            </h3>
                            <p className="text-xs text-slate-400 truncate mt-0.5">
                              {yt.channelTitle}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-2.5 border-t border-slate-800/70">
                          <button
                            type="button"
                            onClick={() => handleToggleYtLibrary(yt)}
                            className="text-xs text-slate-300 hover:text-white"
                          >
                            {inLib ? 'Saved in Library' : '+ Save to Library'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePlayYouTubeTrack(yt)}
                            className="px-3 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-md flex items-center gap-1"
                          >
                            {isCurrent && isPlaying ? (
                              <>
                                <Pause className="w-3 h-3 fill-current" />
                                <span>Pause</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-3 h-3 fill-current" />
                                <span>Play</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}

        {/* =========================================================
            SECTION 2: SEARCH (Search Bar + Customizable Genre/Language Cards)
           ========================================================= */}
        {activeSection === 'search' && (
          <div className="space-y-10">
            {/* Top Search Bar */}
            <section className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-bold text-white">
                    Search YouTube Music, Genres & Languages
                  </h1>
                  <p className="text-xs text-slate-400 mt-1">
                    Search any song or artist, or click a genre/language card
                    below (Pop, Hip-Hop, EDM, Hindi, English, Bengali, or your
                    custom cards).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCustomizingCards((c) => !c)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    {isCustomizingCards
                      ? 'Done Customizing Cards'
                      : 'Customize Genre Cards'}
                  </span>
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  executeSearchQuery(searchInput);
                }}
                className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
              >
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search songs, artists, Hindi, Bengali, English, Pop, Hip-Hop, EDM..."
                    aria-label="Search music"
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSearchingYt}
                  className="px-6 py-2.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  {isSearchingYt ? 'Searching...' : 'Search Music'}
                </button>
              </form>
            </section>

            {/* User Card Customization Panel */}
            {isCustomizingCards && (
              <section className="rounded-xl border border-emerald-500/40 bg-slate-900/80 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-white">
                      Add Your Own Custom Genre, Language, or Vibe Card
                    </h2>
                    <p className="text-xs text-slate-400">
                      Create personalized browse cards (e.g., Punjabi Hits,
                      Rabindra Sangeet, 90s Classics, Anime OST) or remove cards
                      you don&apos;t use.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setSearchCategories(DEFAULT_SEARCH_CATEGORIES)
                    }
                    className="text-xs text-slate-400 hover:text-white underline"
                  >
                    Reset Default Cards
                  </button>
                </div>

                <form
                  onSubmit={handleAddCustomCategoryCard}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end"
                >
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      Card Title
                    </label>
                    <input
                      type="text"
                      required
                      value={newCardName}
                      onChange={(e) => setNewCardName(e.target.value)}
                      placeholder="e.g., Acoustic Bangla"
                      className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      Subtitle
                    </label>
                    <input
                      type="text"
                      value={newCardSubtitle}
                      onChange={(e) => setNewCardSubtitle(e.target.value)}
                      placeholder="e.g., Soulful Kolkata indie & folk"
                      className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      Search Keywords
                    </label>
                    <input
                      type="text"
                      value={newCardQuery}
                      onChange={(e) => setNewCardQuery(e.target.value)}
                      placeholder="e.g., bangla indie acoustic songs"
                      className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      Card Theme
                    </label>
                    <select
                      value={newCardColorIdx}
                      onChange={(e) =>
                        setNewCardColorIdx(Number(e.target.value))
                      }
                      className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white"
                    >
                      {CARD_COLOR_OPTIONS.map((c, idx) => (
                        <option key={c.label} value={idx}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors"
                  >
                    + Add Custom Card
                  </button>
                </form>
              </section>
            )}

            {/* Customizable Browse Cards Grid (2 columns on 6.2-inch Android mobile, 4 columns on desktop) */}
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white">
                  Browse by Genre & Language ({searchCategories.length})
                </h2>
                <span className="text-[11px] sm:text-xs text-slate-400">
                  Tap any card to play
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
                {searchCategories.map((card) => {
                  const isSelected = activeSearchCategory?.id === card.id;
                  return (
                    <div
                      key={card.id}
                      style={{ background: card.bgGradient }}
                      className={`relative rounded-xl border p-3.5 sm:p-5 transition-transform hover:-translate-y-0.5 flex flex-col justify-between min-h-[104px] sm:min-h-[124px] ${
                        isSelected
                          ? 'border-emerald-400 ring-1 ring-emerald-400/50'
                          : 'border-slate-800/90'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSearchInput(card.name);
                            executeSearchQuery(card.query, card);
                          }}
                          className="text-left flex-1 min-w-0 focus:outline-none"
                        >
                          <h3 className="text-sm sm:text-lg font-bold text-white truncate">
                            {card.name}
                          </h3>
                          <p className="text-[11px] sm:text-xs text-slate-300 mt-1 line-clamp-2">
                            {card.subtitle}
                          </p>
                        </button>

                        {isCustomizingCards && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCategoryCard(card.id)}
                            aria-label={`Remove ${card.name} card`}
                            className="p-1 text-slate-300 hover:text-rose-400 bg-black/40 rounded-md shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-white/10 text-[10px] sm:text-[11px] text-slate-300">
                        <span className="truncate">
                          {card.isCustom ? 'Custom' : 'Genre Mix'}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSearchInput(card.name);
                            executeSearchQuery(card.query, card);
                          }}
                          className="font-semibold text-white hover:underline flex items-center gap-1 shrink-0"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Explore</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Search Results Display */}
            {(isSearchingYt || searchResultsYt.length > 0) && (
              <section className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white">
                    {activeSearchCategory
                      ? `${activeSearchCategory.name} — YouTube Music Tracks`
                      : `Search Results for "${searchInput}"`}
                  </h2>
                  {searchResultsYt.length > 0 && (
                    <span className="text-xs font-mono-tabular text-slate-400">
                      {searchResultsYt.length} Tracks Found
                    </span>
                  )}
                </div>

                {isSearchingYt ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <div
                        key={n}
                        className="h-36 rounded-xl border border-slate-800/80 bg-slate-900/40 animate-pulse p-5"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {searchResultsYt.map((yt) => {
                      const isCurrent = currentTrack?.videoId === yt.videoId;
                      const inLib = isYtTrackInLibrary(yt.videoId);
                      return (
                        <div
                          key={`search-${yt.videoId}`}
                          className={`rounded-xl border p-4 transition-colors flex flex-col justify-between gap-4 ${
                            isCurrent
                              ? 'border-emerald-500/60 bg-slate-900/90'
                              : 'border-slate-800/80 bg-slate-900/40 hover:bg-slate-900/75'
                          }`}
                        >
                          <div className="flex items-start gap-3.5">
                            {yt.thumbnailUrl ? (
                              <img
                                src={yt.thumbnailUrl}
                                alt={yt.title}
                                referrerPolicy="no-referrer"
                                className="w-16 h-16 rounded-lg object-cover border border-slate-800 shrink-0"
                              />
                            ) : (
                              <div className="w-16 h-16 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                                <Radio className="w-5 h-5 text-emerald-400" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-emerald-400">
                                {yt.categoryTag || 'YouTube Music'}
                              </p>
                              <h3 className="text-sm font-semibold text-white line-clamp-2 mt-0.5">
                                {yt.title}
                              </h3>
                              <p className="text-xs text-slate-400 truncate mt-1">
                                {yt.channelTitle}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-3 border-t border-slate-800/70">
                            <button
                              type="button"
                              onClick={() => handleToggleYtLibrary(yt)}
                              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${
                                inLib
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-slate-800 text-slate-300 hover:text-white'
                              }`}
                            >
                              {inLib ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>In Library</span>
                                </>
                              ) : (
                                <>
                                  <Heart className="w-3.5 h-3.5" />
                                  <span>+ Library</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => handlePlayYouTubeTrack(yt)}
                              className="px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-md transition-colors flex items-center gap-1.5"
                            >
                              {isCurrent && isPlaying ? (
                                <>
                                  <Pause className="w-3.5 h-3.5 fill-current" />
                                  <span>Pause</span>
                                </>
                              ) : (
                                <>
                                  <Play className="w-3.5 h-3.5 fill-current" />
                                  <span>Play Audio</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}
          </div>
        )}

        {/* =========================================================
            SECTION 3: LIBRARY (Saved Songs + Auto-Caching Recent Hearing + Keep Notes)
           ========================================================= */}
        {activeSection === 'library' && (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
              <div>
                <h1 className="text-2xl font-bold text-white">
                  Your Music Library & Auto-Cache Studio
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Manage songs saved to your Library, inspect auto-cached recent
                  hearing songs, and sync Google Keep mood notes.
                </p>
              </div>

              {/* Segmented Sub-Tab Controls for Library (3 equal columns on 6.2-inch mobile) */}
              <div className="grid grid-cols-3 sm:flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl w-full md:w-auto">
                <button
                  type="button"
                  onClick={() => setLibrarySubTab('saved-songs')}
                  className={`px-2 sm:px-3.5 py-2 sm:py-1.5 text-[11px] sm:text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap ${
                    librarySubTab === 'saved-songs'
                      ? 'bg-emerald-500 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Heart className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    Saved ({savedLibrarySongs.length})
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setLibrarySubTab('auto-cache')}
                  className={`px-2 sm:px-3.5 py-2 sm:py-1.5 text-[11px] sm:text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap ${
                    librarySubTab === 'auto-cache'
                      ? 'bg-emerald-500 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <HardDrive className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    Cached ({autoCachedSongs.length})
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setLibrarySubTab('keep-notes')}
                  className={`px-2 sm:px-3.5 py-2 sm:py-1.5 text-[11px] sm:text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap ${
                    librarySubTab === 'keep-notes'
                      ? 'bg-emerald-500 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <StickyNote className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    Keep ({keepNotes.length})
                  </span>
                </button>
              </div>
            </div>

            {/* SUB-TAB 1: SAVED LIBRARY SONGS */}
            {librarySubTab === 'saved-songs' && (
              <section className="space-y-5">
                {savedLibrarySongs.length === 0 ? (
                  <div className="rounded-xl border border-slate-800/80 bg-slate-900/30 p-10 text-center space-y-3">
                    <Heart className="w-6 h-6 text-slate-500 mx-auto" />
                    <p className="text-sm text-slate-300">
                      Your Library has no saved songs yet.
                    </p>
                    <p className="text-xs text-slate-500">
                      Click &ldquo;+ Library&rdquo; on any song in Home or
                      Search, or promote a song from your Auto-Cached Recent
                      Hearing list.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveSection('home')}
                      className="px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 rounded-lg"
                    >
                      Browse Home Recommendations
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {savedLibrarySongs.map((song) => {
                      const isCurrent =
                        Boolean(song.videoId) &&
                        currentTrack?.videoId === song.videoId;
                      return (
                        <div
                          key={song.id}
                          className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-4 flex flex-col justify-between gap-4"
                        >
                          <div className="flex items-start gap-3.5">
                            {song.thumbnailUrl ? (
                              <img
                                src={song.thumbnailUrl}
                                alt={song.title}
                                referrerPolicy="no-referrer"
                                className="w-14 h-14 rounded-lg object-cover border border-slate-800 shrink-0"
                              />
                            ) : (
                              <div className="w-14 h-14 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                                <Radio className="w-5 h-5 text-emerald-400" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-emerald-400">
                                Saved in Library · YouTube Music
                              </p>
                              <h3 className="text-sm font-semibold text-white line-clamp-2 mt-0.5">
                                {song.title}
                              </h3>
                              <p className="text-xs text-slate-400 truncate mt-0.5">
                                {song.artist} · {song.genre}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-3 border-t border-slate-800/70">
                            <button
                              type="button"
                              onClick={() =>
                                setSavedLibrarySongs((prev) =>
                                  prev.filter((s) => s.id !== song.id)
                                )
                              }
                              className="text-xs text-slate-400 hover:text-rose-400 transition-colors"
                            >
                              Remove
                            </button>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  handleAddSongToSelectedPlaylist(song);
                                  setActiveSection('create-playlist');
                                }}
                                className="px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 rounded-md"
                              >
                                + Playlist
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (song.videoId) {
                                    handlePlayYouTubeTrack({
                                      videoId: song.videoId,
                                      title: song.title,
                                      channelTitle: song.artist,
                                      thumbnailUrl: song.thumbnailUrl,
                                      publishedAt: song.addedAt,
                                      sourceType: 'liked',
                                      matchReason: 'Played from Your Library',
                                      matchScore: 99,
                                    });
                                  }
                                }}
                                className="px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-md flex items-center gap-1"
                              >
                                {isCurrent && isPlaying ? (
                                  <>
                                    <Pause className="w-3.5 h-3.5 fill-current" />
                                    <span>Pause</span>
                                  </>
                                ) : (
                                  <>
                                    <Play className="w-3.5 h-3.5 fill-current" />
                                    <span>Play</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* SUB-TAB 2: AUTO-CACHING WITH RECENT HEARING SONGS */}
            {librarySubTab === 'auto-cache' && (
              <section className="space-y-6">
                {/* Auto-Cache Control & Storage Status Bar */}
                <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <HardDrive className="w-4 h-4 text-emerald-400" />
                      <h2 className="text-base font-bold text-white">
                        Auto-Cache Recent Hearing Songs
                      </h2>
                    </div>
                    <p className="text-xs text-slate-400 max-w-2xl">
                      When enabled, every YouTube Music song you listen to is
                      automatically cached locally with its stream pointer,
                      artwork, and mood context for instant replay.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 shrink-0">
                    <div className="text-right font-mono-tabular">
                      <p className="text-xs text-slate-400">Cache Footprint</p>
                      <p className="text-sm font-bold text-emerald-400">
                        {autoCachedSongs.length} / {autoCacheLimit} Songs ·{' '}
                        {totalCacheSizeMb} MB
                      </p>
                    </div>

                    <select
                      value={autoCacheLimit}
                      onChange={(e) =>
                        setAutoCacheLimit(Number(e.target.value))
                      }
                      aria-label="Auto-cache song limit"
                      className="px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
                    >
                      <option value={20}>Max 20 Songs</option>
                      <option value={50}>Max 50 Songs</option>
                      <option value={100}>Max 100 Songs</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => setAutoCacheEnabled((v) => !v)}
                      className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
                        autoCacheEnabled
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {autoCacheEnabled
                        ? 'Auto-Cache: ON'
                        : 'Auto-Cache: PAUSED'}
                    </button>

                    {autoCachedSongs.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setIsConfirmClearCacheOpen(true)}
                        className="px-3 py-2 text-xs font-medium text-slate-300 hover:text-rose-400 bg-slate-950 border border-slate-800 rounded-lg transition-colors"
                      >
                        Purge Cache
                      </button>
                    )}
                  </div>
                </div>

                {/* Auto-Cached Recent Hearing List (Mobile Card List + Desktop Table) */}
                {autoCachedSongs.length === 0 ? (
                  <div className="rounded-xl border border-slate-800/80 bg-slate-900/30 p-8 sm:p-10 text-center space-y-3">
                    <p className="text-sm text-slate-300">
                      No recent hearing songs cached yet.
                    </p>
                    <p className="text-xs text-slate-500">
                      Play any track on Home or Search to automatically cache it
                      here.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Mobile Card List (< md) */}
                    <div className="md:hidden space-y-3">
                      {autoCachedSongs.map((cached) => {
                        const inLib = cached.videoId
                          ? isYtTrackInLibrary(cached.videoId)
                          : false;
                        return (
                          <div
                            key={`mob-cache-${cached.id}`}
                            className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-3.5 space-y-3"
                          >
                            <div className="flex items-center gap-3">
                              {cached.thumbnailUrl ? (
                                <img
                                  src={cached.thumbnailUrl}
                                  alt={cached.title}
                                  referrerPolicy="no-referrer"
                                  className="w-12 h-12 rounded-lg object-cover shrink-0"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                                  <HardDrive className="w-4 h-4 text-emerald-400" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-white truncate">
                                  {cached.title}
                                </p>
                                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                  {cached.artist} · {cached.moodAtPlay}
                                </p>
                                <p className="text-[11px] font-mono-tabular text-emerald-400 mt-0.5">
                                  Heard {cached.playCount}x ·{' '}
                                  {(cached.cacheSizeKb / 1024).toFixed(2)} MB
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between pt-2.5 border-t border-slate-800/70 gap-2">
                              {!inLib ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newLibItem: LibrarySongItem = {
                                      id: `lib-promoted-${cached.id}`,
                                      videoId: cached.videoId,
                                      title: cached.title,
                                      artist: cached.artist,
                                      genre: cached.genre,
                                      thumbnailUrl: cached.thumbnailUrl,
                                      addedAt: new Date().toISOString(),
                                      source: 'youtube-music',
                                    };
                                    setSavedLibrarySongs((prev) => [
                                      newLibItem,
                                      ...prev,
                                    ]);
                                  }}
                                  className="px-2.5 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 rounded-md"
                                >
                                  + Save to Library
                                </button>
                              ) : (
                                <span className="text-xs text-emerald-400">
                                  Saved in Library
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  if (cached.videoId) {
                                    handlePlayYouTubeTrack({
                                      videoId: cached.videoId,
                                      title: cached.title,
                                      channelTitle: cached.artist,
                                      thumbnailUrl: cached.thumbnailUrl,
                                      publishedAt: cached.lastHeardAt,
                                      sourceType: 'recommended',
                                      matchReason:
                                        'Instant Replay from Auto-Cache',
                                      matchScore: 99,
                                    });
                                  }
                                }}
                                className="px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-md"
                              >
                                Instant Play
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Desktop Table (md+) */}
                    <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-900/30">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-800/80 text-[11px] font-medium text-slate-400">
                            <th className="py-3 px-4">Recently Heard Song</th>
                            <th className="py-3 px-4">Mood Context</th>
                            <th className="py-3 px-4 text-right">Plays</th>
                            <th className="py-3 px-4 text-right">Cached Size</th>
                            <th className="py-3 px-4 text-right">Last Heard</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 text-sm">
                          {autoCachedSongs.map((cached) => {
                            const inLib = cached.videoId
                              ? isYtTrackInLibrary(cached.videoId)
                              : false;
                            return (
                              <tr
                                key={cached.id}
                                className="hover:bg-slate-900/60 transition-colors"
                              >
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-3">
                                    {cached.thumbnailUrl ? (
                                      <img
                                        src={cached.thumbnailUrl}
                                        alt={cached.title}
                                        referrerPolicy="no-referrer"
                                        className="w-10 h-10 rounded-md object-cover shrink-0"
                                      />
                                    ) : (
                                      <div className="w-10 h-10 rounded-md bg-slate-800 flex items-center justify-center shrink-0">
                                        <HardDrive className="w-4 h-4 text-emerald-400" />
                                      </div>
                                    )}
                                    <div className="min-w-0">
                                      <p className="font-semibold text-white truncate max-w-xs">
                                        {cached.title}
                                      </p>
                                      <p className="text-xs text-slate-400 truncate">
                                        {cached.artist} · {cached.genre}
                                      </p>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-xs text-slate-300">
                                  {cached.moodAtPlay}
                                </td>
                                <td className="py-3 px-4 text-right font-mono-tabular text-xs text-emerald-400">
                                  {cached.playCount}x
                                </td>
                                <td className="py-3 px-4 text-right font-mono-tabular text-xs text-slate-300">
                                  {(cached.cacheSizeKb / 1024).toFixed(2)} MB
                                </td>
                                <td className="py-3 px-4 text-right font-mono-tabular text-xs text-slate-400">
                                  {new Date(cached.lastHeardAt).toLocaleTimeString(
                                    [],
                                    {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    }
                                  )}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    {!inLib && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const newLibItem: LibrarySongItem = {
                                            id: `lib-promoted-${cached.id}`,
                                            videoId: cached.videoId,
                                            title: cached.title,
                                            artist: cached.artist,
                                            genre: cached.genre,
                                            thumbnailUrl: cached.thumbnailUrl,
                                            addedAt: new Date().toISOString(),
                                            source: 'youtube-music',
                                          };
                                          setSavedLibrarySongs((prev) => [
                                            newLibItem,
                                            ...prev,
                                          ]);
                                        }}
                                        className="px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 rounded-md"
                                      >
                                        + Save to Library
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (cached.videoId) {
                                          handlePlayYouTubeTrack({
                                            videoId: cached.videoId,
                                            title: cached.title,
                                            channelTitle: cached.artist,
                                            thumbnailUrl: cached.thumbnailUrl,
                                            publishedAt: cached.lastHeardAt,
                                            sourceType: 'recommended',
                                            matchReason:
                                              'Instant Replay from Auto-Cache',
                                            matchScore: 99,
                                          });
                                        }
                                      }}
                                      className="px-3 py-1 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-md"
                                    >
                                      Instant Play
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </section>
            )}

            {/* SUB-TAB 3: GOOGLE KEEP MOOD & LYRIC NOTES */}
            {librarySubTab === 'keep-notes' && (
              <section className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <p className="text-xs text-slate-400">
                    Link any Google Keep note below to steer your Home YouTube
                    Music recommendations.
                  </p>
                  <div className="flex items-center gap-3">
                    {!needsAuth && (
                      <>
                        <button
                          type="button"
                          onClick={handleSyncKeepNotes}
                          disabled={isSyncingKeep}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-900 border border-slate-700 rounded-lg flex items-center gap-1.5"
                        >
                          <RefreshCw
                            className={`w-3.5 h-3.5 ${
                              isSyncingKeep ? 'animate-spin' : ''
                            }`}
                          />
                          <span>Sync Keep Notes</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => logout()}
                          className="px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-lg flex items-center gap-1.5"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Sign Out</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {keepStatusBanner && (
                  <div className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-2.5 text-xs text-slate-300 flex items-center justify-between">
                    <span>{keepStatusBanner}</span>
                    <button
                      type="button"
                      onClick={() => setKeepStatusBanner(null)}
                      className="text-slate-400 hover:text-white"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  <form
                    onSubmit={handleCreateKeepNote}
                    className="lg:col-span-5 rounded-xl border border-slate-800/80 bg-slate-900/40 p-6 space-y-4 h-fit"
                  >
                    <h3 className="text-base font-semibold text-white">
                      New Google Keep Mood Note
                    </h3>
                    <input
                      type="text"
                      value={newNoteTitle}
                      onChange={(e) => setNewNoteTitle(e.target.value)}
                      placeholder="Note Title (e.g., Late Night Bengali & Lo-Fi Mix)"
                      className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white"
                    />
                    <textarea
                      rows={4}
                      value={newNoteBody}
                      onChange={(e) => setNewNoteBody(e.target.value)}
                      placeholder="Write your mood reflection or song notes..."
                      className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white"
                    />
                    <button
                      type="submit"
                      disabled={isCreatingNote}
                      className="w-full px-4 py-2.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg"
                    >
                      {isCreatingNote
                        ? 'Saving Note...'
                        : 'Save Note & Use for Recommendations'}
                    </button>
                  </form>

                  <div className="lg:col-span-7 space-y-4">
                    {keepNotes.map((note) => {
                      const isSelected = activeKeepNoteId === note.id;
                      return (
                        <div
                          key={note.id}
                          className={`rounded-xl border p-5 space-y-3 ${
                            isSelected
                              ? 'border-emerald-500/60 bg-slate-900/80'
                              : 'border-slate-800/80 bg-slate-900/35'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h4 className="text-base font-semibold text-white">
                                {note.title}
                              </h4>
                              <p className="text-xs text-slate-400 font-mono-tabular">
                                {new Date(note.updatedAt).toLocaleDateString()}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setNotePendingDelete(note)}
                              className="text-slate-400 hover:text-rose-400"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <p className="text-sm text-slate-300">{note.body}</p>
                          <div className="flex justify-end pt-2 border-t border-slate-800/70">
                            <button
                              type="button"
                              onClick={() =>
                                setActiveKeepNoteId(isSelected ? null : note.id)
                              }
                              className={`px-3 py-1.5 text-xs font-semibold rounded-md ${
                                isSelected
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-slate-800 text-slate-200'
                              }`}
                            >
                              {isSelected
                                ? 'Active in Recommendations'
                                : 'Use for Recommendations'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}
          </div>
        )}

        {/* =========================================================
            SECTION 4: CREATE PLAYLIST (Custom Playlist Studio & Song Builder)
           ========================================================= */}
        {activeSection === 'create-playlist' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Create New Playlist Form + User's Playlists List */}
            <div className="lg:col-span-4 space-y-6">
              <form
                onSubmit={handleCreateNewPlaylist}
                className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-6 space-y-4"
              >
                <div className="flex items-center gap-2">
                  <FolderPlus className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-base font-bold text-white">
                    Create New Playlist
                  </h2>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs text-slate-400">
                    Playlist Title
                  </label>
                  <input
                    type="text"
                    required
                    value={newPlaylistName}
                    onChange={(e) => setNewPlaylistName(e.target.value)}
                    placeholder="e.g., Monsoon Hindi & Bangla Acoustic"
                    className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs text-slate-400">
                    Description
                  </label>
                  <input
                    type="text"
                    value={newPlaylistDesc}
                    onChange={(e) => setNewPlaylistDesc(e.target.value)}
                    placeholder="Personal mix for evening drives & focus"
                    className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs text-slate-400">
                    Target Mood Profile
                  </label>
                  <select
                    value={newPlaylistMood}
                    onChange={(e) => setNewPlaylistMood(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white"
                  >
                    {MOOD_PRESETS.map((m) => (
                      <option key={m.presetName} value={m.presetName}>
                        {m.presetName}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full px-4 py-2.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Playlist</span>
                </button>
              </form>

              {/* Existing Playlists Selector */}
              <div className="rounded-xl border border-slate-800/80 bg-slate-900/35 p-5 space-y-3">
                <h3 className="text-sm font-bold text-white">
                  Your Playlists ({playlists.length})
                </h3>
                <div className="space-y-2">
                  {playlists.map((pl) => {
                    const isSelected = selectedPlaylist?.id === pl.id;
                    return (
                      <div
                        key={pl.id}
                        className={`rounded-lg border p-3 transition-colors flex items-center justify-between gap-2 ${
                          isSelected
                            ? 'border-emerald-500/60 bg-slate-900'
                            : 'border-slate-800/70 bg-slate-950/50 hover:bg-slate-900/60'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedPlaylistId(pl.id)}
                          className="text-left min-w-0 flex-1"
                        >
                          <p className="text-sm font-semibold text-white truncate">
                            {pl.name}
                          </p>
                          <p className="text-xs text-slate-400 font-mono-tabular">
                            {pl.songs.length} Songs · {pl.moodTag}
                          </p>
                        </button>
                        {playlists.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setPlaylistPendingDelete(pl)}
                            aria-label={`Delete playlist ${pl.name}`}
                            className="p-1.5 text-slate-400 hover:text-rose-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Column: Active Playlist Songs + Add Songs from YouTube / Library / Auto-Cache */}
            <div className="lg:col-span-8 space-y-6">
              {selectedPlaylist && (
                <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-6 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
                    <div>
                      <p className="text-xs text-emerald-400 font-medium">
                        Active Playlist · {selectedPlaylist.moodTag}
                      </p>
                      <h2 className="text-2xl font-bold text-white mt-0.5">
                        {selectedPlaylist.name}
                      </h2>
                      <p className="text-xs text-slate-400 mt-1">
                        {selectedPlaylist.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      {selectedPlaylist.songs.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const first = selectedPlaylist.songs[0];
                            if (first.videoId) {
                              handlePlayYouTubeTrack({
                                videoId: first.videoId,
                                title: first.title,
                                channelTitle: first.artist,
                                thumbnailUrl: first.thumbnailUrl,
                                publishedAt: first.addedAt,
                                sourceType: 'liked',
                                matchReason: `Playing from playlist "${selectedPlaylist.name}"`,
                                matchScore: 99,
                              });
                            }
                          }}
                          className="px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg flex items-center gap-1.5"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Play Playlist</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setNewNoteTitle(`Playlist: ${selectedPlaylist.name}`);
                          setNewNoteBody(
                            `${selectedPlaylist.description}\nTracks:\n` +
                              selectedPlaylist.songs
                                .map(
                                  (s, i) => `${i + 1}. ${s.title} — ${s.artist}`
                                )
                                .join('\n')
                          );
                          setActiveSection('library');
                          setLibrarySubTab('keep-notes');
                        }}
                        className="px-3 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg"
                      >
                        Save to Google Keep
                      </button>
                    </div>
                  </div>

                  {/* Songs Inside Selected Playlist */}
                  {selectedPlaylist.songs.length === 0 ? (
                    <div className="rounded-lg border border-slate-800/70 bg-slate-950/50 p-6 text-center text-xs text-slate-400">
                      This playlist is empty. Search and add any YouTube Music
                      song below or quick-add from your Auto-Cached Recent
                      Hearing songs.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-800/70">
                      {selectedPlaylist.songs.map((song, idx) => (
                        <div
                          key={`${song.id}-${idx}`}
                          className="py-3 flex items-center justify-between gap-4"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-xs font-mono-tabular text-slate-500 w-5">
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                            {song.thumbnailUrl ? (
                              <img
                                src={song.thumbnailUrl}
                                alt={song.title}
                                referrerPolicy="no-referrer"
                                className="w-10 h-10 rounded-md object-cover shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-md bg-slate-800 flex items-center justify-center shrink-0">
                                <ListMusic className="w-4 h-4 text-emerald-400" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-white truncate">
                                {song.title}
                              </p>
                              <p className="text-xs text-slate-400 truncate">
                                {song.artist} · {song.genre}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                if (song.videoId) {
                                  handlePlayYouTubeTrack({
                                    videoId: song.videoId,
                                    title: song.title,
                                    channelTitle: song.artist,
                                    thumbnailUrl: song.thumbnailUrl,
                                    publishedAt: song.addedAt,
                                    sourceType: 'liked',
                                    matchReason: `Playlist: ${selectedPlaylist.name}`,
                                    matchScore: 98,
                                  });
                                }
                              }}
                              className="px-3 py-1 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-md"
                            >
                              Play
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleRemoveSongFromPlaylist(
                                  selectedPlaylist.id,
                                  song.id
                                )
                              }
                              className="p-1.5 text-slate-400 hover:text-rose-400"
                              aria-label="Remove from playlist"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Songs to Playlist via Live YouTube Music Search */}
                  <div className="pt-4 border-t border-slate-800/80 space-y-4">
                    <h3 className="text-sm font-bold text-white">
                      Search & Add Songs to &ldquo;{selectedPlaylist.name}&rdquo;
                    </h3>
                    <form
                      onSubmit={handleSearchSongsForPlaylist}
                      className="flex items-center gap-2"
                    >
                      <input
                        type="text"
                        value={playlistSearchQuery}
                        onChange={(e) => setPlaylistSearchQuery(e.target.value)}
                        placeholder="Search any song on YouTube Music to add to this playlist..."
                        className="flex-1 px-3.5 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white"
                      />
                      <button
                        type="submit"
                        disabled={isSearchingForPlaylist}
                        className="px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg whitespace-nowrap shrink-0"
                      >
                        {isSearchingForPlaylist ? 'Searching...' : 'Find Songs'}
                      </button>
                    </form>

                    {playlistSearchResults.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        {playlistSearchResults.slice(0, 6).map((yt) => (
                          <div
                            key={`pl-search-${yt.videoId}`}
                            className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-white truncate">
                                {yt.title}
                              </p>
                              <p className="text-[11px] text-slate-400 truncate">
                                {yt.channelTitle}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                handleAddSongToSelectedPlaylist({
                                  id: `pl-yt-${yt.videoId}`,
                                  videoId: yt.videoId,
                                  title: yt.title,
                                  artist: yt.channelTitle,
                                  genre: 'YouTube Music',
                                  thumbnailUrl: yt.thumbnailUrl,
                                  addedAt: new Date().toISOString(),
                                  source: 'youtube-music',
                                })
                              }
                              className="px-2.5 py-1 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-md shrink-0"
                            >
                              + Add
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Quick Add from Auto-Cached Recent Hearing Songs */}
                    {autoCachedSongs.length > 0 && (
                      <div className="space-y-2 pt-2">
                        <p className="text-xs font-medium text-slate-400">
                          Quick Add from Your Auto-Cached Recent Hearing Songs:
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {autoCachedSongs.slice(0, 4).map((cached) => (
                            <div
                              key={`quick-cache-${cached.id}`}
                              className="rounded-lg border border-slate-800/70 bg-slate-950/40 p-2.5 flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-white truncate">
                                  {cached.title}
                                </p>
                                <p className="text-[11px] text-slate-400 truncate">
                                  {cached.artist}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  handleAddSongToSelectedPlaylist({
                                    id: `pl-cache-${cached.id}`,
                                    videoId: cached.videoId,
                                    title: cached.title,
                                    artist: cached.artist,
                                    genre: cached.genre,
                                    thumbnailUrl: cached.thumbnailUrl,
                                    addedAt: new Date().toISOString(),
                                    source: 'youtube-music',
                                  })
                                }
                                className="px-2.5 py-1 text-xs font-medium text-emerald-400 hover:bg-slate-800 rounded-md shrink-0"
                              >
                                + Add
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Mandatory Confirmation Dialog for Deleting Google Keep Note */}
      <ConfirmModal
        isOpen={notePendingDelete !== null}
        title={`Delete "${notePendingDelete?.title || 'Note'}" from Google Keep?`}
        description="This will permanently remove this mood note from your Google Keep notes list. This action cannot be undone."
        confirmLabel="Confirm Delete"
        onConfirm={async () => {
          if (!notePendingDelete) return;
          const target = notePendingDelete;
          setNotePendingDelete(null);
          await deleteGoogleKeepNote(target);
          setKeepNotes((prev) => prev.filter((n) => n.id !== target.id));
        }}
        onCancel={() => setNotePendingDelete(null)}
      />

      {/* Confirmation Dialog for Purging Auto-Cache */}
      <ConfirmModal
        isOpen={isConfirmClearCacheOpen}
        title="Purge Auto-Cached Recent Hearing Songs?"
        description={`This will clear ${autoCachedSongs.length} auto-cached song(s) (${totalCacheSizeMb} MB) from local cache storage.`}
        confirmLabel="Purge Cache"
        onConfirm={() => {
          setAutoCachedSongs([]);
          setIsConfirmClearCacheOpen(false);
        }}
        onCancel={() => setIsConfirmClearCacheOpen(false)}
      />

      {/* Confirmation Dialog for Deleting a Custom Playlist */}
      <ConfirmModal
        isOpen={playlistPendingDelete !== null}
        title={`Delete playlist "${playlistPendingDelete?.name || ''}"?`}
        description="This will permanently remove this custom playlist. Songs saved in your Library will not be deleted."
        confirmLabel="Delete Playlist"
        onConfirm={() => {
          if (!playlistPendingDelete) return;
          const targetId = playlistPendingDelete.id;
          setPlaylistPendingDelete(null);
          setPlaylists((prev) => {
            const remaining = prev.filter((p) => p.id !== targetId);
            if (selectedPlaylistId === targetId && remaining[0]) {
              setSelectedPlaylistId(remaining[0].id);
            }
            return remaining;
          });
        }}
        onCancel={() => setPlaylistPendingDelete(null)}
      />

      {/* Android PWA Installation & QR Code Modal */}
      <AndroidInstallModal
        isOpen={isAndroidModalOpen}
        onClose={() => setIsAndroidModalOpen(false)}
        isInstallable={isInstallable}
        isInstalled={isInstalled}
        onPromptInstall={promptInstall}
      />

      {/* Bottom Audio Playback Bar (Controls hidden YouTube Music stream directly, no video popup) */}
      <PlayerBar
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        isRepeat={isRepeat}
        isSavedInLibrary={
          currentTrack ? isYtTrackInLibrary(currentTrack.videoId) : false
        }
        onTogglePlay={() => {
          if (currentTrack) {
            ytAudioController.togglePlayPause(currentTrack);
          }
        }}
        onPrev={handlePrevTrack}
        onNext={handleNextTrack}
        onToggleRepeat={() => setIsRepeat((r) => !r)}
        onSeek={(sec) => ytAudioController.seek(sec)}
        onToggleSaveLibrary={handleToggleYtLibrary}
        onQuickSaveToKeep={handleSaveYouTubeTrackToKeep}
      />
    </div>
  );
}
