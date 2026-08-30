import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { LifecycleStage } from '../common/lifecycle/stage.types';

export type StageDocument = StageState & Document;

@Schema({ _id: false })
class ConversationEntry {
  @Prop({ required: true, enum: ['user', 'assistant'] })
  role!: 'user' | 'assistant';

  @Prop({ required: true })
  content!: string;

  @Prop({ default: () => new Date() })
  createdAt!: Date;
}
const ConversationEntrySchema = SchemaFactory.createForClass(ConversationEntry);

@Schema({ _id: false })
class StageChoice {
  @Prop({ required: true })
  id!: string;

  @Prop({ required: true })
  label!: string;

  @Prop({ type: String, default: null })
  detail!: string | null;
}
const StageChoiceSchema = SchemaFactory.createForClass(StageChoice);

@Schema({ timestamps: true })
export class StageState {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Project', required: true, index: true })
  project!: Types.ObjectId;

  @Prop({ required: true, enum: LifecycleStage })
  stage!: LifecycleStage;

  @Prop({ required: true, enum: ['pending', 'active', 'complete'], default: 'pending' })
  status!: 'pending' | 'active' | 'complete';

  @Prop({ type: [ConversationEntrySchema], default: [] })
  conversation!: ConversationEntry[];

  @Prop({ type: Object, default: {} })
  output!: Record<string, unknown>;

  @Prop({ default: false })
  readyToAdvance!: boolean;

  @Prop({ type: [StageChoiceSchema], default: [] })
  pendingChoices!: StageChoice[];

  @Prop({ type: String, enum: ['opus', 'sonnet'], default: null })
  lastModelUsed!: 'opus' | 'sonnet' | null;

  @Prop({ type: Date, default: null })
  startedAt!: Date | null;

  @Prop({ type: Date, default: null })
  completedAt!: Date | null;
}

export const StageSchema = SchemaFactory.createForClass(StageState);
StageSchema.index({ project: 1, stage: 1 }, { unique: true });
