import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from './admin-auth.guard.js';
import { DisplayService, type DisplayRecord } from './display.service.js';

@Controller('displays')
@UseGuards(AdminAuthGuard)
export class DisplayController {
  constructor(private readonly displays: DisplayService) {}
  @Get() list(): Promise<DisplayRecord[]> { return this.displays.list(); }
  @Post() create(@Body() input: Omit<DisplayRecord, 'id'>): Promise<DisplayRecord> { return this.displays.create(input); }
  @Put(':id') update(@Param('id') id: string, @Body() input: Omit<DisplayRecord, 'id'>): Promise<DisplayRecord> { return this.displays.update(id, input); }
  @Delete(':id') async remove(@Param('id') id: string): Promise<{ deleted: true }> { await this.displays.remove(id); return { deleted: true }; }
}
