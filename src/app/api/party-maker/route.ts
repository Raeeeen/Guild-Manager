import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb/mongodb";

const DB_NAME = "announcebot";
const COLLECTION = "partyMaker";
const DOC_ID = "current"; // 

export async function GET() {
  const client = await clientPromise;
  const db = client.db(DB_NAME);
  const doc = await db.collection(COLLECTION).findOne({ _id: DOC_ID });
  return NextResponse.json(doc ?? { partySize: 5, parties: [] });
}

export async function PUT(request: Request) {
  const { partySize, parties } = await request.json();
  if (!Array.isArray(parties) || typeof partySize !== "number") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const client = await clientPromise;
  const db = client.db(DB_NAME);
  await db
    .collection(COLLECTION)
    .updateOne({ _id: DOC_ID }, { $set: { partySize, parties, updatedAt: new Date() } }, { upsert: true });
  return NextResponse.json({ ok: true });
}