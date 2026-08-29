import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  _id!: Types.ObjectId;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ required: false })
  passwordHash?: string;

  @Prop({ required: true })
  name!: string;

  @Prop({
    type: [{ provider: String, providerId: String }],
    default: [],
  })
  oauthProviders!: { provider: 'google' | 'github'; providerId: string }[];

  @Prop({ type: Object, default: {} })
  preferences!: Record<string, unknown>;

  createdAt?: Date;
  updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
