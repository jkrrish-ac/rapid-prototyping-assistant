import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { LifecycleStage } from '../common/lifecycle/stage.types';

export type ProjectDocument = Project & Document;

@Schema({ timestamps: true })
export class Project {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  owner!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ default: '' })
  description!: string;

  @Prop({ required: true, enum: LifecycleStage, default: LifecycleStage.IDEA })
  currentStage!: LifecycleStage;

  @Prop({ required: true, enum: ['active', 'archived'], default: 'active' })
  status!: 'active' | 'archived';

  @Prop({ type: String, default: null })
  thumbnailUrl!: string | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ProjectSchema = SchemaFactory.createForClass(Project);
