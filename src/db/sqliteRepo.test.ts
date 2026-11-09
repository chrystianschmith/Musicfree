import initSqlJs from "sql.js";
import { repoContract } from "./repoContract";
import { SqliteRepo, type SqlDriver } from "./sqliteRepo";

const SQL = await initSqlJs();

/** sql.js adapter that mimics @tauri-apps/plugin-sql's execute/select API. */
function sqlJsDriver(): SqlDriver {
  const db = new SQL.Database();
  return {
    async execute(sql, params = []) {
      db.run(sql, params as never[]);
      return { rowsAffected: db.getRowsModified() };
    },
    async select<T>(sql: string, params: unknown[] = []) {
      const st = db.prepare(sql);
      st.bind(params as never[]);
      const rows: T[] = [];
      while (st.step()) rows.push(st.getAsObject() as T);
      st.free();
      return rows;
    },
  };
}

repoContract("sqlite", async () => SqliteRepo.open(sqlJsDriver()));
