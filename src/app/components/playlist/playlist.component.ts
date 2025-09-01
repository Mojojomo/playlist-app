import { Component, OnInit } from '@angular/core';
import { PlaylistService, Song } from '../../services/playlist.service';
import { AudioService } from '../../services/audio.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-playlist',
  templateUrl: './playlist.component.html',
  styleUrls: ['./playlist.component.scss'],
  standalone: true,
  imports: [CommonModule],
})
export class PlaylistComponent implements OnInit {
  songs: Song[] = [];
  currentId: number | null = null;

  constructor(
    private playlist: PlaylistService,
    private audio: AudioService
  ) {}

  ngOnInit() {
    // ✅ subscribe to backend API
    this.playlist.getAll().subscribe((songs) => {
      this.songs = songs;
    });

    // ✅ keep track of current playing song
    this.audio.current$.subscribe(
      (s) => (this.currentId = s?.id ?? null)
    );
  }

  play(song: Song, index: number) {
    // reload queue starting at index
    this.audio.loadQueue(this.songs, index);
    this.audio.play();
  }
}
