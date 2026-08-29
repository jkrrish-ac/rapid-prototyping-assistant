import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Prototype, PrototypeSchema } from './prototype.schema';
import { StageState, StageSchema } from '../stages/stage.schema';
import { PrototypesService } from './prototypes.service';
import { PrototypesController } from './prototypes.controller';
import { BundlerService } from './bundler.service';
import { ZipService } from './zip.service';
import { DecisionsModule } from '../decisions/decisions.module';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Prototype.name, schema: PrototypeSchema },
      { name: StageState.name, schema: StageSchema },
    ]),
    DecisionsModule,
    ProjectsModule,
  ],
  controllers: [PrototypesController],
  providers: [PrototypesService, BundlerService, ZipService],
  exports: [PrototypesService],
})
export class PrototypesModule {}
