import { MongoClient, type ClientSession, type Collection, type Db, type Document } from "mongodb";
export type AppDb = Omit<Db, "collection"> & { collection<T extends Document = Document>(name: string): Collection<T & { _id: string }> };
const g = globalThis as typeof globalThis & { mongo?: Promise<MongoClient>; mongoIndexesReady?: Promise<void> };
function getClient() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI must be configured.");
  if (!g.mongo) {
    g.mongo = new MongoClient(uri).connect().catch((error) => {
      g.mongo = undefined;
      throw error;
    });
  }
  return g.mongo;
}
export async function getDb(): Promise<AppDb> {
  const db = (await getClient()).db(process.env.MONGODB_DB || "campus_compass");
  g.mongoIndexesReady ??= Promise.all([
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
    db.collection("users").createIndex({ auth_status: 1, created_at: -1 }),
    db.collection("moderation_actions").createIndex({ created_at: -1 }),
    db.collection("reports").createIndex({ state: 1, kind: 1, category: 1, created_at: -1 }),
    db.collection("reports").createIndex({ reporter_id: 1, created_at: -1 }),
    db.collection("reports").createIndex({ title: "text", description: "text", location: "text" }),
    db.collection("claims").createIndex({ report_id: 1, created_at: -1 }),
    db.collection("claims").createIndex({ claimant_id: 1, created_at: -1 }),
    db.collection("claim_status_history").createIndex({ claim_id: 1, created_at: 1 }),
    db.collection("messages").createIndex({ claim_id: 1, created_at: 1 }),
    db.collection("messages").createIndex({ sender_id: 1, created_at: -1 }),
    db.collection("notifications").createIndex({ user_id: 1, created_at: -1 }),
    db.collection("notifications").createIndex({ user_id: 1, kind: 1, href: 1 }),
    db.collection("member_preferences").createIndex({ user_id: 1 }, { unique: true }),
    db.collection("saved_items").createIndex({ user_id: 1, report_id: 1 }, { unique: true }),
    db.collection("contact_messages").createIndex({ ticket_id: 1 }, { unique: true }),
    db.collection("contact_messages").createIndex({ status: 1, created_at: -1 }),
    db.collection("contact_rate_limits").createIndex({ key: 1 }, { unique: true }),
    db.collection("contact_rate_limits").createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }),
  ]).then(() => undefined).catch((error) => {
    g.mongoIndexesReady = undefined;
    throw error;
  });
  await g.mongoIndexesReady;
  return db as AppDb;
}

export async function withMongoTransaction<T>(operation: (session: ClientSession) => Promise<T>): Promise<T> {
  const client = await getClient();
  const session = client.startSession();
  try {
    let result: T | undefined;
    let completed = false;
    await session.withTransaction(async () => {
      result = await operation(session);
      completed = true;
      return result;
    });
    if (!completed) throw new Error("MongoDB transaction completed without a result.");
    return result as T;
  } finally {
    await session.endSession();
  }
}
