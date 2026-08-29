import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Feedback, FeedbackDocument } from './feedback.schema';
import { CreateFeedbackDto } from './dto/create-feedback.dto';

@Injectable()
export class FeedbackService {
  constructor(
    @InjectModel(Feedback.name) private feedbackModel: Model<FeedbackDocument>,
  ) {}

  create(projectId: string, dto: CreateFeedbackDto) {
    return this.feedbackModel.create({
      project: new Types.ObjectId(projectId),
      whatHappened: dto.whatHappened,
      whatUserExpected: dto.whatUserExpected ?? '',
      whatUserDid: dto.whatUserDid ?? '',
      assumptionRef: dto.assumptionRef ?? '',
    });
  }

  list(projectId: string) {
    return this.feedbackModel
      .find({ project: new Types.ObjectId(projectId) })
      .sort({ createdAt: -1 })
      .exec();
  }
}
