import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import configuration from './config/configuration';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { StagesModule } from './stages/stages.module';
import { DecisionsModule } from './decisions/decisions.module';
import { PrototypesModule } from './prototypes/prototypes.module';
import { FeedbackModule } from './feedback/feedback.module';
import { AiModule } from './ai/ai.module';
import { AppController } from './app.controller';

@Module({
  controllers: [AppController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('mongoUri'),
      }),
    }),
    AuthModule,
    UsersModule,
    ProjectsModule,
    StagesModule,
    DecisionsModule,
    PrototypesModule,
    FeedbackModule,
    AiModule,
  ],
})
export class AppModule {}
