import { CreateRouteDto } from './create-route.dto';
import { PartialType } from '@nestjs/swagger';

export class UpdateRouteDto extends PartialType(CreateRouteDto) {}
