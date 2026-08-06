// delete-account — permanently deletes the caller's account and personal data.
// Required by App Store guideline 5.1.1(v) for apps with account sign-up.
//
// The caller's JWT identifies who to delete (a user can only delete themselves).
// We wipe their personal rows, then remove the auth user via the service role.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Personal-data tables keyed by user_id. Best-effort: a missing table or row
// shouldn't block the actual account deletion.
const USER_TABLES = [
  "shadow_bets",
  "user_portfolios",
  "huddle_members",
  "huddle_messages",
  "profiles",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";

    // Identify the caller from their own session token.
    const asUser = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await asUser.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const uid = user.id;

    const admin = createClient(url, serviceKey);

    // Wipe personal data (best-effort, never blocks the auth-user deletion).
    for (const table of USER_TABLES) {
      const { error } = await admin.from(table).delete().eq("user_id", uid);
      if (error) console.warn(`delete-account: ${table}: ${error.message}`);
    }

    // Remove the auth user — this is the deletion that actually matters.
    const { error: delErr } = await admin.auth.admin.deleteUser(uid);
    if (delErr) {
      return new Response(JSON.stringify({ error: delErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
