import { IsObject } from 'class-validator';

export class UpdateStageOutputDto {
  @IsObject()
  output!: Record<string, unknown>;
}
