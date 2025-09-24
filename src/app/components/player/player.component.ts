import { Component, OnDestroy, OnInit, ElementRef, ViewChild } from '@angular/core';
import { AudioService } from '../../services/audio.service';
import { PlaylistService, Song } from '../../services/playlist.service';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Shuffle, SkipBack, SkipForward, Play, Pause, RotateCcw } from 'lucide-angular';

@Component({
  selector: 'app-player',
  templateUrl: './player.component.html',
  styleUrls: ['./player.component.scss'],
  standalone: true,
  imports: [CommonModule, LucideAngularModule]
})
export class PlayerComponent implements OnInit, OnDestroy {
  current: Song | null = null;
  isPlaying = false;
  isShuffled = false;
  progress = 0;
  cur = 0;
  dur = 0;
  sub = new Subscription();
  songs: Song[] = [];

  // Lucide icons
  readonly Shuffle = Shuffle;
  readonly SkipBack = SkipBack;
  readonly SkipForward = SkipForward;
  readonly Play = Play;
  readonly Pause = Pause;
  readonly RotateCcw = RotateCcw;

  constructor(private audio: AudioService, private playlist: PlaylistService) {}

  ngOnInit(): void {
    this.sub.add(this.playlist.getAll().subscribe(songs => {
      this.songs = songs;
      if (songs.length > 0) {
        this.audio.loadQueue(this.songs, 0);
      }
    }));

    this.sub.add(this.audio.current$.subscribe(s => this.current = s));
    this.sub.add(this.audio.isPlaying$.subscribe(v => this.isPlaying = v));
    this.sub.add(this.audio.isShuffled$.subscribe(v => this.isShuffled = v));
    this.sub.add(this.audio.progress$.subscribe(p => this.progress = p));
    this.sub.add(this.audio.currentTime$.subscribe(t => this.cur = t));
    this.sub.add(this.audio.duration$.subscribe(d => this.dur = d));
  }

  ngOnDestroy(): void { this.sub.unsubscribe(); }

  toggle() { this.audio.toggle(); }
  prev() { this.audio.previous(); }
  next() { this.audio.next(); }
  shuffle() { this.audio.shuffle(); }
  resetShuffle() { this.audio.resetShuffle(); }

  seek(ev: Event) {
    const v = Number((ev.target as HTMLInputElement).value);
    this.audio.seekTo(v);
  }

  fmt(t: number) {
    if (!t || !isFinite(t)) return '0:00';
    const m = Math.floor(t/60); 
    const s = Math.floor(t%60).toString().padStart(2,'0');
    return `${m}:${s}`;
  }

  get progressPct(): string {
    const p = (this.progress <= 1) ? (this.progress * 100) : this.progress;
    return `${Math.max(0, Math.min(100, p))}%`;
  }

  get progressBackground(): string {
    const pct = this.progressPct;
    return `linear-gradient(90deg, #9b59b6 0%, #9b59b6 ${pct}, #444 ${pct}, #444 100%)`;
  }
}