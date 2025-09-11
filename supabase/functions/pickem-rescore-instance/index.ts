import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Extract caller user from the Authorization header
    const authHeader = req.headers.get("Authorization") ?? "";
    const authClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userResult, error: userErr } = await authClient.auth.getUser();
    if (userErr || !userResult?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userResult.user.id;

    const body = await req.json().catch(() => ({}));
    const instanceId = body.instanceId as string | undefined;

    if (!instanceId) {
      return new Response(JSON.stringify({ error: "Missing instanceId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Rescoring instance:", instanceId, "by user:", userId);

    // Load instance and huddle to authorize
    const { data: instance, error: instanceErr } = await service
      .from("pickem_instances")
      .select("id, huddle_id, created_by")
      .eq("id", instanceId)
      .single();

    if (instanceErr || !instance) {
      console.error("Instance fetch error:", instanceErr);
      return new Response(JSON.stringify({ error: "Instance not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: huddle, error: huddleErr } = await service
      .from("huddles")
      .select("owner_id")
      .eq("id", instance.huddle_id)
      .single();

    if (huddleErr || !huddle) {
      console.error("Huddle fetch error:", huddleErr);
      return new Response(JSON.stringify({ error: "Huddle not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: roleRow } = await service
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    const isAdmin = roleRow?.role === "admin";
    const isOwner = huddle.owner_id === userId || instance.created_by === userId;

    if (!isAdmin && !isOwner) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch games for this instance
    const { data: instanceGames, error: igErr } = await service
      .from("pickem_instance_games")
      .select("game_id, pickem_games(id, winning_team, status)")
      .eq("instance_id", instanceId);

    if (igErr) {
      console.error("Instance games error:", igErr);
      return new Response(JSON.stringify({ error: igErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const gameMap = new Map<string, { id: string; winning_team: string | null; status: string }>();
    for (const row of instanceGames ?? []) {
      const g = (row as any).pickem_games;
      if (g) gameMap.set(g.id, { id: g.id, winning_team: g.winning_team, status: g.status });
    }

    // Fetch entries for the instance
    const { data: entries, error: entriesErr } = await service
      .from("pickem_entries")
      .select("id")
      .eq("instance_id", instanceId);

    if (entriesErr) {
      console.error("Entries fetch error:", entriesErr);
      return new Response(JSON.stringify({ error: entriesErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const entryIds = (entries ?? []).map((e) => e.id);
    if (entryIds.length === 0) {
      console.log("No entries for instance. Nothing to rescore.");
      return new Response(JSON.stringify({ success: true, picksUpdated: 0, entriesUpdated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all picks for these entries
    const { data: picks, error: picksErr } = await service
      .from("pickem_picks")
      .select("id, entry_id, game_id, is_correct, picked_team")
      .in("entry_id", entryIds);

    if (picksErr) {
      console.error("Picks fetch error:", picksErr);
      return new Response(JSON.stringify({ error: picksErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let picksUpdated = 0;
    const affectedEntryIds = new Set<string>();

    for (const pick of picks ?? []) {
      const game = gameMap.get(pick.game_id);
      if (!game) continue;

      // Only determine correctness when the game has a winner
      if (game.winning_team) {
        const newCorrect = pick.picked_team === game.winning_team;
        if (pick.is_correct !== newCorrect) {
          const { error: updErr } = await service
            .from("pickem_picks")
            .update({ is_correct: newCorrect, updated_at: new Date().toISOString() })
            .eq("id", pick.id);

          if (updErr) {
            console.error("Update pick error:", updErr, pick.id);
          } else {
            picksUpdated += 1;
            affectedEntryIds.add(pick.entry_id);
          }
        }
      }
    }

    // Recalculate totals for affected entries (or all if none detected)
    const toRecalc = affectedEntryIds.size > 0 ? Array.from(affectedEntryIds) : entryIds;

    let entriesUpdated = 0;
    for (const eId of toRecalc) {
      const { error: rpcErr } = await service.rpc("recalculate_entry_total", { _entry_id: eId });
      if (rpcErr) {
        console.error("Recalculate error:", rpcErr, eId);
      } else {
        entriesUpdated += 1;
      }
    }

    return new Response(
      JSON.stringify({ success: true, picksUpdated, entriesUpdated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("pickem-rescore-instance error:", error);
    return new Response(JSON.stringify({ error: error?.message ?? "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
