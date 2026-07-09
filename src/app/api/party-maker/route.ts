import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb/mongodb";

const DB_NAME = "announcebot";
const COLLECTION = "partyMaker";
const DOC_ID = "current";

type PartyMakerDoc = {
  _id: string;
  title?: string;
  date?: string;
  time?: string;
  partySize: number;
  parties: unknown[];
  updatedAt?: Date;
};

export async function GET() {
  const client = await clientPromise;
  const db = client.db(DB_NAME);
  const doc = await db
    .collection<PartyMakerDoc>(COLLECTION)
    .findOne({ _id: DOC_ID });
  return NextResponse.json(doc ?? { partySize: 5, parties: [] });
}

export async function PUT(request: Request) {
  const { title, date, time, partySize, parties } = await request.json();
  if (
    typeof title !== "string" ||
    typeof date !== "string" ||
    typeof time !== "string" ||
    !Array.isArray(parties) ||
    typeof partySize !== "number"
  ) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const client = await clientPromise;
  const db = client.db(DB_NAME);
  await db
    .collection<PartyMakerDoc>(COLLECTION)
    .updateOne(
      { _id: DOC_ID },
      {
        $set: {
          title,
          date,
          time,
          partySize,
          parties,
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    );
  return NextResponse.json({ ok: true });
}