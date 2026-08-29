import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Decision, DecisionSchema } from './decision.schema';
import { DecisionsService } from './decisions.service';
import { DecisionsController } from './decisions.controller';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Decision.name, schema: DecisionSchema }]),
    ProjectsModule,
  ],
  controllers: [DecisionsController],
  providers: [DecisionsService],
  exports: [DecisionsService],
})
export class DecisionsModule {}
