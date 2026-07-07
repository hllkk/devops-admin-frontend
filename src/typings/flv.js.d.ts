declare module 'flv.js' {
  export interface MediaDataSource {
    type: string;
    url: string;
    isLive?: boolean;
    cors?: boolean;
    withCredentials?: boolean;
    hasAudio?: boolean;
    hasVideo?: boolean;
    duration?: number;
    filesize?: number;
    segments?: any[];
  }

  export interface Player {
    attachMediaElement(mediaElement: HTMLMediaElement): void;
    detachMediaElement(): void;
    load(): void;
    unload(): void;
    play(): void;
    pause(): void;
    destroy(): void;
    on(event: string, handler: (...args: any[]) => void): void;
    off(event: string, handler: (...args: any[]) => void): void;
  }

  export function createPlayer(dataSource: MediaDataSource, config?: any): Player;
  export function isSupported(): boolean;
}
