import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type FeedbackDocument = Feedback & Document;

@Schema({ timestamps: true })
export class Feedback {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Project', required: true, index: true })
  project!: Types.ObjectId;

  @Prop({ required: true })
  whatHappened!: string;

  @Prop({ default: '' })
  whatUserExpected!: string;

  @Prop({ default: '' })
  whatUserDid!: string;

  @Prop({ default: '' })
  assumptionRef!: string;

  createdAt?: Date;
}

export const FeedbackSchema = SchemaFactory.createForClass(Feedback);
