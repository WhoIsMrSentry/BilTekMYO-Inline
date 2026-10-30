import { Injectable } from '@nestjs/common';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { ContentService } from './content.service.js';

export type DisplayThemeSetting = { theme: string };

const settingsFile = resolve(process.env.DISPLAY_THEME_FILE ?? 'var/display-theme.json');
const automatic = 'auto';

/** 'auto' lets screens rotate on their own; any other value is a theme id set from the admin panel. */
@Injectable()
export class DisplayThemeService {
  private setting: DisplayThemeSetting = { theme: automatic };

  constructor(private readonly content: ContentService) {
    try {
      const stored = JSON.parse(readFileSync(settingsFile, 'utf8')) as DisplayThemeSetting;
      if (this.isValid(stored.theme)) this.setting = { theme: stored.theme };
    } catch {
      // No saved choice yet: screens start in automatic rotation.
    }
  }

  current(): DisplayThemeSetting {
    return this.setting;
  }

  update(theme: string | undefined): DisplayThemeSetting {
    if (!this.isValid(theme)) throw new Error('Geçersiz tema.');
    this.setting = { theme };
    mkdirSync(dirname(settingsFile), { recursive: true });
    writeFileSync(settingsFile, JSON.stringify(this.setting));
    // Screens already listen to content changes, so the same event reaches them at once.
    this.content.notifyDisplays();
    return this.setting;
  }

  private isValid(theme: string | undefined): theme is string {
    return typeof theme === 'string' && /^[a-z][a-z-]{1,30}$/.test(theme);
  }
}
