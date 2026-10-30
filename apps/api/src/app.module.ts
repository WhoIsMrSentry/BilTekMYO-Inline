import { Module } from '@nestjs/common';
import { EdgeController } from './edge.controller.js';
import { EdgeRegistryService } from './edge-registry.service.js';
import { InMemoryEdgeRepository } from './in-memory-edge.repository.js';
import { PostgresEdgeRepository } from './postgres-edge.repository.js';
import type { EdgeRepository } from './edge-repository.js';
import { ContentController } from './content.controller.js';
import { ContentService } from './content.service.js';
import { InMemoryContentRepository } from './in-memory-content.repository.js';
import { PostgresContentRepository } from './postgres-content.repository.js';
import type { ContentRepository } from './content-repository.js';
import { PlaylistController } from './playlist.controller.js';
import { PlaylistService } from './playlist.service.js';
import { AuthController } from './auth.controller.js';
import { MediaController } from './media.controller.js';
import { DisplayController } from './display.controller.js';
import { DisplayService } from './display.service.js';
import { DisplayThemeController } from './display-theme.controller.js';
import { DisplayThemeService } from './display-theme.service.js';

@Module({
  controllers: [EdgeController, ContentController, PlaylistController, AuthController, MediaController, DisplayController, DisplayThemeController],
  providers: [
    {
      provide: 'EDGE_REPOSITORY',
      useFactory: (): EdgeRepository => {
        if (process.env.EDGE_REPOSITORY === 'memory') return new InMemoryEdgeRepository();
        const databaseUrl = process.env.DATABASE_URL;
        if (!databaseUrl) throw new Error('DATABASE_URL is required. Set EDGE_REPOSITORY=memory only for explicit local testing.');
        return new PostgresEdgeRepository(databaseUrl);
      },
    },
    { provide: EdgeRegistryService, useFactory: (repository: EdgeRepository) => new EdgeRegistryService(repository), inject: ['EDGE_REPOSITORY'] },
    {
      provide: 'CONTENT_REPOSITORY',
      useFactory: (): ContentRepository => {
        if (process.env.EDGE_REPOSITORY === 'memory') return new InMemoryContentRepository();
        const databaseUrl = process.env.DATABASE_URL;
        if (!databaseUrl) throw new Error('DATABASE_URL is required. Set EDGE_REPOSITORY=memory only for explicit local testing.');
        return new PostgresContentRepository(databaseUrl);
      },
    },
    { provide: ContentService, useFactory: (repository: ContentRepository) => new ContentService(repository), inject: ['CONTENT_REPOSITORY'] },
    { provide: DisplayService, useFactory: () => process.env.EDGE_REPOSITORY === 'memory'
        ? new DisplayService()
        : new DisplayService(process.env.DATABASE_URL), },
    PlaylistService,
    DisplayThemeService,
  ],
})
export class AppModule {}

