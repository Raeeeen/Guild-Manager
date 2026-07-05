import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const BUCKET = "announcement-images";

export async function POST(req: NextRequest) {
  if (req.headers.get("x-api-key") !== process.env.BOT_INTERNAL_API_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { images } = await req.json();
    if (!Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ deleted: 0 });
    }

    // Extract the storage filename from each public URL
    const filenames = images
      .map((url: string) => url.split(`${BUCKET}/`).pop())
      .filter(Boolean) as string[];

    if (filenames.length === 0) {
      return NextResponse.json({ deleted: 0 });
    }

    const { error } = await supabase.storage.from(BUCKET).remove(filenames);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ deleted: filenames.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}