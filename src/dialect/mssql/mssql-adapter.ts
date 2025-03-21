import { Kysely } from '../../kysely.js'
import { DEFAULT_MIGRATION_TABLE } from '../../migration/migrator.js'
import { sql } from '../../raw-builder/sql.js'
import { DialectAdapterBase } from '../dialect-adapter-base.js'

export class MssqlAdapter extends DialectAdapterBase {
  override get supportsCreateIfNotExists(): boolean {
    return false
  }

  override get supportsTransactionalDdl(): boolean {
    return true
  }

  override get supportsOutput(): boolean {
    return true
  }

  override async acquireMigrationLock(db: Kysely<any>): Promise<void> {
    // Acquire a transaction-level exclusive lock on the migrations table.
    // https://learn.microsoft.com/en-us/sql/relational-databases/system-stored-procedures/sp-getapplock-transact-sql?view=sql-server-ver16
    await sql`exec sp_getapplock @DbPrincipal = ${sql.lit(
      'dbo',
    )}, @Resource = ${sql.lit(DEFAULT_MIGRATION_TABLE)}, @LockMode = ${sql.lit(
      'Exclusive',
    )}`.execute(db)
  }

  override async releaseMigrationLock(): Promise<void> {
    // Nothing to do here. `sp_getapplock` is automatically released at the
    // end of the transaction and since `supportsTransactionalDdl` true, we know
    // the `db` instance passed to acquireMigrationLock is actually a transaction.
  }
}
