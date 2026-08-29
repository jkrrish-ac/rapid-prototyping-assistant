import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { LifecycleStage } from '../common/lifecycle/stage.types';

export type DecisionDocument = Decision & Document;

@Schema({ timestamps: { createdAt: 'timestamp', updatedAt: false } })
export class Decision {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Project', required: true, index: true })
  project!: Types.ObjectId;

  /** e.g. "D-DESIGN-002" — unique per project. */
  @Prop({ required: true })
  decisionId!: string;

  @Prop({ required: true, enum: LifecycleStage })
  stage!: LifecycleStage;

  @Prop({ required: true, enum: ['opus', 'sonnet'] })
  model!: 'opus' | 'sonnet';

  @Prop({ required: true })
  decision!: string;

  @Prop({ default: '' })
  context!: string;

  @Prop({ default: '' })
  options!: string;

  @Prop({ default: '' })
  rationale!: string;

  @Prop({ default: '' })
  impact!: string;

  @Prop({ required: true, enum: ['ACTIVE', 'SUPERSEDED'], default: 'ACTIVE' })
  status!: 'ACTIVE' | 'SUPERSEDED';

  @Prop({ type: String, default: null })
  supersededBy!: string | null;

  timestamp?: Date;
}

export const DecisionSchema = SchemaFactory.createForClass(Decision);
DecisionSchema.index({ project: 1, decisionId: 1 }, { unique: true });
