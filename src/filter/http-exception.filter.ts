import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { logger } from 'src/utils/logger.config';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status = exception.getStatus
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const errorResponse = {
      message: exception.message || 'Internal server error',
      code: `FXQL-${status}`,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    logger.error(
      `HTTP ${status} Error: ${exception.message} - Path: ${request.url}`,
    );

    response.status(status).json(errorResponse);
  }
}
