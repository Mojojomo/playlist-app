import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Song, PlaylistService } from './playlist.service';

@Injectable({ providedIn: 'root' })
export class AudioService {
  private audio = new Audio();
  private queue: Song[] = [];
  private shuffledQueue: Song[] = [];
  private index = 0;
  private shuffledIndex = 0;
  private isShuffleMode = false;

  // Observables for UI binding
  current$ = new BehaviorSubject<Song | null>(null);
  isPlaying$ = new BehaviorSubject<boolean>(false);
  isShuffled$ = new BehaviorSubject<boolean>(false);
  progress$ = new BehaviorSubject<number>(0); // 0..1
  duration$ = new BehaviorSubject<number>(0);
  currentTime$ = new BehaviorSubject<number>(0);

  // New: current queue observable so UI can reflect shuffled order immediately
  currentQueue$ = new BehaviorSubject<Song[]>([]);

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

    // Update shuffled queue and find corresponding shuffled index
    this.generateShuffledQueue();
    this.syncShuffledIndex();

    this.setCurrent(this.getCurrentSong());

    // Emit the active queue
    this.currentQueue$.next(this.getCurrentQueue());
  }

  private generateShuffledQueue() {
    this.shuffledQueue = [...this.queue];
    // Fisher-Yates shuffle algorithm
    for (let i = this.shuffledQueue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.shuffledQueue[i], this.shuffledQueue[j]] = [this.shuffledQueue[j], this.shuffledQueue[i]];
    }

    // Emit updated queue after shuffle generation
    this.currentQueue$.next(this.getCurrentQueue());
  }

  private syncShuffledIndex() {
    if (this.isShuffleMode) {
      // Find the current song in shuffled queue
      const currentSong = this.queue[this.index];
      this.shuffledIndex = this.shuffledQueue.findIndex(song => song.id === currentSong.id);
      if (this.shuffledIndex === -1) this.shuffledIndex = 0;
    }
  }

  private getCurrentSong(): Song {
    return this.isShuffleMode ? 
      this.shuffledQueue[this.shuffledIndex] : 
      this.queue[this.index];
  }

  private setCurrent(song: Song) {
    this.current$.next(song);
    this.audio.src = song.url;
    this.audio.load();
    this.updateMediaSession(song);
  }

   shuffle() {
    // enable shuffle mode
    this.isShuffleMode = true;
    if (this.isShuffled$) this.isShuffled$.next(true);

    // generate a fresh shuffled queue (non-mutating)
    this.shuffledQueue = [...this.queue];
    for (let i = this.shuffledQueue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.shuffledQueue[i], this.shuffledQueue[j]] = [this.shuffledQueue[j], this.shuffledQueue[i]];
    }

    // reset to start of the shuffled queue
    this.shuffledIndex = 0;
    // keep underlying index in sync with the currently playing song if needed
    const firstSong = this.getCurrentQueue()[0];
    if (firstSong) {
      // set current song to first in shuffled queue and reset playback position
      this.setCurrent(firstSong);
      if (this.audio) {
        try { this.audio.currentTime = 0; } catch {}
      }
      // start playback from beginning
      this.play();
    }

    // emit queue update for UI
    if (this.currentQueue$) this.currentQueue$.next(this.getCurrentQueue());
  }

  resetShuffle() {
    // Return to normal order
    this.isShuffleMode = false;
    this.isShuffled$.next(false);

    // Find current song in normal queue
    const currentSong = this.getCurrentSong();
    this.index = this.queue.findIndex(song => song.id === currentSong.id);
    if (this.index === -1) this.index = 0;

    // Update current song display
    this.setCurrent(this.getCurrentSong());

    this.play();

    // Emit the active queue
    this.currentQueue$.next(this.getCurrentQueue());
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
    if (this.isShuffleMode) {
      if (!this.shuffledQueue.length) return;
      this.shuffledIndex = (this.shuffledIndex - 1 + this.shuffledQueue.length) % this.shuffledQueue.length;
    } else {
      if (!this.queue.length) return;
      this.index = (this.index - 1 + this.queue.length) % this.queue.length;
    }
    
    this.setCurrent(this.getCurrentSong());
    this.play();
  }

  next() {
    if (this.isShuffleMode) {
      if (!this.shuffledQueue.length) return;
      this.shuffledIndex = (this.shuffledIndex + 1) % this.shuffledQueue.length;
    } else {
      if (!this.queue.length) return;
      this.index = (this.index + 1) % this.queue.length;
    }
    
    this.setCurrent(this.getCurrentSong());
    this.play();
  }

  // Method to play a specific song (called from playlist)
  playSpecificSong(song: Song, queueIndex: number) {
    this.index = queueIndex;

    if (this.isShuffleMode) {
      // Find this song in shuffled queue
      this.shuffledIndex = this.shuffledQueue.findIndex(s => s.id === song.id);
      if (this.shuffledIndex === -1) {
        // Song not in shuffled queue, regenerate and find it
        this.generateShuffledQueue();
        this.shuffledIndex = this.shuffledQueue.findIndex(s => s.id === song.id);
      }
    }

    this.setCurrent(song);
    this.play();

    // ensure currentQueue$ is correct
    this.currentQueue$.next(this.getCurrentQueue());
  }

  getCurrentQueue(): Song[] {
    return this.isShuffleMode ? this.shuffledQueue : this.queue;
  }

  // Get current queue index (for playlist highlighting)
  getCurrentQueueIndex(): number {
    return this.isShuffleMode ? this.shuffledIndex : this.index;
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