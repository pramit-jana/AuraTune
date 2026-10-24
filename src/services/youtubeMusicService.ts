import {
  YouTubeMusicTrack,
  YouTubeMusicPlaylist,
  ListeningHistoryEntry,
  MoodProfile,
  KeepNoteItem,
} from '../types/music';

export async function fetchPersonalizedYouTubeMusic(
  mood: MoodProfile,
  history: ListeningHistoryEntry[],
  activeNote: KeepNoteItem | null,
  customSearchQuery?: string
): Promise<{
  recommendedTracks: YouTubeMusicTrack[];
  likedTracks: YouTubeMusicTrack[];
  playlists: YouTubeMusicPlaylist[];
  queryUsed: string;
}> {
  const response = await fetch('/api/youtube/discover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      moodProfile: mood,
      listeningHistory: history,
      activeKeepNote: activeNote,
      customSearch: customSearchQuery,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(
      errData?.error || `Failed to load YouTube Music (${response.status})`
    );
  }

  const data = await response.json();

  const playlists: YouTubeMusicPlaylist[] = [
    {
      id: 'yt-pl-focus',
      title: `${mood.presetName} — YouTube Music Mix`,
      description: 'Auto-curated from your recent listening history',
      itemCount: (data.recommendedTracks || []).length,
      thumbnailUrl: data.recommendedTracks?.[0]?.thumbnailUrl || '',
    },
    {
      id: 'yt-pl-history',
      title: 'Listening History Affinity Mix',
      description: `Matched to ${history[0]?.genre || 'Neo-Soul & Lo-Fi'}`,
      itemCount: (data.likedTracks || []).length,
      thumbnailUrl: data.likedTracks?.[0]?.thumbnailUrl || '',
    },
  ];

  return {
    recommendedTracks: data.recommendedTracks || [],
    likedTracks: data.likedTracks || [],
    playlists,
    queryUsed: data.queryUsed || mood.presetName,
  };
}
