import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config({ path: ".env.migration.local", quiet: true });

const args = new Set(process.argv.slice(2));
const includeChecksums = args.has("--checksums");
const assertEmpty = args.has("--assert-empty");

const sourceUrl = process.env.SOURCE_DATABASE_URL?.trim();
const targetUrl = process.env.TARGET_DATABASE_URL?.trim();
const databaseUrl = process.env.DATABASE_URL?.trim();

const isPostgresUrl = (value) => /^postgres(?:ql)?:\/\//i.test(value ?? "");

const requirePostgresUrl = (name, value) => {
  if (!value) throw new Error(`${name} is not set.`);
  if (!isPostgresUrl(value)) throw new Error(`${name} must be a PostgreSQL connection URL.`);
};

const quoteIdentifier = (value) => `"${String(value).replaceAll('"', '""')}"`;
const relationName = (schema, table) => `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;

const query = async (client, sql) => client.$queryRawUnsafe(sql);

const getTableChecksum = async (client, schema, table) => {
  const relation = relationName(schema, table);
  const rows = await query(
    client,
    `SELECT md5(COALESCE(string_agg(row_hash, '' ORDER BY row_hash), '')) AS checksum
       FROM (SELECT md5(to_jsonb(t)::text) AS row_hash FROM ${relation} AS t) AS checksummed_rows`
  );
  return rows[0]?.checksum ?? null;
};

const getRuntimeSnapshotSummary = async (client, tableNames) => {
  if (!tableNames.has("public.RuntimeSnapshot")) return [];

  return query(
    client,
    `SELECT
       "id",
       md5("data"::text) AS data_checksum,
       octet_length("data"::text) AS data_bytes,
       CASE WHEN jsonb_typeof("data"->'users') = 'array' THEN jsonb_array_length("data"->'users') END AS users,
       CASE WHEN jsonb_typeof("data"->'classes') = 'array' THEN jsonb_array_length("data"->'classes') END AS classes,
       CASE WHEN jsonb_typeof("data"->'quizSets') = 'array' THEN jsonb_array_length("data"->'quizSets') END AS quiz_sets,
       CASE WHEN jsonb_typeof("data"->'sessions') = 'array' THEN jsonb_array_length("data"->'sessions') END AS sessions,
       CASE WHEN jsonb_typeof("data"->'answers') = 'array' THEN jsonb_array_length("data"->'answers') END AS answers,
       "updatedAt"::text AS updated_at
     FROM "public"."RuntimeSnapshot"
     ORDER BY "id"`
  );
};

const inspectDatabase = async (label, url) => {
  const client = new PrismaClient({ datasources: { db: { url } } });

  try {
    const [databaseInfo] = await query(
      client,
      `SELECT
         current_database() AS database_name,
         current_setting('server_version') AS server_version,
         current_setting('TimeZone') AS timezone,
         pg_database_size(current_database()) AS database_bytes,
         pg_size_pretty(pg_database_size(current_database())) AS database_size`
    );

    const extensions = await query(
      client,
      `SELECT extname AS name, extversion AS version
       FROM pg_extension
       ORDER BY extname`
    );

    const customSchemas = await query(
      client,
      `SELECT nspname AS schema_name
       FROM pg_namespace
       WHERE nspname <> 'public'
         AND nspname NOT LIKE 'pg_%'
         AND nspname NOT IN (
           'information_schema',
           'auth',
           'storage',
           'realtime',
           'extensions',
           'graphql',
           'graphql_public',
           'supabase_functions',
           'supabase_migrations',
           'vault',
           'pgsodium',
           'pgsodium_masks',
           'net',
           'cron'
         )
       ORDER BY nspname`
    );

    const nonPublicTables = await query(
      client,
      `SELECT n.nspname AS schema_name, c.relname AS table_name
       FROM pg_class AS c
       JOIN pg_namespace AS n ON n.oid = c.relnamespace
       WHERE c.relkind IN ('r', 'p')
         AND n.nspname <> 'public'
         AND n.nspname NOT LIKE 'pg_%'
         AND n.nspname NOT IN (
           'information_schema',
           'auth',
           'storage',
           'realtime',
           'extensions',
           'graphql',
           'graphql_public',
           'supabase_functions',
           'supabase_migrations',
           'vault',
           'pgsodium',
           'pgsodium_masks',
           'net',
           'cron'
         )
       ORDER BY n.nspname, c.relname`
    );

    const tables = await query(
      client,
      `SELECT
         n.nspname AS schema_name,
         c.relname AS table_name,
         c.relkind AS relation_kind,
         pg_total_relation_size(c.oid) AS total_bytes,
         pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size
       FROM pg_class AS c
       JOIN pg_namespace AS n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relkind IN ('r', 'p')
       ORDER BY n.nspname, c.relname`
    );

    for (const table of tables) {
      const relation = relationName(table.schema_name, table.table_name);
      const [{ row_count: rowCount }] = await query(
        client,
        `SELECT count(*) AS row_count FROM ${relation}`
      );
      table.row_count = rowCount;
      if (includeChecksums) {
        table.checksum = await getTableChecksum(client, table.schema_name, table.table_name);
      }
    }

    const columns = await query(
      client,
      `SELECT
         table_schema AS schema_name,
         table_name,
         ordinal_position,
         column_name,
         data_type,
         udt_schema,
         udt_name,
         is_nullable,
         column_default,
         is_identity
       FROM information_schema.columns
       WHERE table_schema = 'public'
       ORDER BY table_schema, table_name, ordinal_position`
    );

    const constraints = await query(
      client,
      `SELECT
         n.nspname AS schema_name,
         c.relname AS table_name,
         con.conname AS constraint_name,
         con.contype AS constraint_type,
         con.condeferrable AS is_deferrable,
         con.condeferred AS is_deferred,
         pg_get_constraintdef(con.oid, true) AS definition
       FROM pg_constraint AS con
       JOIN pg_class AS c ON c.oid = con.conrelid
       JOIN pg_namespace AS n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
       ORDER BY n.nspname, c.relname, con.conname`
    );

    const indexes = await query(
      client,
      `SELECT schemaname AS schema_name, tablename AS table_name, indexname AS index_name, indexdef AS definition
       FROM pg_indexes
       WHERE schemaname = 'public'
       ORDER BY schemaname, tablename, indexname`
    );

    const triggers = await query(
      client,
      `SELECT
         n.nspname AS schema_name,
         c.relname AS table_name,
         t.tgname AS trigger_name,
         pg_get_triggerdef(t.oid, true) AS definition
       FROM pg_trigger AS t
       JOIN pg_class AS c ON c.oid = t.tgrelid
       JOIN pg_namespace AS n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND NOT t.tgisinternal
       ORDER BY n.nspname, c.relname, t.tgname`
    );

    const enums = await query(
      client,
      `SELECT
         n.nspname AS schema_name,
         t.typname AS type_name,
         e.enumsortorder AS sort_order,
         e.enumlabel AS value
       FROM pg_type AS t
       JOIN pg_enum AS e ON e.enumtypid = t.oid
       JOIN pg_namespace AS n ON n.oid = t.typnamespace
       WHERE n.nspname = 'public'
       ORDER BY n.nspname, t.typname, e.enumsortorder`
    );

    const routines = await query(
      client,
      `SELECT
         n.nspname AS schema_name,
         p.proname AS routine_name,
         pg_get_function_identity_arguments(p.oid) AS arguments,
         pg_get_function_result(p.oid) AS result,
         md5(pg_get_functiondef(p.oid)) AS definition_checksum
       FROM pg_proc AS p
       JOIN pg_namespace AS n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public'
         AND p.prokind IN ('f', 'p')
         AND NOT EXISTS (
           SELECT 1
           FROM pg_depend AS d
           WHERE d.classid = 'pg_proc'::regclass
             AND d.objid = p.oid
             AND d.deptype = 'e'
         )
       ORDER BY n.nspname, p.proname, arguments`
    );

    const sequenceRows = await query(
      client,
      `SELECT sequence_schema AS schema_name, sequence_name
       FROM information_schema.sequences
       WHERE sequence_schema = 'public'
       ORDER BY sequence_schema, sequence_name`
    );

    const sequences = [];
    for (const sequence of sequenceRows) {
      const relation = relationName(sequence.schema_name, sequence.sequence_name);
      const [state] = await query(
        client,
        `SELECT last_value::text AS last_value, is_called FROM ${relation}`
      );
      sequences.push({ ...sequence, ...state });
    }

    const tableNames = new Set(tables.map((table) => `${table.schema_name}.${table.table_name}`));
    const runtimeSnapshots = await getRuntimeSnapshotSummary(client, tableNames);

    return {
      label,
      databaseInfo,
      extensions,
      customSchemas,
      nonPublicTables,
      tables,
      columns,
      constraints,
      indexes,
      triggers,
      enums,
      routines,
      sequences,
      runtimeSnapshots
    };
  } finally {
    await client.$disconnect();
  }
};

const stringify = (value) =>
  JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? item.toString() : item), 2);

const comparable = (inspection) => ({
  nonPublicTables: inspection.nonPublicTables,
  tables: inspection.tables.map(({ total_bytes, total_size, ...table }) => table),
  columns: inspection.columns,
  // PostgreSQL 18 exposes NOT NULL declarations as pg_constraint rows, while
  // PostgreSQL 17 (Supabase) represents the same fact in information_schema
  // column nullability. Column metadata above is the portable comparison;
  // exclude only those internal NOT NULL rows from constraint comparison.
  constraints: inspection.constraints.filter((constraint) => constraint.constraint_type !== "n"),
  indexes: inspection.indexes,
  triggers: inspection.triggers,
  enums: inspection.enums,
  routines: inspection.routines,
  sequences: inspection.sequences,
  runtimeSnapshots: inspection.runtimeSnapshots.map(({ updated_at, ...snapshot }) => snapshot)
});

const printInspection = (inspection) => {
  console.log(`\n${inspection.label}`);
  console.log(
    `PostgreSQL ${inspection.databaseInfo.server_version}; database size ${inspection.databaseInfo.database_size}; timezone ${inspection.databaseInfo.timezone}`
  );
  console.table(
    inspection.tables.map((table) => ({
      table: `${table.schema_name}.${table.table_name}`,
      rows: String(table.row_count),
      size: table.total_size,
      ...(includeChecksums ? { checksum: table.checksum } : {})
    }))
  );
  if (inspection.runtimeSnapshots.length > 0) {
    console.log("RuntimeSnapshot logical inventory (no record contents are printed):");
    console.table(
      inspection.runtimeSnapshots.map((snapshot) => ({
        id: snapshot.id,
        bytes: snapshot.data_bytes,
        users: snapshot.users,
        classes: snapshot.classes,
        quizSets: snapshot.quiz_sets,
        sessions: snapshot.sessions,
        answers: snapshot.answers,
        checksum: snapshot.data_checksum
      }))
    );
  }
  console.log(
    `Extensions: ${inspection.extensions.map((extension) => `${extension.name} ${extension.version}`).join(", ")}`
  );
  if (inspection.customSchemas.length > 0 || inspection.nonPublicTables.length > 0) {
    console.warn(
      `Custom non-public schemas/tables detected: ${inspection.customSchemas.map((item) => item.schema_name).join(", ") || "none"}; ` +
      `${inspection.nonPublicTables.map((item) => `${item.schema_name}.${item.table_name}`).join(", ") || "none"}. ` +
      "The public-only migration wrapper must not be used until these objects are classified."
    );
  }
  console.log(
    `Constraints: ${inspection.constraints.length}; indexes: ${inspection.indexes.length}; sequences: ${inspection.sequences.length}; triggers: ${inspection.triggers.length}; public routines: ${inspection.routines.length}`
  );
};

const main = async () => {
  if (assertEmpty) {
    requirePostgresUrl("DATABASE_URL", databaseUrl);
    const inspection = await inspectDatabase("DATABASE AUDIT", databaseUrl);
    printInspection(inspection);

    if (inspection.nonPublicTables.length > 0) {
      console.error("\nCUSTOM SCHEMA CHECK FAILED: classify and explicitly migrate non-public application tables before continuing.");
      process.exitCode = 4;
    } else if (inspection.tables.length > 0) {
      console.error("\nTARGET IS NOT EMPTY: restore was stopped before making changes.");
      process.exitCode = 3;
    } else {
      console.log("\nTARGET EMPTY CHECK PASSED: no application tables exist in public.");
    }
    return;
  }

  if (sourceUrl || targetUrl) {
    requirePostgresUrl("SOURCE_DATABASE_URL", sourceUrl);
    requirePostgresUrl("TARGET_DATABASE_URL", targetUrl);

    const source = await inspectDatabase("SOURCE (Render)", sourceUrl);
    const target = await inspectDatabase("TARGET (Supabase)", targetUrl);
    printInspection(source);
    printInspection(target);

    const sourceComparable = comparable(source);
    const targetComparable = comparable(target);
    const sections = Object.keys(sourceComparable);
    const mismatches = sections.filter(
      (section) => stringify(sourceComparable[section]) !== stringify(targetComparable[section])
    );

    if (mismatches.length > 0) {
      console.error(`\nVERIFICATION FAILED: ${mismatches.join(", ")} differ.`);
      process.exitCode = 2;
      return;
    }

    console.log("\nVERIFICATION PASSED: public schema metadata, exact row counts, sequence state, and RuntimeSnapshot checksums match.");
    return;
  }

  requirePostgresUrl("DATABASE_URL", databaseUrl);
  const inspection = await inspectDatabase("DATABASE AUDIT", databaseUrl);
  printInspection(inspection);

  if (args.has("--json")) console.log(stringify(inspection));
};

main().catch((error) => {
  console.error(`Database audit failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
