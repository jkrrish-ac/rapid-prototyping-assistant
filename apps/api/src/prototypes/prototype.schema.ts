import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PrototypeDocument = Prototype & Document;

@Schema({ _id: false })
class PrototypeFile {
  @Prop({ required: true })
  path!: string;

  @Prop({ required: true })
  content!: string;
}
const PrototypeFileSchema = SchemaFactory.createForClass(PrototypeFile);

@Schema({ timestamps: true })
export class Prototype {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Project', required: true, unique: true })
  project!: Types.ObjectId;

  @Prop({ required: true, enum: ['react', 'vue'], default: 'react' })
  framework!: 'react' | 'vue';

  @Prop({ required: true, default: 1 })
  version!: number;

  @Prop({ type: [PrototypeFileSchema], default: [] })
  files!: PrototypeFile[];

  @Prop({ type: [String], default: [] })
  mocked!: string[];

  @Prop({ type: [String], default: [] })
  dependencies!: string[];

  createdAt?: Date;
  updatedAt?: Date;
}

export const PrototypeSchema = SchemaFactory.createForClass(Prototype);
