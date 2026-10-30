import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import type { ScheduledContent } from '@biltekmyo/shared-types';
import { AdminAuthGuard } from './admin-auth.guard.js';
import { ContentService } from './content.service.js';

@Controller('content')
@UseGuards(AdminAuthGuard)
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get()
  list(): Promise<ScheduledContent[]> {
    return this.content.list();
  }

  @Post()
  create(@Body() content: ScheduledContent): Promise<ScheduledContent> {
    return this.content.create(content);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<{ deleted: true }> {
    await this.content.remove(id);
    return { deleted: true };
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() content: ScheduledContent): Promise<ScheduledContent> {
    if (content.id !== id) {
      throw new Error('Content ID cannot be changed.');
    }
    return this.content.update(content);
  }
}
