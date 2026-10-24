import React, { useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Repeat,
  BookmarkPlus,
  Heart,
  Check,
  Radio,
} from 'lucide-react';
import { YouTubeMusicTrack } from '../types/music';
import { ytAudioController } from '../services/ytAudioController';

interface PlayerBarProps {
  currentTrack: YouTubeMusicTrack | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isRepeat: boolean;
  isSavedInLibrary: boolean;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onToggleRepeat: () => void;
  onSeek: (sec: number) => void;
  onToggleSaveLibrary: (track: YouTubeMusicTrack) => void;
  onQuickSaveToKeep: (track: YouTubeMusicTrack) => void;
}

export function formatTimecode(seconds: number): string {
  if (!seconds || !Number.isFinite(seconds) || seconds < 0) return '00:00';
  const s = Math.floor(seconds);
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const PlayerBar: React.FC<PlayerBarProps> = ({
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  isRepeat,
  isSavedInLibrary,
  onTogglePlay,
  onPrev,
  onNext,
  onToggleRepeat,
  onSeek,
  onToggleSaveLibrary,
  onQuickSaveToKeep,
}) => {
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (val > 0 && isMuted) {
      setIsMuted(false);
      ytAudioController.setMuted(false);
    }
    ytAudioController.setVolume(val);
  };

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    ytAudioController.setMuted(nextMuted);
  };

  if (!currentTrack) return null;

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-800/90 bg-slate-950/95 backdrop-blur-md px-3.5 py-2 sm:px-6 sm:py-3">
      {/* MOBILE MINI-PLAYER (< md) optimized for 6.2-inch Android screens */}
      <div className="md:hidden space-y-1.5">
        {/* Compact Scrubber Row */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono-tabular text-slate-400 w-8">
            {formatTimecode(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={duration > 0 ? duration : 240}
            step={1}
            value={currentTime}
            onChange={(e) => onSeek(parseFloat(e.target.value))}
            aria-label="Seek timeline"
            className="mood-slider flex-1"
          />
          <span className="text-[10px] font-mono-tabular text-slate-400 w-8 text-right">
            {duration > 0 ? formatTimecode(duration) : 'LIVE'}
          </span>
        </div>

        {/* Main Track Info + Transport Row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {currentTrack.thumbnailUrl ? (
              <img
                src={currentTrack.thumbnailUrl}
                alt={currentTrack.title}
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-lg object-cover border border-slate-800 shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0">
                <Radio className="w-4 h-4 text-emerald-400" />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-100 truncate">
                {currentTrack.title}
              </p>
              <p className="text-[11px] text-slate-400 truncate">
                {currentTrack.channelTitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onToggleSaveLibrary(currentTrack)}
              title={isSavedInLibrary ? 'Saved in Library' : 'Add to Library'}
              className={`p-2 rounded-lg transition-colors ${
                isSavedInLibrary
                  ? 'text-emerald-400 bg-emerald-500/15'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {isSavedInLibrary ? (
                <Check className="w-4 h-4" />
              ) : (
                <Heart className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={onPrev}
              aria-label="Previous track"
              className="p-2 text-slate-300 hover:text-white transition-colors"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onTogglePlay}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="w-9 h-9 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center transition-transform active:scale-95 shadow-sm"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={onNext}
              aria-label="Next track"
              className="p-2 text-slate-300 hover:text-white transition-colors"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* DESKTOP 12-COLUMN PLAYER (md+) */}
      <div className="hidden md:grid mx-auto max-w-[1400px] md:grid-cols-12 items-center gap-4">
        {/* Left: Active YouTube Music Track Artwork, Title, Artist & Library/Keep Actions */}
        <div className="md:col-span-4 flex items-center gap-3.5 min-w-0">
          {currentTrack.thumbnailUrl ? (
            <img
              src={currentTrack.thumbnailUrl}
              alt={currentTrack.title}
              referrerPolicy="no-referrer"
              className="w-12 h-12 rounded-lg object-cover border border-slate-800 shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0">
              <Radio className="w-5 h-5 text-emerald-400" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-100 truncate">
              {currentTrack.title}
            </p>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 truncate mt-0.5">
              <span className="truncate">{currentTrack.channelTitle}</span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-400">Hi-Fi Audio Stream</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onToggleSaveLibrary(currentTrack)}
              title={isSavedInLibrary ? 'Saved in Library' : 'Add to Library'}
              className={`p-2 rounded-lg border transition-colors ${
                isSavedInLibrary
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400'
                  : 'border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              {isSavedInLibrary ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Heart className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => onQuickSaveToKeep(currentTrack)}
              title="Save track mood note to Google Keep"
              className="px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-emerald-400 hover:bg-slate-900 rounded-lg border border-slate-800 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <BookmarkPlus className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Keep Note</span>
            </button>
          </div>
        </div>

        {/* Center: Transport Controls + Scrubber */}
        <div className="md:col-span-5 flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={onPrev}
              aria-label="Previous track"
              className="p-1.5 text-slate-400 hover:text-slate-100 transition-colors"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onTogglePlay}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="w-9 h-9 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center transition-transform active:scale-95 shadow-sm"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={onNext}
              aria-label="Next track"
              className="p-1.5 text-slate-400 hover:text-slate-100 transition-colors"
            >
              <SkipForward className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onToggleRepeat}
              aria-label="Toggle repeat"
              className={`p-1.5 transition-colors ${
                isRepeat ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Repeat className="w-4 h-4" />
            </button>
          </div>

          <div className="w-full max-w-md flex items-center gap-3">
            <span className="text-[11px] font-mono-tabular text-slate-400 w-10 text-right">
              {formatTimecode(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={duration > 0 ? duration : 240}
              step={1}
              value={currentTime}
              onChange={(e) => onSeek(parseFloat(e.target.value))}
              aria-label="Seek timeline"
              className="mood-slider flex-1"
            />
            <span className="text-[11px] font-mono-tabular text-slate-400 w-10">
              {duration > 0 ? formatTimecode(duration) : 'LIVE'}
            </span>
          </div>
        </div>

        {/* Right: Audio Status + Volume */}
        <div className="hidden md:flex md:col-span-3 items-center justify-end gap-4">
          <span className="text-xs font-mono-tabular text-slate-400">
            {isPlaying ? 'Streaming Audio' : 'Paused'}
          </span>

          <div className="flex items-center gap-2 w-28">
            <button
              type="button"
              onClick={handleToggleMute}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
              className="text-slate-400 hover:text-slate-100 transition-colors"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              aria-label="Volume"
              className="mood-slider w-full"
            />
          </div>
        </div>
      </div>
    </footer>
  );
};

