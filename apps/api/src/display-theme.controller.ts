import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from './admin-auth.guard.js';
import { DisplayThemeService, type DisplayThemeSetting } from './display-theme.service.js';

@Controller('display-theme')
export class DisplayThemeController {
  constructor(private readonly displayTheme: DisplayThemeService) {}

  @Get()
  current(): DisplayThemeSetting { return this.displayTheme.current(); }

  @Put()
  @UseGuards(AdminAuthGuard)
  update(@Body() body: { theme?: string }): DisplayThemeSetting { return this.displayTheme.update(body?.theme); }
}
