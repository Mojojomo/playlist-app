import { Component, OnInit, OnDestroy } from '@angular/core';
import { PlaylistService, Song } from '../../services/playlist.service';
import { AudioService } from '../../services/audio.service';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-playlist',
  templateUrl: './playlist.component.html',
  styleUrls: ['./playlist.component.scss'],
  standalone: true,
  imports: [CommonModule],
})
export class PlaylistComponent implements OnInit, OnDestroy {
  songs: Song[] = [];
  originalSongs: Song[] = [];
  currentId: number | null = null;
  currentQueueIndex: number = -1;
  sub = new Subscription();

  constructor(
    private playlist: PlaylistService,
    private audio: AudioService
  ) {}

  ngOnInit() {
    // Subscribe to original playlist
    this.sub.add(
      this.playlist.getAll().subscribe((songs) => {
        this.originalSongs = songs;
        // If audio service doesn't yet have a queue, show original list
        if (!this.songs.length) {
          this.songs = this.originalSongs;
        }
      })
    );

    // Keep track of current playing song
    this.sub.add(
      this.audio.current$.subscribe((s) => {
        this.currentId = s?.id ?? null;
        this.updateCurrentIndex();
      })
    );

    // Listen for shuffle changes to update displayed order
    this.sub.add(
      this.audio.isShuffled$.subscribe(() => {
        this.updateCurrentIndex();
      })
    );

    // NEW: subscribe to the service queue so the UI immediately reflects shuffled order
    this.sub.add(
      this.audio.currentQueue$.subscribe((q) => {
        this.songs = q.length ? q : this.originalSongs;
        this.updateCurrentIndex();
      })
    );
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }

  private updateCurrentIndex() {
    this.currentQueueIndex = this.audio.getCurrentQueueIndex();
  }

  play(song: Song, displayIndex: number) {
    // Find the original index of this song in the original playlist
    const originalIndex = this.originalSongs.findIndex(s => s.id === song.id);
    this.audio.playSpecificSong(song, originalIndex);
  }

  isCurrentlyPlaying(song: Song, index: number): boolean {
    return song.id === this.currentId;
  }
}