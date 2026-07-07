declare module 'aplayer' {
  export interface APlayerAudio {
    name: string;
    url: string;
    artist?: string;
    cover?: string;
    theme?: string;
  }

  export interface APlayerOptions {
    container: HTMLElement;
    audio: APlayerAudio | APlayerAudio[];
    autoplay?: boolean;
    theme?: string;
    loop?: 'all' | 'one' | 'none';
    order?: 'list' | 'random';
    preload?: 'none' | 'metadata' | 'auto';
    volume?: number;
    mutex?: boolean;
    listFolded?: boolean;
    listMaxHeight?: string | number;
  }

  export default class APlayer {
    constructor(options: APlayerOptions);
    destroy(): void;
    play(): void;
    pause(): void;
    seek(time: number): void;
    toggle(): void;
    on(event: string, handler: (...args: any[]) => void): void;
  }
}
