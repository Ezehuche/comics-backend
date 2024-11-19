import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/services/prisma.service';
import { FXQLParser } from 'src/utils/fxql.parser';

@Injectable()
export class FXQLService {
  constructor(private readonly prisma: PrismaService) {}

  async parseAndSave(fxql: string) {
    const parsedStatements = FXQLParser.validateAndParse(fxql);

    const savedStatements = await Promise.all(
      parsedStatements.map((stmt) =>
        this.prisma.fXQLStatement.create({
          data: stmt,
        }),
      ),
    );

    return savedStatements;
  }
}
