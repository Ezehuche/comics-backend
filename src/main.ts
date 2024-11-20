import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { logger } from './utils/logger.config';
import { HttpExceptionFilter } from './filter/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalFilters(new HttpExceptionFilter());

  app.useLogger({
    log: (message: string) => logger.info(message),
    error: (message: string) => logger.error(message),
    warn: (message: string) => logger.warn(message),
    debug: (message: string) => logger.debug(message),
    verbose: (message: string) => logger.verbose(message),
  });

  const config = new DocumentBuilder()
    .setTitle('FXQL API')
    .setDescription('Foreign Exchange Query Language API')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  await app.listen(3000);
}
bootstrap();
