import {
  Track,
  MoodProfile,
  ListeningHistoryEntry,
  KeepNoteItem,
  RecommendationMix,
  RecommendationItem,
} from '../types/music';

/**
 * Deterministic harmonic & mood vector recommendation scorer for zero-latency updates
 * and fallback resilience.
 */
export function computeLocalRecommendations(
  catalog: Track[],
  moodProfile: MoodProfile,
  history: ListeningHistoryEntry[],
  activeKeepNote: KeepNoteItem | null
): RecommendationMix {
  const recentGenres = new Set(history.slice(0, 5).map((h) => h.genre));
  const recentTrackIds = new Set(history.slice(0, 2).map((h) => h.trackId));
  const noteKeywords = activeKeepNote
    ? `${activeKeepNote.title} ${activeKeepNote.body}`.toLowerCase()
    : '';

  const scored: RecommendationItem[] = catalog.map((track) => {
    const energyDiff = Math.abs(track.energy - moodProfile.energy);
    const valenceDiff = Math.abs(track.valence - moodProfile.valence);
    const focusDiff = Math.abs(track.focus - moodProfile.focus);
    const tempoDiff = Math.abs(track.bpm - moodProfile.tempo);

    // Base vector similarity (0 - 100)
    let rawScore =
      100 -
      (energyDiff * 0.32 +
        valenceDiff * 0.28 +
        focusDiff * 0.25 +
        tempoDiff * 0.25);

    const reasons: string[] = [];

    // History affinity boost
    if (recentGenres.has(track.genre)) {
      rawScore += 6;
      reasons.push(`aligns with your recent ${track.genre} sessions`);
    }

    // Slight variety nudge if played very recently
    if (recentTrackIds.has(track.id)) {
      rawScore -= 3;
    }

    // Google Keep note semantic matching
    if (noteKeywords) {
      const matchedTag = track.moodTags.find((tag) =>
        noteKeywords.includes(tag.toLowerCase())
      );
      if (
        matchedTag ||
        noteKeywords.includes(track.genre.toLowerCase()) ||
        (noteKeywords.includes('focus') && track.focus >= 80) ||
        (noteKeywords.includes('warm') && track.valence >= 65) ||
        (noteKeywords.includes('rain') && track.energy <= 40)
      ) {
        rawScore += 8;
        reasons.push(`resonates with your Keep note "${activeKeepNote?.title}"`);
      }
    }

    if (reasons.length === 0) {
      if (Math.abs(track.focus - moodProfile.focus) <= 12) {
        reasons.push(
          `matches your ${moodProfile.focus}% focus target at ${track.bpm} BPM in ${track.key}`
        );
      } else {
        reasons.push(
          `balances ${track.energy}% energy and ${track.valence}% warmth for ${moodProfile.presetName}`
        );
      }
    }

    const clampedScore = Math.max(76, Math.min(99, Math.round(rawScore)));

    return {
      trackId: track.id,
      matchScore: clampedScore,
      reason: `Selected because it ${reasons.join(' and ')}.`,
    };
  });

  scored.sort((a, b) => b.matchScore - a.matchScore);

  const topSix = scored.slice(0, 6);
  const noteSuffix = activeKeepNote
    ? ` and your Keep note "${activeKeepNote.title}"`
    : '';

  return {
    mixTitle: `${moodProfile.presetName} Mix`,
    mixSummary: `Tailored to your ${moodProfile.tempo} BPM target, ${history.length} logged listening sessions${noteSuffix}.`,
    recommendations: topSix,
    source: 'harmonic-engine',
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Calls the server-side Gemini recommendation endpoint (/api/recommendations)
 * and merges with local fallback if needed.
 */
export async function fetchAiRecommendations(
  catalog: Track[],
  moodProfile: MoodProfile,
  history: ListeningHistoryEntry[],
  activeKeepNote: KeepNoteItem | null
): Promise<RecommendationMix> {
  const response = await fetch('/api/recommendations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      moodProfile,
      listeningHistory: history,
      activeKeepNote,
      catalog: catalog.map((t) => ({
        id: t.id,
        title: t.title,
        artist: t.artist,
        genre: t.genre,
        bpm: t.bpm,
        key: t.key,
        energy: t.energy,
        valence: t.valence,
        focus: t.focus,
        moodTags: t.moodTags,
      })),
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Server returned ${response.status}`);
  }

  const data = await response.json();
  const validIds = new Set(catalog.map((t) => t.id));
  const validRecs = (data.recommendations || []).filter((r: RecommendationItem) =>
    validIds.has(r.trackId)
  );

  if (validRecs.length === 0) {
    return computeLocalRecommendations(catalog, moodProfile, history, activeKeepNote);
  }

  return {
    mixTitle: data.mixTitle || `${moodProfile.presetName} Selection`,
    mixSummary: data.mixSummary || 'Curated from your listening history and mood profile.',
    recommendations: validRecs,
    source: 'gemini',
    generatedAt: new Date().toISOString(),
  };
}
