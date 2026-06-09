import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST() {
  try {
    // Secret key দিয়ে Supabase client তৈরি — এটা RLS bypass করে
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SECRET_KEY
    );

    // সব expenses delete করো
    const { error: expError } = await supabaseAdmin
      .from("expenses")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (expError) throw new Error("Failed to delete expenses: " + expError.message);

    // সব settlement_history delete করো
    const { error: histError } = await supabaseAdmin
      .from("settlement_history")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (histError) throw new Error("Failed to delete settlement history: " + histError.message);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Clear all data error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}