import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Feedback, FeedbackSchema } from './feedback.schema';
import { FeedbackService } from './feedback.service';
import { FeedbackController } from './feedback.controller';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Feedback.name, schema: FeedbackSchema }]),
    ProjectsModule,
  ],
  controllers: [FeedbackController],
  providers: [FeedbackService],
})
export class FeedbackModule {}
