// seed-reviewer — creates (or resets) the App Store reviewer account.
//
// The app signs in with email OTP, which Apple's reviewer can't receive. The
// client has a narrow bypass (see mobile/src/config/reviewer.ts) that signs
// the reviewer in with a password instead. This function provisions that
// password account with the service role so no password is ever typed into a
// dashboard. Idempotent: if the user already exists we just reset its password
// and ensure a profile row exists.
//
// One-shot admin utility — invoke once after deploy, then it can sit unused.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const REVIEWER_EMAIL = "appreview@sidehuddlesports.com";
const REVIEWER_PASSWORD = "ShReview!2026$Qx7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey);

    // Find an existing reviewer user (list + match; admin API has no get-by-email).
    let userId: string | null = null;
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const existing = list?.users.find(
      (u) => u.email?.toLowerCase() === REVIEWER_EMAIL,
    );

    if (existing) {
      userId = existing.id;
      // Reset password + keep it confirmed so password sign-in always works.
      await admin.auth.admin.updateUserById(userId, {
        password: REVIEWER_PASSWORD,
        email_confirm: true,
      });
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: REVIEWER_EMAIL,
        password: REVIEWER_PASSWORD,
        email_confirm: true,
      });
      if (createErr || !created.user) {
        return new Response(JSON.stringify({ error: createErr?.message ?? "create failed" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = created.user.id;
    }

    // Ensure a completed profile so the reviewer lands in the app, not onboarding.
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!profile) {
      await admin.from("profiles").insert({
        user_id: userId,
        signup_method: "email",
        display_name: "App Reviewer",
        username: "appreview",
        onboarding_completed: true,
      });
    } else {
      await admin
        .from("profiles")
        .update({ onboarding_completed: true })
        .eq("user_id", userId);
    }

    return new Response(JSON.stringify({ success: true, userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
