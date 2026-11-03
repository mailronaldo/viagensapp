// Cria a conta MASTER (a agência) na primeira subida, a partir de variáveis de ambiente.
// Idempotente: se já existe um MASTER, não faz nada. Roda depois das migrações.
//
//   MASTER_EMAIL, MASTER_PASSWORD (mín. 8 caracteres), MASTER_NAME (opcional)
//
// Depois que a conta existir, REMOVA MASTER_PASSWORD das variáveis de ambiente.
import { randomBytes } from "node:crypto";
import pg from "pg";
import bcrypt from "bcryptjs";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL não definida.");
  process.exit(1);
}

const email = process.env.MASTER_EMAIL?.trim().toLowerCase();
const password = process.env.MASTER_PASSWORD;
const name = process.env.MASTER_NAME?.trim() || "Agência";

const pool = new pg.Pool({ connectionString: url, max: 1 });

async function main() {
  const { rows } = await pool.query("select count(*)::int as n from users where role = 'MASTER'");
  if (rows[0].n > 0) {
    console.log("Conta master já existe.");
    return;
  }

  if (!email || !password) {
    console.warn(
      "AVISO: não existe nenhuma conta MASTER e MASTER_EMAIL / MASTER_PASSWORD não estão definidos. " +
        "Sem isso ninguém consegue entrar (não há cadastro público). Defina as variáveis e reinicie.",
    );
    return;
  }
  if (password.length < 8) {
    console.warn("AVISO: MASTER_PASSWORD precisa ter ao menos 8 caracteres. Conta master NÃO criada.");
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  const existing = await pool.query("select id from users where email = $1", [email]);
  if (existing.rowCount > 0) {
    await pool.query(
      "update users set role = 'MASTER', active = true, must_change_password = false where id = $1",
      [existing.rows[0].id],
    );
    console.log(`Conta existente ${email} promovida a MASTER (a senha dela não foi alterada).`);
    return;
  }

  await pool.query(
    `insert into users (id, email, name, password_hash, role, active, must_change_password)
     values ($1, $2, $3, $4, 'MASTER', true, false)`,
    [randomBytes(16).toString("base64url"), email, name, hash],
  );
  console.log(`Conta master criada: ${email}. Remova MASTER_PASSWORD das variáveis de ambiente.`);
}

try {
  await main();
} catch (err) {
  console.error("Falha ao criar a conta master:", err);
  process.exit(1);
} finally {
  await pool.end();
}
