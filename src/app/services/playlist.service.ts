import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';


export interface Song {
    id: number;
    title: string;
    artist: string;
    url: string; // direct URL to MP3 (GitHub raw / Google Drive direct)
    cover?: string; // optional album art (assets/covers/.. or external)
}


@Injectable({ providedIn: 'root' })
export class PlaylistService {

    private readonly GITHUB_SONGS_API =
        'https://api.github.com/repos/puttheother1-web/music/contents/songs';

    constructor(private http: HttpClient) { }

    hashString(s: string) {
        let h = 2166136261 >>> 0;
        for (let i = 0; i < s.length; i++) {
            h ^= s.charCodeAt(i);
            h = Math.imul(h, 16777619) >>> 0;
        }
        return h;
    }

    // pick an abstract art cover from picsum with deterministic seed
    abstractCoverFor(title: string, id: number) {
        const seeds = [1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009, 1010];
        const h = this.hashString(title + '::' + id);
        const seed = seeds[h % seeds.length];
        // 600x600 square abstract image; change size as needed
        return `https://picsum.photos/seed/abstract-${seed}/600/600`;
    }

    /**
     * Fetch songs from the public GitHub repo and map to the Song interface.
     * Returns an Observable<Song[]>
     */
    getAll(): Observable<Song[]> {
        return this.http.get<any[]>(this.GITHUB_SONGS_API).pipe(
            map(files => (files || [])
                // only audio files
                .filter(f => f.type === 'file' && /\.(mp3|m4a|wav|ogg|flac)$/i.test(f.name))
                .map((f, i) => {
                    const title = f.name.replace(/\.[^/.]+$/, '');
                    const id = i + 1;
                    const url = f.download_url; // raw file URL from GitHub API
                    const cover = this.abstractCoverFor(title, id);
                    return {
                        id,
                        title,
                        artist: '',
                        url,
                        cover
                    } as Song;
                })
            )
        );
    }

    // optional single-file retrieval by id (keeps same shape as before)
    getById(id: number): Observable<Song | undefined> {
        return this.getAll().pipe(
            map(list => list.find(s => s.id === id))
        );
    }
}

