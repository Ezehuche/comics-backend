/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';

interface ParsedFXQL {
  SourceCurrency: string;
  DestinationCurrency: string;
  BuyPrice: number;
  SellPrice: number;
  CapAmount: number;
}

@Injectable()
export class FXQLParser {
  static validateAndParse(fxql: string): ParsedFXQL[] {
    if (!fxql || typeof fxql !== 'string') {
      throw new HttpException(
        {
          message: 'FXQL input is required and must be a string.',
          code: 'FXQL-400',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Replace escaped newlines (\\n) with actual newlines (\n)
    fxql = fxql.replace(/\\n/g, '\n');

    // Split the FXQL string into individual statements by the 'double newline' pattern
    const statements = fxql
      .trim()
      .split(/\n\s*\n/) // This will handle multiple newlines separating statements
      .filter((block) => block.trim());

    if (statements.length > 1000) {
      throw new HttpException(
        {
          message: 'Too many FXQL statements. Maximum allowed is 1000.',
          code: 'FXQL-413',
        },
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }

    const results: ParsedFXQL[] = [];
    const currencyRegex = /^[A-Z]{3}$/;
    const numericRegex = /^\d+(\.\d+)?$/;

    statements.forEach((stmt, idx) => {
      // Adjusted regex to handle flexible spacing
      const match = stmt.match(
        /^([A-Z]{3})-([A-Z]{3})\s*{\s*BUY\s+([\d.]+)\s+SELL\s+([\d.]+)\s+CAP\s+(\d+)\s*}$/i,
      );

      if (!match) {
        throw new HttpException(
          {
            message: `Invalid FXQL statement: ${stmt}`,
            code: 'FXQL-400',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      const [
        _,
        sourceCurrency,
        destinationCurrency,
        buyPrice,
        sellPrice,
        capAmount,
      ] = match;

      results.push({
        SourceCurrency: sourceCurrency,
        DestinationCurrency: destinationCurrency,
        BuyPrice: parseFloat(buyPrice),
        SellPrice: parseFloat(sellPrice),
        CapAmount: parseInt(capAmount, 10),
      });
    });

    return results;
  }
}
