import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb/mongodb";

const DB_NAME = "announcebot";
const COLLECTION = "eventAttendance";
const DOC_ID = "current";

type AttendanceSheetDoc = {
  _id: string;
  sheets: unknown[];
  updatedAt?: Date;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasStringField(value: Record<string, unknown>, field: string) {
  return typeof value[field] === "string";
}

export async function GET() {
  const client = await clientPromise;
  const db = client.db(DB_NAME);
  const doc = await db
    .collection<AttendanceSheetDoc>(COLLECTION)
    .findOne({ _id: DOC_ID });

  return NextResponse.json({ sheets: doc?.sheets ?? [] });
}

export async function POST(request: Request) {
  const payload = await request.json();
  const sheet = payload?.sheet;

  if (!isRecord(sheet) || !hasStringField(sheet, "id") || !hasStringField(sheet, "name")) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const client = await clientPromise;
  const db = client.db(DB_NAME);
  const collection = db.collection<AttendanceSheetDoc>(COLLECTION);
  const existing = await collection.findOne({ _id: DOC_ID });
  const sheets = Array.isArray(existing?.sheets) ? [...existing.sheets] : [];

  sheets.push(sheet);

  await collection.updateOne(
    { _id: DOC_ID },
    {
      $set: {
        sheets,
        updatedAt: new Date(),
      },
    },
    { upsert: true },
  );

  return NextResponse.json({ ok: true, sheet });
}

export async function PUT(request: Request) {
  const payload = await request.json();
  const sheets = payload?.sheets;

  if (!Array.isArray(sheets)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const client = await clientPromise;
  const db = client.db(DB_NAME);
  await db.collection<AttendanceSheetDoc>(COLLECTION).updateOne(
    { _id: DOC_ID },
    {
      $set: {
        sheets,
        updatedAt: new Date(),
      },
    },
    { upsert: true },
  );

  return NextResponse.json({ ok: true, sheets });
}

export async function DELETE(request: Request) {
  const payload = await request.json();
  const sheetId = payload?.sheetId;

  if (typeof sheetId !== "string" || !sheetId.trim()) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const client = await clientPromise;
  const db = client.db(DB_NAME);
  const collection = db.collection<AttendanceSheetDoc>(COLLECTION);
  const existing = await collection.findOne({ _id: DOC_ID });
  const sheets = Array.isArray(existing?.sheets)
    ? existing.sheets.filter((sheet) => isRecord(sheet) && sheet.id !== sheetId)
    : [];

  await collection.updateOne(
    { _id: DOC_ID },
    {
      $set: {
        sheets,
        updatedAt: new Date(),
      },
    },
    { upsert: true },
  );

  return NextResponse.json({ ok: true, sheets });
}
