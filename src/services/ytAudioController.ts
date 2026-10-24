import { YouTubeMusicTrack } from '../types/music';

declare global {
  interface Window {
    YT?: {
      Player: new (
        elementId: string,
        options: {
          height?: string | number;
          width?: string | number;
          videoId?: string;
          playerVars?: Record<string, number | string>;
          events?: {
            onReady?: (event: { target: YTPlayerInstance }) => void;
            onStateChange?: (event: { data: number; target: YTPlayerInstance }) => void;
            onError?: () => void;
          };
        }
      ) => YTPlayerInstance;
      PlayerState?: {
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayerInstance {
  loadVideoById: (videoId: string) => void;
  cueVideoById: (videoId: string) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setVolume: (volume: number) => void;
  mute: () => void;
  unMute: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
}

type AudioStateCallback = (state: {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
}) => void;

class YouTubeAudioController {
  private player: YTPlayerInstance | null = null;
  private isReady = false;
  private pendingVideoId: string | null = null;
  private pendingAutoplay = false;
  private currentTrack: YouTubeMusicTrack | null = null;
  private isPlaying = false;
  private currentTime = 0;
  private duration = 0;
  private volume = 80;
  private isMuted = false;
  private pollTimer: number | null = null;
  private listeners: Set<AudioStateCallback> = new Set();
  private onEndCallback: (() => void) | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initApi();
    }
  }

  private initApi() {
    // Ensure hidden audio mount container exists in DOM
    const ensureContainer = () => {
      if (!document.getElementById('yt-hidden-audio-mount')) {
        const wrapper = document.createElement('div');
        wrapper.style.position = 'fixed';
        wrapper.style.bottom = '0px';
        wrapper.style.left = '0px';
        wrapper.style.width = '1px';
        wrapper.style.height = '1px';
        wrapper.style.opacity = '0.01';
        wrapper.style.pointerEvents = 'none';
        wrapper.style.zIndex = '-10';
        wrapper.style.overflow = 'hidden';

        const target = document.createElement('div');
        target.id = 'yt-hidden-audio-mount';
        wrapper.appendChild(target);
        document.body.appendChild(wrapper);
      }
    };

    const createPlayer = () => {
      ensureContainer();
      if (!window.YT || !window.YT.Player || this.player) return;

      this.player = new window.YT.Player('yt-hidden-audio-mount', {
        height: 1,
        width: 1,
        videoId: this.pendingVideoId || 'jfKfPfyJRdk',
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
        },
        events: {
          onReady: (event) => {
            this.isReady = true;
            event.target.setVolume(this.volume);
            if (this.isMuted) {
              event.target.mute();
            }
            if (this.pendingVideoId) {
              if (this.pendingAutoplay) {
                event.target.loadVideoById(this.pendingVideoId);
              } else {
                event.target.cueVideoById(this.pendingVideoId);
              }
              this.pendingVideoId = null;
            }
          },
          onStateChange: (event) => {
            // YT.PlayerState: ENDED = 0, PLAYING = 1, PAUSED = 2, BUFFERING = 3
            if (event.data === 1) {
              this.isPlaying = true;
              this.duration = event.target.getDuration() || 0;
              this.startPolling();
              this.emit();
            } else if (event.data === 2) {
              this.isPlaying = false;
              this.stopPolling();
              this.emit();
            } else if (event.data === 0) {
              this.isPlaying = false;
              this.stopPolling();
              this.emit();
              if (this.onEndCallback) {
                this.onEndCallback();
              }
            }
          },
          onError: () => {
            // If a stream cannot be embedded/played, automatically advance to the next suggested song
            this.isPlaying = false;
            this.stopPolling();
            this.emit();
            if (this.onEndCallback) {
              window.setTimeout(() => {
                if (this.onEndCallback) this.onEndCallback();
              }, 500);
            }
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      createPlayer();
    } else {
      const existingScript = document.querySelector(
        'script[src="https://www.youtube.com/iframe_api"]'
      );
      if (!existingScript) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }
      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prevCallback) prevCallback();
        createPlayer();
      };
    }
  }

  private startPolling() {
    this.stopPolling();
    this.pollTimer = window.setInterval(() => {
      if (!this.player || !this.isReady) return;
      try {
        const cur = this.player.getCurrentTime() || 0;
        const dur = this.player.getDuration() || 0;
        this.currentTime = cur;
        if (dur > 0) {
          this.duration = dur;
        }
        this.emit();
        if (dur > 10 && cur >= dur - 0.5 && this.isPlaying) {
          this.isPlaying = false;
          this.stopPolling();
          this.emit();
          if (this.onEndCallback) {
            this.onEndCallback();
          }
        }
      } catch {
        // ignore transient player read errors
      }
    }, 300);
  }

  private stopPolling() {
    if (this.pollTimer !== null) {
      window.clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private emit() {
    const payload = {
      isPlaying: this.isPlaying,
      currentTime: this.currentTime,
      duration: this.duration,
    };
    this.listeners.forEach((cb) => cb(payload));
  }

  public subscribe(cb: AudioStateCallback): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  public onTrackEnd(cb: () => void) {
    this.onEndCallback = cb;
  }

  public cueTrack(track: YouTubeMusicTrack) {
    this.currentTrack = track;
    this.currentTime = 0;
    if (this.isReady && this.player) {
      this.player.cueVideoById(track.videoId);
    } else {
      this.pendingVideoId = track.videoId;
      this.pendingAutoplay = false;
    }
    this.emit();
  }

  public loadAndPlay(track: YouTubeMusicTrack) {
    const isSame = this.currentTrack?.videoId === track.videoId;
    this.currentTrack = track;
    if (isSame && this.isReady && this.player) {
      this.player.playVideo();
      return;
    }
    this.currentTime = 0;
    this.duration = 0;
    if (this.isReady && this.player) {
      this.player.loadVideoById(track.videoId);
    } else {
      this.pendingVideoId = track.videoId;
      this.pendingAutoplay = true;
    }
    this.isPlaying = true;
    this.emit();
  }

  public togglePlayPause(track?: YouTubeMusicTrack) {
    if (
      track &&
      (!this.currentTrack || this.currentTrack.videoId !== track.videoId)
    ) {
      this.loadAndPlay(track);
      return;
    }
    if (!this.isReady || !this.player) {
      if (track) {
        this.loadAndPlay(track);
      }
      return;
    }
    if (this.isPlaying) {
      this.player.pauseVideo();
    } else {
      this.player.playVideo();
    }
  }

  public seek(seconds: number) {
    if (!this.isReady || !this.player) return;
    this.currentTime = seconds;
    this.player.seekTo(seconds, true);
    this.emit();
  }

  public setVolume(val0to1: number) {
    this.volume = Math.round(Math.max(0, Math.min(1, val0to1)) * 100);
    if (this.isReady && this.player) {
      this.player.setVolume(this.volume);
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.isReady && this.player) {
      if (muted) {
        this.player.mute();
      } else {
        this.player.unMute();
      }
    }
  }
}

export const ytAudioController = new YouTubeAudioController();
