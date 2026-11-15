import "server-only";
import { asc, eq } from "drizzle-orm";
import { db, t } from "@/db";

export async function listRequesters(clientId: string) {
  return db.select().from(t.requesters).where(eq(t.requesters.clientId, clientId)).orderBy(asc(t.requesters.name));
}
