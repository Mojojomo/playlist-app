import { Component, OnInit, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlayerComponent } from './components/player/player.component';
import { PlaylistComponent } from './components/playlist/playlist.component';


@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
    standalone: true,
    imports: [CommonModule, PlayerComponent, PlaylistComponent]
})
export class AppComponent implements OnInit {
    constructor(private renderer: Renderer2) { }


    ngOnInit() {
        // Spawn decorative floating notes
        const colors = ['#d8b4fe', '#c084fc', '#a855f7', '#7e22ce', '#6d28d9'];
        const glyphs = ['♫', '♪', '♩', '♬'];
        setInterval(() => {
            const el = this.renderer.createElement('div');
            this.renderer.addClass(el, 'note');
            el.textContent = glyphs[Math.floor(Math.random() * glyphs.length)];
            (el as HTMLElement).style.left = Math.random() * 100 + 'vw';
            (el as HTMLElement).style.fontSize = (18 + Math.random() * 28) + 'px';
            (el as HTMLElement).style.color = colors[Math.floor(Math.random() * colors.length)];
            (el as HTMLElement).style.animationDuration = (6 + Math.random() * 8) + 's';
            this.renderer.appendChild(document.body, el);
            setTimeout(() => this.renderer.removeChild(document.body, el), 15000);
        }, 800);
    }
}