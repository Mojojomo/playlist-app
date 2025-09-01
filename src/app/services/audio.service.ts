import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Song, PlaylistService } from './playlist.service';

// ...existing code...
@Injectable({ providedIn: 'root' })
export class AudioService {
  private audio = new Audio();
  private queue: Song[] = [];
  private index = 0;

  // Observables for UI binding
  current$ = new BehaviorSubject<Song | null>(null);
  isPlaying$ = new BehaviorSubject<boolean>(false);
  progress$ = new BehaviorSubject<number>(0); // 0..1
  duration$ = new BehaviorSubject<number>(0);
  currentTime$ = new BehaviorSubject<number>(0);

  // Inject PlaylistService so AudioService can fetch the repo playlist
  constructor(private playlistService: PlaylistService) {
    // time updates
    this.audio.addEventListener('timeupdate', () => {
      const d = this.audio.duration || 0;
      const t = this.audio.currentTime || 0;
      this.duration$.next(d);
      this.currentTime$.next(t);
      this.progress$.next(d ? t / d : 0);
    });

    // auto-next
    this.audio.addEventListener('ended', () => this.next());

    // Try to keep playing in background on mobile (allowed by browsers when user gesture started it)
    this.audio.preload = 'metadata';
  }

  /**
   * Fetch playlist from the public GitHub repo and load into the audio queue.
   * If autoPlay is true it will try to start playback (may be blocked until a user gesture).
   */
  loadFromRepo(startIndex = 0, autoPlay = false) {
    this.playlistService.getAll().subscribe(songs => {
      if (!songs || !songs.length) return;
      this.loadQueue(songs, startIndex);
      if (autoPlay) {
        // play() is async and may be blocked by browser autoplay rules
        this.play().catch(() => {});
      }
    }, err => {
      console.warn('Failed to load playlist from repo', err);
    });
  }

  loadQueue(songs: Song[], startIndex = 0) {
    this.queue = songs.slice();
    this.index = Math.min(Math.max(startIndex, 0), this.queue.length - 1);
    this.setCurrent(this.queue[this.index]);
  }

  private setCurrent(song: Song) {
    this.current$.next(song);
    this.audio.src = song.url;
    this.audio.load();
    this.updateMediaSession(song);
  }

  async play() {
    try {
      await this.audio.play();
      this.isPlaying$.next(true);
      navigator.mediaSession?.playbackState && (navigator.mediaSession.playbackState = 'playing');
    } catch (e) {
      console.warn('Playback failed until user gesture', e);
      throw e;
    }
  }

  pause() {
    this.audio.pause();
    this.isPlaying$.next(false);
    navigator.mediaSession?.playbackState && (navigator.mediaSession.playbackState = 'paused');
  }

  toggle() { this.isPlaying$.value ? this.pause() : this.play(); }

  seekTo(fraction: number) {
    if (!isNaN(this.audio.duration)) {
      this.audio.currentTime = fraction * this.audio.duration;
    }
  }

  previous() {
    if (!this.queue.length) return;
    this.index = (this.index - 1 + this.queue.length) % this.queue.length;
    this.setCurrent(this.queue[this.index]);
    this.play();
  }

  next() {
    if (!this.queue.length) return;
    this.index = (this.index + 1) % this.queue.length;
    this.setCurrent(this.queue[this.index]);
    this.play();
  }

  private updateMediaSession(song: Song) {
    if ('mediaSession' in navigator) {
      // Lock screen / notification metadata
      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.title,
        artist: song.artist,
        album: 'Our Playlist',
        artwork: song.cover ? [
          { src: song.cover, sizes: '192x192', type: 'image/jpeg' }
        ] : []
      });

      navigator.mediaSession.setActionHandler?.('play', () => this.play());
      navigator.mediaSession.setActionHandler?.('pause', () => this.pause());
      navigator.mediaSession.setActionHandler?.('previoustrack', () => this.previous());
      navigator.mediaSession.setActionHandler?.('nexttrack', () => this.next());
      navigator.mediaSession.setActionHandler?.('seekto', (details: any) => {
        if (details?.seekTime != null) this.audio.currentTime = details.seekTime;
      });
      navigator.mediaSession.setActionHandler?.('seekbackward', (details: any) => {
        this.audio.currentTime = Math.max(0, this.audio.currentTime - (details.seekOffset || 10));
      });
      navigator.mediaSession.setActionHandler?.('seekforward', (details: any) => {
        this.audio.currentTime = Math.min(this.audio.duration, this.audio.currentTime + (details.seekOffset || 10));
      });
    }
  }
}
// ...existing code...