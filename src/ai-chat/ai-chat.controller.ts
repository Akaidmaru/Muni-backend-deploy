import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AiChatService } from './ai-chat.service';
import { AskAiDto } from './dto/ask-ai.dto';

interface AuthenticatedRequest extends Request {
  user: { id: number };
}

@ApiTags('AI Chat')
@ApiBearerAuth()
@Controller('ai-chat')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AiChatController {
  constructor(private readonly aiChatService: AiChatService) {}

  @Post('query')
  @ApiOperation({
    summary:
      'Consulta la base de datos con lenguaje natural (ADMIN). Ejemplo: "dame los 5 primeros camiones".',
  })
  @ApiBody({ type: AskAiDto })
  @ApiResponse({
    status: 200,
    description: 'Respuesta natural + detalle de consultas ejecutadas.',
  })
  query(@Req() req: AuthenticatedRequest, @Body() dto: AskAiDto) {
    return this.aiChatService.ask(Number(req.user.id), dto);
  }
}