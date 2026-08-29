import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateFeedbackDto {
  @IsString()
  @MinLength(1)
  whatHappened!: string;

  @IsOptional()
  @IsString()
  whatUserExpected?: string;

  @IsOptional()
  @IsString()
  whatUserDid?: string;

  @IsOptional()
  @IsString()
  assumptionRef?: string;
}
