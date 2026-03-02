import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
import { config } from "../config";
import { log } from "./logger";

class Database {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: config.databaseUrl,
    });

    this.pool.on("error", (err, client) => {
      log.error(`Unexpected DB Error on idle client: ${err.message}`);
    });
  }

  /**
   * Run a simple query directly on the pool without checking out a client.
   * Best for fast, single queries.
   */
  public async query<R extends QueryResultRow = any>(
    text: string,
    params?: any[],
  ): Promise<QueryResult<R>> {
    const start = Date.now();
    try {
      const res = await this.pool.query<R>(text, params);
      const duration = Date.now() - start;
      log.info(`Executed query, takes ${duration}ms, rows: ${res.rowCount}`);
      return res;
    } catch (err: any) {
      log.error(`Query Failed [${text}]: ${err.message}`);
      throw err;
    }
  }

  /**
   * Acquire a dedicated client from the pool for transactions or sequential queries.
   */
  public async getClient(): Promise<PoolClient> {
    log.info(`Acquiring database client...`);
    const client = await this.pool.connect();
    return client;
  }

  /**
   * Completely shut down the database connection pool.
   */
  public async close(): Promise<void> {
    log.info(`Ending database pool...`);
    await this.pool.end();
  }
}

// Export a singleton instance.
export const db = new Database();

// Export the class definition if consumers need to instantiate it or mock it.
export { Database };
