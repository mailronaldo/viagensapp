// Aplica as migrações SQL da pasta ./drizzle ao iniciar o contêiner.
// Usa só dependências de produção (drizzle-orm + pg), então não precisa do drizzle-kit.
// É idempotente: migrações já aplicadas são puladas.
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL não definida. Configure a variável de ambiente no Coolify.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url, max: 1 });

// O banco pode demorar alguns segundos para aceitar conexões logo após subir.
async function waitForDb(attempts = 30) {
  for (let i = 1; i <= attempts; i++) {
    try {
      await pool.query("select 1");
      return;
    } catch (err) {
      if (i === attempts) throw err;
      console.log(`Aguardando o banco de dados (${i}/${attempts})… ${err.code ?? err.message}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

try {
  await waitForDb();
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  console.log("Migrações aplicadas.");
} catch (err) {
  console.error("Falha ao migrar o banco:", err);
  process.exit(1);
} finally {
  await pool.end();
}
