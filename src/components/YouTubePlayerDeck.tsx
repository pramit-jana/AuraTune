import React from 'react';
import { X, BookmarkPlus, ExternalLink, Radio, Heart, Check } from 'lucide-react';
import { YouTubeMusicTrack } from '../types/music';

interface YouTubePlayerDeckProps {
  track: YouTubeMusicTrack | null;
  isSavedInLibrary?: boolean;
  onClose: () => void;
  onToggleSaveLibrary?: (track: YouTubeMusicTrack) => void;
  onSaveToKeep: (track: YouTubeMusicTrack) => void;
}

export const YouTubePlayerDeck: React.FC<YouTubePlayerDeckProps> = ({
  track,
  isSavedInLibrary = false,
  onClose,
  onToggleSaveLibrary,
  onSaveToKeep,
}) => {
  if (!track) return null;

  return (
    <div className="rounded-xl border border-emerald-500/50 bg-slate-900/95 p-5 shadow-2xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3.5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
            <Radio className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-emerald-400">
              Now Streaming from YouTube Music · Auto-Cached in Recent Hearing
            </p>
            <h3 className="text-base font-bold text-white truncate">
              {track.title}
            </h3>
            <p className="text-xs text-slate-400 truncate">
              {track.channelTitle} · {track.matchReason}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onToggleSaveLibrary && (
            <button
              type="button"
              onClick={() => onToggleSaveLibrary(track)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                isSavedInLibrary
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              {isSavedInLibrary ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>In Library</span>
                </>
              ) : (
                <>
                  <Heart className="w-3.5 h-3.5" />
                  <span>Add to Library</span>
                </>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => onSaveToKeep(track)}
            className="px-3 py-1.5 text-xs font-medium text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <BookmarkPlus className="w-3.5 h-3.5 text-emerald-400" />
            <span>Save Note</span>
          </button>
          <a
            href={`https://music.youtube.com/watch?v=${encodeURIComponent(
              track.videoId
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <span>YT Music</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close YouTube Music player"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="aspect-video w-full max-h-[340px] overflow-hidden rounded-lg border border-slate-800 bg-black">
        <iframe
          className="w-full h-full"
          src={`https://www.youtube.com/embed/${encodeURIComponent(
            track.videoId
          )}?autoplay=1&rel=0&modestbranding=1`}
          title={track.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  );
};
