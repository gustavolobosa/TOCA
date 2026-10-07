// Simulación en memoria para probar el navegador y los Server Actions.
// No es una base de datos ni demuestra que las políticas RLS reales funcionen.
import { createServer } from "node:http";
import { createHmac, randomUUID } from "node:crypto";

export const adminId = "c8a7ce34-ca9c-4d20-b7d3-60279adc9812";
export const secretKey = "sb_secret_e2e_fixture_only";
const signingKey = "local-test-only-never-production";

export async function startFixture() {
  const profiles = [{ id: adminId, name: "Administrador de prueba", email: "admin@example.com", is_admin: true, is_active: true, must_change_password: true, token_valid_after: 0, created_at: new Date().toISOString() }];
  const users = [{ id: adminId, email: profiles[0].email, password: "SoloTest123!abc", factors: [] }];
  const links = [], events = [], history = [], sessions = new Map(), requests = [];
  let origin;
  const userDto = user => ({ id: user.id, email: user.email, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, factors: user.factors, created_at: new Date().toISOString() });
  function session(user, aal = "aal1") {
    const id = randomUUID(); sessions.set(id, user.id);
    const payload = { sub: user.id, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, aal, session_id: id, role: "authenticated", aud: "authenticated", iss: `${origin}/auth/v1`, amr: [] };
    const token = [Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"), Buffer.from(JSON.stringify(payload)).toString("base64url")].join(".");
    return { access_token: `${token}.${createHmac("sha256", signingKey).update(token).digest("base64url")}`, token_type: "bearer", expires_in: 3600, refresh_token: randomUUID(), user: userDto(user) };
  }
  const profileOf = id => profiles.find(profile => profile.id === id);
  const isAdmin = actor => { const p = profileOf(actor); return p?.is_admin && p.is_active && !p.must_change_password; };
  const appendHistory = link => history.push({ id: history.length + 1, nfc_link_id: link.id, destination_url: link.destination_url, destination_type: link.destination_type, created_at: new Date().toISOString() });

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, origin);
    let raw = ""; for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : {};
    requests.push({ method: req.method, path: url.pathname }); // Nunca registra contraseñas/cuerpos/tokens.
    function send(data, status = 200, total) {
      res.writeHead(status, { "content-type": "application/json", ...(total !== undefined ? { "content-range": `0-${Math.max(0, total - 1)}/${total}` } : {}) });
      res.end(JSON.stringify(data));
    }
    const fail = (message = "Not authorized", status = 403) => send({ code: "42501", message }, status);
    const service = req.headers.apikey === secretKey;
    const token = req.headers.authorization?.replace(/^Bearer /, "");
    let claims;
    try {
      const [header, payload, signature] = token.split(".");
      if (signature === createHmac("sha256", signingKey).update(`${header}.${payload}`).digest("base64url")) {
        const candidate = JSON.parse(Buffer.from(payload, "base64url").toString());
        if (sessions.has(candidate.session_id)) claims = candidate;
      }
    } catch { /* Solicitud anónima o clave de servicio. */ }
    const user = users.find(item => item.id === claims?.sub);
    const profile = profileOf(user?.id);

    if (url.pathname === "/auth/v1/token") {
      const account = users.find(item => item.email === body.email && item.password === body.password);
      return account ? send(session(account)) : send({ code: "invalid_credentials", msg: "Invalid login credentials" }, 400);
    }
    if (url.pathname === "/auth/v1/user") {
      if (!user) return fail("Session expired", 401);
      if (req.method === "PUT") {
        if (body.current_password !== user.password) return fail("Current password required", 400);
        user.password = body.password;
      }
      return send(userDto(user));
    }
    if (url.pathname === "/auth/v1/logout") {
      if (url.searchParams.get("scope") === "global") {
        for (const [id, accountId] of sessions) if (accountId === claims?.sub) sessions.delete(id);
      }
      else sessions.delete(claims?.session_id);
      return send({});
    }
    if (url.pathname === "/auth/v1/admin/users") {
      if (!service) return fail();
      if (users.some(item => item.email === body.email)) return fail("Already registered", 422);
      const account = { id: randomUUID(), email: body.email, password: body.password, factors: [] };
      users.push(account); return send(userDto(account));
    }
    if (url.pathname === "/auth/v1/factors" && req.method === "POST") {
      if (!user) return fail();
      const factor = { id: randomUUID(), factor_type: "totp", status: "unverified", friendly_name: "TOCA" };
      user.factors.push(factor);
      return send({ ...factor, type: "totp", totp: { qr_code: '<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220"><rect width="220" height="220" fill="white"/><text x="20" y="100">QR de prueba</text></svg>', secret: "FIXTUREONLY", uri: "otpauth://totp/fixture" } });
    }
    if (url.pathname.startsWith("/auth/v1/factors/")) {
      const [, , , , id, step] = url.pathname.split("/");
      const factor = user?.factors.find(item => item.id === id);
      if (!factor) return fail();
      if (req.method === "DELETE") { user.factors = user.factors.filter(item => item.id !== id); return send({}); }
      if (step === "challenge") return send({ id: randomUUID(), expires_at: Math.floor(Date.now() / 1000) + 60 });
      if (step === "verify" && body.code === "123456") { factor.status = "verified"; return send(session(user, "aal2")); }
      return fail("Invalid code", 400);
    }
    if (!url.pathname.startsWith("/rest/v1/")) return fail("Unexpected fixture endpoint", 404);
    const panelAccess = profile?.is_active && !profile.must_change_password && claims.iat >= profile.token_valid_after && (!profile.is_admin || claims.aal === "aal2");
    const visible = link => service || (panelAccess && (link.owner_id === user.id || profile.is_admin));
    if (url.pathname.startsWith("/rest/v1/rpc/")) {
      if (!service) return fail();
      const name = url.pathname.split("/").at(-1);
      if (name === "complete_password_change") {
        const target = profileOf(body.actor); if (!target?.is_active) return fail();
        target.must_change_password = false; target.token_valid_after = Math.ceil(Date.now() / 1000); return send(null);
      }
      if (name === "resolve_nfc") {
        const link = links.find(item => item.slug === body.tag_slug && item.is_active && !item.requires_configuration && profileOf(item.owner_id)?.is_active);
        if (!link) return send(null);
        if (body.record_visit) events.push({ id: events.length + 1, nfc_link_id: link.id, destination_url: link.destination_url, destination_type: link.destination_type, created_at: new Date().toISOString() });
        return send({ destination_url: link.destination_url, destination_type: link.destination_type, recorded: body.record_visit });
      }
      if (name === "update_nfc") {
        const link = links.find(item => item.id === body.tag_id);
        const actor = profileOf(body.actor);
        if (!link || !actor?.is_active || actor.must_change_password || (link.owner_id !== body.actor && !isAdmin(body.actor)) || !profileOf(link.owner_id)?.is_active) return fail();
        const changed = link.destination_url !== body.url || link.destination_type !== body.kind;
        if (!changed && link.requires_configuration && body.active) return fail();
        Object.assign(link, { name: body.title, destination_type: body.kind, destination_url: body.url, is_active: body.active, requires_configuration: link.requires_configuration && !changed, updated_at: new Date().toISOString() });
        if (changed) appendHistory(link); return send(null);
      }
      if (!isAdmin(body.actor)) return fail();
      if (name === "register_profile") {
        profiles.push({ id: body.target, name: body.display_name, email: body.target_email, is_active: true, is_admin: false, must_change_password: true, token_valid_after: 0, created_at: new Date().toISOString() }); return send(null);
      }
      if (name === "create_nfc") {
        if (!profileOf(body.target)?.is_active) return fail();
        const link = { id: links.length + 1, owner_id: body.target, name: body.title, slug: body.tag_slug, destination_type: body.kind, destination_url: body.url, is_active: true, requires_configuration: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        links.push(link); appendHistory(link); return send(link.id);
      }
      if (name === "reassign_nfc") {
        const link = links.find(item => item.id === body.tag_id); if (!link || !profileOf(body.target)?.is_active || link.owner_id === body.target) return fail();
        Object.assign(link, { owner_id: body.target, is_active: false, requires_configuration: true }); return send(null);
      }
      if (name === "set_profile_active") {
        const target = profileOf(body.target); if (!target || target.is_admin) return fail();
        target.is_active = body.active;
        if (!body.active) links.filter(link => link.owner_id === body.target).forEach(link => { link.is_active = false; }); return send(null);
      }
      return fail("Unexpected RPC", 404);
    }
    if (req.method !== "GET") return fail("Direct writes forbidden");
    const table = url.pathname.split("/").at(-1);
    let rows;
    if (table === "profiles") rows = profiles.filter(item => service || item.id === user?.id);
    else if (table === "nfc_links") rows = links.filter(visible);
    else if (table === "nfc_link_summaries") rows = links.filter(visible).map(link => ({ ...link, total_taps: events.filter(item => item.nfc_link_id === link.id).length, last_touched_at: events.filter(item => item.nfc_link_id === link.id).at(-1)?.created_at ?? null }));
    else if (table === "redirect_events" || table === "nfc_destination_history") rows = (table === "redirect_events" ? events : history).filter(item => links.some(link => link.id === item.nfc_link_id && visible(link)));
    else if (table === "nfc_daily_stats") {
      rows = [];
      for (const event of events.filter(item => links.some(link => link.id === item.nfc_link_id && visible(link)))) {
        const day = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Santiago" }).format(new Date(event.created_at));
        const row = rows.find(item => item.nfc_link_id === event.nfc_link_id && item.day === day && item.destination_type === event.destination_type);
        if (row) row.visits++; else rows.push({ nfc_link_id: event.nfc_link_id, day, destination_type: event.destination_type, visits: 1 });
      }
    } else return fail("Unexpected table", 404);
    for (const [key, value] of url.searchParams) {
      if (value.startsWith("eq.")) rows = rows.filter(row => String(row[key]) === value.slice(3));
      if (value.startsWith("gte.")) rows = rows.filter(row => String(row[key]) >= value.slice(4));
    }
    const total = rows.length;
    if (url.searchParams.has("order")) {
      const [key, direction] = url.searchParams.get("order").split(/[.,]/);
      rows.sort((a, b) => String(a[key]).localeCompare(String(b[key])) * (direction === "desc" ? -1 : 1));
    }
    const from = Number(url.searchParams.get("offset") ?? 0), limit = Number(url.searchParams.get("limit") ?? 1000);
    rows = rows.slice(from, from + limit);
    if (req.headers.accept?.includes("vnd.pgrst.object")) return rows.length === 1 ? send(rows[0], 200, total) : send({ code: "PGRST116", details: "The result contains 0 rows", message: "No rows" }, 406, total);
    return send(rows, 200, total);
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  return { origin, server, profiles, users, links, events, history, requests };
}
