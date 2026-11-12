import { MongoClient, type ClientSession, type Collection, type Db, type Document } from "mongodb";
export type AppDb=Omit<Db,"collection">&{collection<T extends Document=Document>(name:string):Collection<T&{_id:string}>};
const g = globalThis as typeof globalThis & { mongo?: Promise<MongoClient> };
function getClient() {
  const uri=process.env.MONGODB_URI;
  if(!uri) throw new Error("MONGODB_URI must be configured.");
  const client=g.mongo ?? new MongoClient(uri).connect();
  if(process.env.NODE_ENV!=="production")g.mongo=client;
  return client;
}
let ready: Promise<void> | undefined;
export async function getDb(): Promise<AppDb> {
  const db = (await getClient()).db(process.env.MONGODB_DB || "campus_compass");
  ready ??= Promise.all([
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
    db.collection("reports").createIndex({ state: 1, kind: 1, category: 1, created_at: -1 }),
    db.collection("reports").createIndex({ reporter_id: 1, created_at: -1 }),
    db.collection("reports").createIndex({ title: "text", description: "text", location: "text" }),
    db.collection("claims").createIndex({ report_id: 1, created_at: -1 }),
    db.collection("claims").createIndex({ claimant_id: 1, created_at: -1 }),
    db.collection("messages").createIndex({ claim_id: 1, created_at: 1 }),
    db.collection("notifications").createIndex({ user_id: 1, created_at: -1 }),
    db.collection("saved_items").createIndex({ user_id: 1, report_id: 1 }, { unique: true }),
  ]).then(() => undefined);
  await ready;
  return db as AppDb;
}

export async function withMongoTransaction<T>(operation: (session: ClientSession) => Promise<T>): Promise<T> {
  const client = await getClient();
  const session = client.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await operation(session);
      return result;
    });
    if (result === undefined) throw new Error("MongoDB transaction completed without a result.");
    return result;
  } finally {
    await session.endSession();
  }
}
