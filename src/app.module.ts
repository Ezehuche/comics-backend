import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ThrottlerModule } from '@nestjs/throttler';
// import { PrismaService } from 'src/services/prisma.service';
// import { FXQLController } from 'src/api/fxql.controller';
import { GenerateController } from 'src/api/generate.controller';
// import { FXQLService } from 'src/services/fxql.service';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60,
        limit: 10,
      },
    ]),
  ],
  controllers: [AppController, GenerateController],
  providers: [AppService],
})
export class AppModule {}
