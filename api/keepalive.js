export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ ok: false });
  }

  const supabaseUrl = String(process.env.VITE_SUPABASE_URL ?? "").replace(
    /\/$/,
    "",
  );
  const supabaseKey = String(process.env.VITE_SUPABASE_ANON_KEY ?? "");

  if (!supabaseUrl || !supabaseKey) {
    return response.status(500).json({ ok: false, error: "missing_env" });
  }

  try {
    const ping = await fetch(`${supabaseUrl}/rest/v1/games?select=id&limit=1`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Accept: "application/json",
      },
    });

    // Paused free projects return HTTP 540 and cannot be woken by this ping.
    if (ping.status === 540) {
      return response.status(503).json({
        ok: false,
        error: "paused",
      });
    }

    if (!ping.ok) {
      return response.status(502).json({ ok: false, error: "supabase_error" });
    }

    return response.status(200).json({ ok: true });
  } catch {
    return response.status(502).json({ ok: false, error: "network_error" });
  }
}
