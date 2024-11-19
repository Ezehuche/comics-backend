/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { FXQLService } from 'src/services/fxql.service';

@ApiTags('FXQL Statements')
@Controller('fxql-statements')
@UseGuards(ThrottlerGuard)
export class FXQLController {
  constructor(private readonly fxqlService: FXQLService) {}

  @Post()
  @ApiBody({
    schema: {
      example: {
        FXQL: 'USD-GBP {\\n  BUY 0.85\\n  SELL 0.90\\n  CAP 10000\\n}\\n\\nEUR-JPY {\\n  BUY 145.20\\n  SELL 146.50\\n  CAP 50000\\n}\\n\\nNGN-USD {\\n  BUY 0.0022\\n  SELL 0.0023\\n  CAP 2000000\\n}',
      },
    },
  })
  async parseStatements(@Body('FXQL') fxql: string) {
    try {
      const parsedStatements = await this.fxqlService.parseAndSave(fxql);
      return {
        message: 'Rates Parsed Successfully.',
        code: 'FXQL-200',
        data: parsedStatements.map((entry, index) => {
          const { id, ...rest } = entry;
          return {
            EntryId: index + 1,
            ...rest,
          };
        }),
      };
    } catch (error) {
      throw new HttpException(
        {
          message:
            error.response?.message || 'Error processing FXQL statements.',
          code: error.response?.code || 'FXQL-500',
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
