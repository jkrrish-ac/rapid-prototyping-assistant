import { IsIn, IsString } from 'class-validator';
import { LifecycleStage } from '../../common/lifecycle/stage.types';

export class SupersedeDecisionDto {
  @IsIn(Object.values(LifecycleStage))
  stage!: LifecycleStage;

  @IsIn(['opus', 'sonnet'])
  model!: 'opus' | 'sonnet';

  @IsString()
  decision!: string;

  @IsString()
  context!: string;

  @IsString()
  options!: string;

  @IsString()
  rationale!: string;

  @IsString()
  impact!: string;
}
