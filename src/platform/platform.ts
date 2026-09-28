import { openSaveStore as openBrowserStore, type SaveStore } from './storage';

/**
 * The narrow bridge the desktop preload exposes (spec §05). Everything is
 * typed data; the renderer never touches Node, the file system or Steam.
 */
export interface DesktopBridge {
  readonly version: string;
  readonly os: string;
  saves: {
    get(key: string): Promise<string | null>;
    put(entries: Record<string, string>): Promise<void>;
    remove(keys: string[]): Promise<void>;
    reveal(): Promise<void>;
  };
  achievements: {
    unlock(id: string): Promise<boolean>;
  };
  window: {
    toggleFullscreen(): Promise<boolean>;
  };
  lifecycle: {
    /** The shell is about to quit; the handler flushes the save, then the shell exits. */
    onBeforeQuit(handler: () => Promise<void>): void;
  };
}

declare global {
  interface Window {
    sisyphusDesktop?: DesktopBridge;
  }
}

export interface Platform {
  readonly kind: 'browser' | 'desktop';
  openSaveStore(): Promise<SaveStore>;
  /** Mirror an earned achievement to the store front, if any. Never throws. */
  unlockAchievement(id: string): void;
  /** Flush saves before the shell closes. The browser uses `pagehide` instead. */
  onQuit(flush: () => Promise<void>): void;
  toggleFullscreen(): void;
  /** Open the folder that holds save files (desktop only). */
  revealSaves?: () => void;
}

class BrowserPlatform implements Platform {
  readonly kind = 'browser';
  openSaveStore() {
    return openBrowserStore();
  }
  unlockAchievement(): void {}
  onQuit(): void {}
  toggleFullscreen(): void {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  }
}

class DesktopSaveStore implements SaveStore {
  readonly kind = 'desktop files';
  constructor(private bridge: DesktopBridge) {}
  get(key: string) {
    return this.bridge.saves.get(key);
  }
  put(entries: Record<string, string>) {
    return this.bridge.saves.put(entries);
  }
  remove(keys: string[]) {
    return this.bridge.saves.remove(keys);
  }
}

class DesktopPlatform implements Platform {
  readonly kind = 'desktop';
  constructor(private bridge: DesktopBridge) {}
  async openSaveStore(): Promise<SaveStore> {
    return new DesktopSaveStore(this.bridge);
  }
  unlockAchievement(id: string): void {
    void this.bridge.achievements.unlock(id).catch(() => {});
  }
  onQuit(flush: () => Promise<void>): void {
    this.bridge.lifecycle.onBeforeQuit(flush);
  }
  toggleFullscreen(): void {
    void this.bridge.window.toggleFullscreen().catch(() => {});
  }
  revealSaves = () => {
    void this.bridge.saves.reveal().catch(() => {});
  };
}

export function detectPlatform(): Platform {
  const bridge = typeof window !== 'undefined' ? window.sisyphusDesktop : undefined;
  return bridge ? new DesktopPlatform(bridge) : new BrowserPlatform();
}
