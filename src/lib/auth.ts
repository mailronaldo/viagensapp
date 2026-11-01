import "server-only";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { getSessionUserId } from "./session";

export type CurrentUser = { id: string; name: string; email: string };

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const [user] = await db
    .select({ id: t.users.id, name: t.users.name, email: t.users.email })
    .from(t.users)
    .where(eq(t.users.id, userId))
    .limit(1);
  return user ?? null;
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
