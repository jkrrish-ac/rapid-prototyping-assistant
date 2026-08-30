import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StageState, StageSchema } from './stage.schema';
import { StagesService } from './stages.service';
import { StagesController } from './stages.controller';
import { PrototypeRepairController } from './prototype-repair.controller';
import { ProjectsModule } from '../projects/projects.module';
import { DecisionsModule } from '../decisions/decisions.module';
import { AiModule } from '../ai/ai.module';
import { PrototypesModule } from '../prototypes/prototypes.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: StageState.name, schema: StageSchema }]),
    ProjectsModule,
    DecisionsModule,
    AiModule,
    PrototypesModule,
  ],
  controllers: [StagesController, PrototypeRepairController],
  providers: [StagesService],
  exports: [StagesService],
})
export class StagesModule {}
