import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  findByEmail(email: string) {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  findById(id: string | Types.ObjectId) {
    return this.userModel.findById(id).exec();
  }

  create(data: { email: string; name: string; passwordHash?: string }) {
    return this.userModel.create(data);
  }

  async findOrCreateOAuthUser(params: {
    email: string;
    name: string;
    provider: 'google' | 'github';
    providerId: string;
  }) {
    const existing = await this.findByEmail(params.email);
    if (existing) {
      const hasProvider = existing.oauthProviders.some(
        (p) => p.provider === params.provider && p.providerId === params.providerId,
      );
      if (!hasProvider) {
        existing.oauthProviders.push({
          provider: params.provider,
          providerId: params.providerId,
        });
        await existing.save();
      }
      return existing;
    }
    return this.userModel.create({
      email: params.email,
      name: params.name,
      oauthProviders: [{ provider: params.provider, providerId: params.providerId }],
    });
  }

  toPublic(user: UserDocument) {
    return {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
    };
  }
}
