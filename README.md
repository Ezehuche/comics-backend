# Foreign Exchange Query Language (FXQL) Statement Parser Implementation

## Setup Instructions

1. Clone the Repository
  
```bash
git clone <repository-url>
cd <repository-folder>
```

2. Install Dependencies

Run the following command to install all required dependencies:

```bash
npm install
```

3. Set Up Environment Variables

Create a `.env` file in the root directory and define the following variables:

```plaintext
DATABASE_URL=postgresql://<username>:<password>@<host>:<port>/<database>
NODE_ENV=development
DB_TABLE_NAME=fxql_data
```

4. Run Migrations:

Use Prisma to set up the database schema:

```bash
npx prisma migrate dev  
```

5. Start the Application:

```bash
npm run start:dev  
```

6. Access API Documentation:

Swagger API documentation is available at:

```bash
http://localhost:3000/api
```  

# API Documentation

## Endpoints

### POST /fxql-statements

**Description:** Validate and parse FXQL statements.
**Request Body:**

```json
{  
  "FXQL": "USD-GBP {\\n  BUY 0.85\\n  SELL 0.90\\n  CAP 10000\\n}\\n\\nEUR-JPY {\\n  BUY 145.20\\n  SELL 146.50\\n  CAP 50000\\n"  
}  
```

**Success Response (200 OK):**

```json
{  
  "message": "FXQL Statement Parsed Successfully.",  
  "code": "FXQL-200",  
  "data": [  
    {  
      "SourceCurrency": "USD",  
      "DestinationCurrency": "GBP",  
      "BuyPrice": 0.85,  
      "SellPrice": 0.9,  
      "CapAmount": 10000  
    },  
    {  
      "SourceCurrency": "EUR",  
      "DestinationCurrency": "JPY",  
      "BuyPrice": 145.2,  
      "SellPrice": 146.5,  
      "CapAmount": 50000  
    }  
  ]  
}  
```

**Error Response (400 Bad Request):**

```json
{  
  "message": "Invalid FXQL statement: {statement}",  
  "code": "FXQL-400"  
}  
```

## Assumptions and Design Decisions

1. **Statement Parsing Rules:** FXQL statements must adhere to strict formatting (e.g., no missing spaces, properly formatted currency codes).
2. **Logging:** All errors are logged to the `logs` folder for debugging.

## Local Development Requirements

* Node.js: v16+
* PostgreSQL: 13+
* NPM: 7+
* Prisma: Installed globally or as a project dependency

## Development Commands

* Run tests

```bash
npm run test
```

## Logging

Error logs are stored in a logs folder located in the parent directory. Each log file is timestamped for easy tracking.

# Notes

* Ensure that DATABASE_URL is correctly configured before running the application.
* Rate limiting and input sanitization are enabled for all endpoints.
* Swagger API documentation is automatically generated and accessible in the development environment.