import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/services/prisma.service';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { FXQLParser } from '../src/utils/fxql.parser';
import { clearDatabase } from './db.reset';

describe('FXQL Statements API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule], // Your main app module
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get(PrismaService);
    await app.init();
  });

  beforeEach(async () => {
    // Clear the database before each test
    await clearDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should parse a valid FXQL statement', () => {
    const fxql = 'USD-GBP {\\n BUY 100\\n SELL 200\\n CAP 5000\\n}';

    const result = FXQLParser.validateAndParse(fxql);

    expect(result).toEqual([
      {
        SourceCurrency: 'USD',
        DestinationCurrency: 'GBP',
        BuyPrice: 100,
        SellPrice: 200,
        CapAmount: 5000,
      },
    ]);
  });

  it('should handle multiple valid FXQL statements', async () => {
    const fxql =
      'USD-GBP {\\n  BUY 0.85\\n  SELL 0.90\\n  CAP 10000\\n}\\n\\nEUR-JPY {\\n  BUY 145.20\\n  SELL 146.50\\n  CAP 50000\\n}\\n\\nNGN-USD {\\n  BUY 0.0022\\n  SELL 0.0023\\n  CAP 2000000\\n}';

    const response = await request(app.getHttpServer())
      .post('/fxql-statements')
      .send({ FXQL: fxql })
      .expect(201);

    expect(response.body.data).toEqual([
      {
        EntryId: 1,
        SourceCurrency: 'USD',
        DestinationCurrency: 'GBP',
        BuyPrice: 0.85,
        SellPrice: 0.9,
        CapAmount: 10000,
      },
      {
        EntryId: 2,
        SourceCurrency: 'EUR',
        DestinationCurrency: 'JPY',
        BuyPrice: 145.2,
        SellPrice: 146.5,
        CapAmount: 50000,
      },
      {
        EntryId: 3,
        SourceCurrency: 'NGN',
        DestinationCurrency: 'USD',
        BuyPrice: 0.0022,
        SellPrice: 0.0023,
        CapAmount: 2000000,
      },
    ]);
  });

  it('should return an error for invalid FXQL', async () => {
    const input = `INVALID-INPUT { BUY ABC SELL 123 CAP -500 }`;

    const response = await request(app.getHttpServer())
      .post('/fxql-statements')
      .send({ FXQL: input })
      .expect(400);

    expect(response.body.message).toBe(
      'Invalid FXQL statement: INVALID-INPUT { BUY ABC SELL 123 CAP -500 }',
    );
  });
});
