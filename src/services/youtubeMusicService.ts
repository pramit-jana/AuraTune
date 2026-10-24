import {
  YouTubeMusicTrack,
  YouTubeMusicPlaylist,
  ListeningHistoryEntry,
  MoodProfile,
  KeepNoteItem,
  LearnedListeningProfile,
} from '../types/music';
import {
  buildLearnedSummaryPayload,
  inferGenreAndKeywords,
  scoreAndRankTracks,
  filterOutPlayedAndDuplicateTracks,
  PlayedSongSignature,
} from './listeningPatternLearner';

function buildPlayedSignaturesFromHistory(
  history: ListeningHistoryEntry[],
  currentTrack?: YouTubeMusicTrack | null,
  extraSignatures: PlayedSongSignature[] = []
): PlayedSongSignature[] {
  const signatures: PlayedSongSignature[] = [...extraSignatures];

  if (currentTrack) {
    signatures.push({
      videoId: currentTrack.videoId,
      title: currentTrack.title,
      artist: currentTrack.channelTitle,
      durationSec: currentTrack.durationSec,
    });
  }

  for (const h of history) {
    signatures.push({
      videoId: h.youtubeVideoId || h.trackId,
      title: h.title,
      artist: h.artist,
      durationSec: h.durationSec,
    });
  }

  return signatures;
}

export async function fetchPersonalizedYouTubeMusic(
  mood: MoodProfile,
  history: ListeningHistoryEntry[],
  activeNote: KeepNoteItem | null,
  customSearchQuery?: string,
  learnedProfile?: LearnedListeningProfile,
  currentTrack?: YouTubeMusicTrack | null,
  extraPlayedSignatures: PlayedSongSignature[] = []
): Promise<{
  recommendedTracks: YouTubeMusicTrack[];
  likedTracks: YouTubeMusicTrack[];
  playlists: YouTubeMusicPlaylist[];
  queryUsed: string;
}> {
  const learnedSummary = learnedProfile
    ? buildLearnedSummaryPayload(learnedProfile)
    : undefined;

  const response = await fetch('/api/youtube/discover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      moodProfile: mood,
      listeningHistory: history,
      activeKeepNote: activeNote,
      customSearch: customSearchQuery,
      learnedSummary,
      currentTrack: currentTrack
        ? {
            videoId: currentTrack.videoId,
            title: currentTrack.title,
            channelTitle: currentTrack.channelTitle,
            categoryTag: currentTrack.categoryTag,
            durationSec: currentTrack.durationSec,
          }
        : undefined,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(
      errData?.error || `Failed to load music stream (${response.status})`
    );
  }

  const data = await response.json();

  const playedList = buildPlayedSignaturesFromHistory(
    history,
    currentTrack,
    extraPlayedSignatures
  );

  const rawRecommended: YouTubeMusicTrack[] = data.recommendedTracks || [];
  const rawLiked: YouTubeMusicTrack[] = data.likedTracks || [];

  // For custom search queries on the Search tab, only deduplicate within the batch;
  // for automatic recommendations & Next Suggested Songs, filter out any song already played before by title, artist, or duration.
  const filteredRecommended = customSearchQuery
    ? filterOutPlayedAndDuplicateTracks(rawRecommended, [])
    : filterOutPlayedAndDuplicateTracks(rawRecommended, playedList);

  const filteredLiked = filterOutPlayedAndDuplicateTracks(rawLiked, playedList);

  const recommendedTracks = learnedProfile
    ? scoreAndRankTracks(filteredRecommended, learnedProfile, mood)
    : filteredRecommended;
  const likedTracks = learnedProfile
    ? scoreAndRankTracks(filteredLiked, learnedProfile, mood)
    : filteredLiked;

  const playlists: YouTubeMusicPlaylist[] = [
    {
      id: 'yt-pl-focus',
      title: `${mood.presetName} — Personalized Mix`,
      description: 'Auto-curated from your learned listening pattern',
      itemCount: recommendedTracks.length,
      thumbnailUrl: recommendedTracks[0]?.thumbnailUrl || '',
    },
    {
      id: 'yt-pl-history',
      title: 'Listening Pattern Affinity Mix',
      description: `Matched to ${
        learnedSummary?.topGenres?.[0] || history[0]?.genre || 'Neo-Soul & Lo-Fi'
      }`,
      itemCount: likedTracks.length,
      thumbnailUrl: likedTracks[0]?.thumbnailUrl || '',
    },
  ];

  return {
    recommendedTracks,
    likedTracks,
    playlists,
    queryUsed: data.queryUsed || mood.presetName,
  };
}

export async function fetchNextSuggestedSongsForTrack(
  track: YouTubeMusicTrack,
  mood: MoodProfile,
  history: ListeningHistoryEntry[],
  learnedProfile?: LearnedListeningProfile,
  excludeVideoIds: string[] = [],
  extraPlayedSignatures: PlayedSongSignature[] = []
): Promise<YouTubeMusicTrack[]> {
  const cleanArtist = track.channelTitle.replace(' - Topic', '').trim();
  const { inferredGenre, keywords } = inferGenreAndKeywords(
    track.title,
    cleanArtist,
    track.categoryTag
  );

  const learnedSummary = learnedProfile
    ? buildLearnedSummaryPayload(learnedProfile)
    : undefined;

  const response = await fetch('/api/youtube/discover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      moodProfile: mood,
      listeningHistory: history,
      learnedSummary,
      currentTrack: {
        videoId: track.videoId,
        title: track.title,
        channelTitle: cleanArtist,
        categoryTag: inferredGenre,
        durationSec: track.durationSec,
        keywords,
      },
    }),
  });

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  const excludeSet = new Set([track.videoId, ...excludeVideoIds]);
  const combinedCandidates: YouTubeMusicTrack[] = [
    ...(data.likedTracks || []),
    ...(data.recommendedTracks || []),
  ].filter((item) => item && item.videoId && !excludeSet.has(item.videoId));

  const playedList = buildPlayedSignaturesFromHistory(
    history,
    track,
    extraPlayedSignatures
  );

  const uniqueUnplayed = filterOutPlayedAndDuplicateTracks(
    combinedCandidates,
    playedList
  );

  const ranked = learnedProfile
    ? scoreAndRankTracks(uniqueUnplayed, learnedProfile, mood)
    : uniqueUnplayed;

  return ranked.slice(0, 6);
}



