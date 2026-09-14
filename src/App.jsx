import React, { useEffect, useMemo, useState } from "react";
import { api } from "./api";

const resources = {
  overview: { label: "Overview", icon: "◈" },
  profile: { label: "Profile settings", icon: "⚙" },
  vehicles: { label: "Vehicles", icon: "▣", fields: [
    ["registrationNumber", "Registration number", "text"],
    ["vehicleType", "Type", "select", ["RESIDENT", "PERMANENT", "TEMPORARY", "SERVICE"]],
    ["active", "Active", "checkbox"]
  ] },
  visitors: { label: "Visitor passes", icon: "◌", fields: [
    ["visitorName", "Visitor name", "text"],
    ["visitorPhone", "Phone", "text"],
    ["registrationNumber", "Registration number", "text"],
    ["residentId", "Resident ID", "text"],
    ["validFrom", "Valid from", "datetime-local"],
    ["validUntil", "Valid until", "datetime-local"]
  ] },
  users: { label: "Residents & users", icon: "♙", fields: [
    ["name", "Full name", "text"],
    ["idNumber", "South African ID number", "text"],
    ["email", "Email", "email"],
    ["password", "Temporary password", "password"],
    ["role", "Role", "select", ["RESIDENT", "SECURITY", "ADMIN", "SYSTEM_ADMIN"]]
  ] },
  estates: { label: "Estates", icon: "⌂", fields: [
    ["name", "Estate name", "text"],
    ["code", "Estate code", "text"],
    ["timezone", "Timezone", "text"]
  ] }
};

function formatTime(value) {
  return new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function ProfileView({ user, onUserUpdate, onMessage }) {
  const [form, setForm] = useState({ email: user.email, currentPassword: "", password: "" });
  async function save(event) {
    event.preventDefault();
    try {
      const updated = await api.profile(form);
      const nextUser = { ...user, ...updated };
      localStorage.setItem("northgate_user", JSON.stringify(nextUser));
      onUserUpdate(nextUser);
      setForm({ email: updated.email, currentPassword: "", password: "" });
      onMessage("Profile settings saved.");
    } catch (error) { onMessage(error.message, "error"); }
  }
  return <section className="panel"><div className="panel-heading"><div><span className="eyebrow">Account</span><h2>Profile settings</h2></div></div><form className="record-form profile-form" onSubmit={save}><label>Full name<input value={user.name} disabled /></label><label>South African ID number<input value={user.idNumber || "Not available"} disabled /></label><label>Role<input value={user.role} disabled /></label><label>Email address<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label>Current password<input type="password" value={form.currentPassword} onChange={(event) => setForm({ ...form, currentPassword: event.target.value })} /></label><label>New password<input minLength="8" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label><div className="form-actions"><button className="button dark">Save profile</button></div></form></section>;
}

function ResourceView({ resourceKey, onMessage }) {
  const resource = resources[resourceKey];
  const [records, setRecords] = useState([]);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try { setRecords(await api.list(resourceKey)); } catch (error) { onMessage(error.message, "error"); } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [resourceKey]);

  async function save(record) {
    try {
      if (record._id) await api.update(resourceKey, record._id, record);
      else await api.create(resourceKey, record);
      setEditing(null);
      await load();
      onMessage(`${resource.label} saved.`);
    } catch (error) { onMessage(error.message, "error"); }
  }

  async function remove(id) {
    if (!window.confirm("Delete this record?")) return;
    try { await api.remove(resourceKey, id); await load(); onMessage("Record deleted."); }
    catch (error) { onMessage(error.message, "error"); }
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <div><span className="eyebrow">Management</span><h2>{resource.label}</h2></div>
        <button className="button dark" onClick={() => setEditing({})}>Add {resource.label.slice(0, -1)}</button>
      </div>
      {editing && <RecordForm resource={resource} record={editing} onCancel={() => setEditing(null)} onSave={save} />}
      {loading ? <div className="empty-light">Loading records…</div> : (
        <div className="table-wrap"><table><thead><tr>{resource.fields.map(([, label]) => <th key={label}>{label}</th>)}<th /></tr></thead>
          <tbody>{records.map((record) => <tr key={record._id}>{resource.fields.map(([key]) => <td key={key}>{String(record[key] ?? "—")}</td>)}<td className="actions"><button onClick={() => setEditing(record)}>Edit</button><button onClick={() => remove(record._id)}>Delete</button></td></tr>)}</tbody>
        </table>{!records.length && <div className="empty-light">No records yet. Add the first one to MongoDB.</div>}</div>
      )}
    </section>
  );
}

function RecordForm({ resource, record, onCancel, onSave }) {
  const [form, setForm] = useState(record);
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  return <form className="record-form" onSubmit={(event) => { event.preventDefault(); onSave(form); }}>
    {resource.fields.map(([key, label, type, options]) => <label key={key}>{label}
      {type === "select" ? <select value={form[key] || options[0]} onChange={(event) => update(key, event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select>
        : type === "checkbox" ? <input type="checkbox" checked={form[key] ?? true} onChange={(event) => update(key, event.target.checked)} />
          : <input required={!form._id && key !== "visitorPhone"} pattern={key === "idNumber" ? "\\d{13}" : undefined} minLength={key === "password" ? 8 : undefined} type={type} value={form[key] || ""} onChange={(event) => update(key, event.target.value)} />}
    </label>)}
    <div className="form-actions"><button type="button" className="button outline" onClick={onCancel}>Cancel</button><button className="button dark">Save record</button></div>
  </form>;
}

function Overview({ events, plate, setPlate, onDecide, online, message, title = "Security console" }) {
  const allowed = useMemo(() => events.filter((event) => event.status === "ALLOWED").length, [events]);
  const held = useMemo(() => events.filter((event) => event.status === "HELD").length, [events]);
  return <><section className="hero-grid"><div><span className="eyebrow">Humanless residential access</span><h1>Quiet, certain entry for every home.</h1><p className="lede">One console for residents, vehicles, visitors and the decisions that keep a community moving.</p></div><div className="gate-card"><div className="card-top"><span className="mono">GATE 01 · CAMERA WEST</span><span className="live"><i />Live</span></div><div className="gate-status"><strong>{events[0]?.plate || "—"}</strong><span>{events[0]?.status || "WAITING"} · {events[0]?.detail || "Awaiting detection"}</span></div><div className="boom"><span /><b /></div></div></section>
    <section className="dashboard-content"><div className="stat-grid"><div className="stat-card"><span>Events today</span><strong>{events.length}</strong><small>Streaming access log</small></div><div className="stat-card"><span>Allowed</span><strong className="green">{allowed}</strong><small>Rules matched</small></div><div className="stat-card"><span>Held for review</span><strong className="gold">{held}</strong><small>Needs attention</small></div></div>
      <div className="section-heading"><div><span className="eyebrow">{title}</span><h2>{title === "Resident console" ? "Your home, your access." : title === "Visitor console" ? "Your visit, clearly authorised." : "Every movement, accounted for."}</h2></div><span className="mono">{online ? "STREAMING" : "OFFLINE"} · {events.length} EVENTS</span></div>
      <form className="decision-form" onSubmit={onDecide}><label htmlFor="plate">Simulate plate detection</label><input id="plate" value={plate} onChange={(event) => setPlate(event.target.value)} placeholder="e.g. 7 XKA 441" /><button className="button dark">Check access</button></form>{message && <p className="notice">{message}</p>}
      <div className="console"><div className="console-head"><span>Access events · today</span><span>STATUS / VEHICLE / LOCATION</span></div>{events.map((event, index) => <div className="event-row" key={`${event.createdAt}-${index}`}><span className="time">{formatTime(event.createdAt)}</span><span className={`status ${event.status === "HELD" ? "held" : ""}`}><i />{event.status}</span><strong>{event.plate}</strong><span className="detail">{event.detail}</span></div>)}{!events.length && <div className="empty">No events received yet.</div>}</div>
    </section></>;
}

export default function App() {
  const [screen, setScreen] = useState(localStorage.getItem("northgate_token") ? "console" : "landing");
  const [role, setRole] = useState(() => JSON.parse(localStorage.getItem("northgate_user") || "null")?.role?.toLowerCase() || "account");
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("northgate_user") || "null"));
  const [active, setActive] = useState("overview");
  const [events, setEvents] = useState([]);
  const [plate, setPlate] = useState("");
  const [message, setMessage] = useState("");
  const [online, setOnline] = useState(false);
  useEffect(() => {
    if (screen !== "console") return;
    Promise.all([api.health(), api.events()])
      .then(([, data]) => { setEvents(data); setOnline(true); })
      .catch(() => setMessage("API unavailable. Start the Backend service to manage live data."));
  }, [screen]);
  async function decide(event) { event.preventDefault(); try { const data = await api.decide(plate); setEvents((current) => [data, ...current].slice(0, 20)); setPlate(""); setMessage(`${data.status === "ALLOWED" ? "Gate opening authorised" : "Vehicle held for review"} · ${data.plate}`); } catch (error) { setMessage(error.message); } }
  if (screen === "landing") return <Landing onEnter={() => setScreen("roles")} onSignIn={() => setScreen("auth")} />;
  if (screen === "roles") return <RolePicker onSelect={() => setScreen("auth")} onBack={() => setScreen("landing")} />;
  if (screen === "auth") return <AuthScreen onBack={() => setScreen("landing")} onSuccess={(result) => { localStorage.setItem("northgate_token", result.token); localStorage.setItem("northgate_user", JSON.stringify(result.user)); setUser(result.user); setRole(result.user.role.toLowerCase()); setScreen("console"); }} />;
  return <Console user={user} setUser={setUser} role={role} setRole={setRole} setScreen={setScreen} active={active} setActive={setActive} events={events} plate={plate} setPlate={setPlate} onDecide={decide} online={online} message={message} setMessage={setMessage} />;
}

function Landing({ onEnter, onSignIn }) {
  return <main className="landing"><header className="landing-nav wrap"><div className="brand"><span className="logo">N</span><span className="brand-name">Northgate</span><span className="chip">Residential access</span></div><nav><a href="#how">How it works</a><a href="#communities">For communities</a><button className="text-button" onClick={onSignIn}>Sign in</button></nav></header><section className="landing-hero wrap"><div><span className="eyebrow">Humanless entry, resident-first</span><h1>The gate already knows you're here.</h1><p className="landing-lede">Northgate reads plates at the gate, checks household rules locally, and lifts the boom before you slow down. Quiet, audited access for homes and small communities.</p><div className="landing-actions"><button className="button dark" onClick={onEnter}>Explore the consoles</button><a className="button outline" href="#how">See how it works</a></div><div className="landing-meta"><span>Offline-first gateway</span><span>Plate → rule → gate</span><span>Full audit trail</span></div></div><div className="landing-visual"><div className="card-top"><span className="mono">GATE 01 · CAMERA WEST</span><span className="live"><i />Live</span></div><div className="visual-camera"><span className="scan" /><div><strong>7 XKA 441</strong><small><i />MATCHED · RESIDENT</small></div></div><div className="visual-boom"><span /><b /></div></div></section><section id="how" className="landing-section wrap"><span className="eyebrow">Automated entry</span><h2>One approach, three silent decisions.</h2><div className="feature-grid">{[["01", "Plate detected", "The gateway captures and reads the plate in under 400 ms."], ["02", "Rules matched", "Resident, visitor and bay rules are checked locally."], ["03", "Gate opens", "The decision is logged and the boom lifts without a call." ]].map(([number, title, text]) => <article className="feature-card" key={number}><span className="number">{number}</span><h3>{title}</h3><p>{text}</p></article>)}</div></section><section id="communities" className="community-section wrap"><div><span className="eyebrow">For communities</span><h2>Less queueing. More confidence.</h2><p>Northgate gives estate managers one clear view of residents, visitors, vehicles, gates and every access decision. Local rules keep working even when the connection does not.</p></div><div className="community-points"><span><b>Residents</b> move through without fobs or calls.</span><span><b>Security teams</b> see exceptions as they happen.</span><span><b>Managers</b> get a complete, searchable audit trail.</span></div></section><footer className="landing-footer"><div className="wrap footer-main"><div><div className="brand"><span className="logo">N</span><span className="brand-name">Northgate</span></div><p>Resident-first access control for quieter, safer communities.</p></div><div className="footer-links"><div><span className="mono">Product</span><a href="#how">How it works</a><a href="#communities">For communities</a><button onClick={onSignIn}>Sign in</button></div><div><span className="mono">Built for trust</span><span>Offline-ready decisions</span><span>Audited access events</span><span>Privacy by design</span></div><div><span className="mono">Contact</span><a href="mailto:hello@northgate.local">hello@northgate.local</a><span>South Africa · 2026</span></div></div></div><div className="wrap footer-bottom"><span>© 2026 Northgate Residential Access</span><span>Secure by default · Human when it matters</span></div></footer></main>;
}

function AuthScreen({ onBack, onSuccess }) {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault(); setError("");
    try { const result = await api.login({ email: form.email, password: form.password }); onSuccess(result); }
    catch (requestError) { setError(requestError.message); }
  }
  return <main className="auth-page"><div className="auth-card"><button className="text-button" onClick={onBack}>← Back to Northgate</button><div className="auth-brand"><span className="logo">N</span><span className="brand-name">Northgate</span></div><span className="eyebrow">Secure account access</span><h1>Welcome back.</h1><p className="lede">Sign in with the credentials provided by your Administrator. Your account determines which console you can access.</p><form className="auth-form" onSubmit={submit}><label>Email<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label>Password<input required minLength="8" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>{error && <p className="auth-error">{error}</p>}<button className="button dark">Sign in</button></form></div></main>;
}

function RolePicker({ onSelect, onBack }) {
  const roles = [["security", "Security console", "Live gates, exceptions and access events.", "↗"], ["admin", "Admin console", "Residents, vehicles, bays and estate rules.", "⌘"], ["resident", "Resident console", "Your vehicles, visitors and access history.", "♙"], ["visitor", "Visitor console", "Your pass details and arrival instructions.", "◌"]];
  return <main className="role-page"><header className="landing-nav wrap"><button className="text-button" onClick={onBack}>← Back to Northgate</button><span className="mono">CONSOLE OVERVIEW</span></header><section className="role-content wrap"><span className="eyebrow">Northgate consoles</span><h1>One secure sign in. The right console for your role.</h1><p className="lede">Your account permissions automatically open the tools and information assigned to you.</p><div className="role-grid">{roles.map(([key, title, text, icon]) => <button className="role-card" key={key} onClick={() => onSelect()}><span className="role-icon">{icon}</span><span className="eyebrow">{key}</span><h2>{title}</h2><p>{text}</p><strong>Continue to sign in →</strong></button>)}</div></section></main>;
}

function Console({ user, setUser, role, setRole, setScreen, active, setActive, events, plate, setPlate, onDecide, online, message, setMessage }) {
  const roleLabels = { security: "Security console", admin: "Admin console", resident: "Resident console", visitor: "Visitor console" };
  const roleResources = role === "admin" ? resources : role === "resident" ? { overview: resources.overview, vehicles: resources.vehicles, visitors: resources.visitors, profile: resources.profile } : { overview: resources.overview, profile: resources.profile };
  function logout() { localStorage.removeItem("northgate_token"); localStorage.removeItem("northgate_user"); setScreen("landing"); }
  return <main className="app-shell"><aside className="sidebar"><div className="brand"><span className="logo">N</span><span className="brand-name">Northgate</span></div><span className="sidebar-label">{roleLabels[role]}</span><div className="signed-in-user">{user?.name}<small>{user?.email}</small></div><nav>{Object.entries(roleResources).map(([key, item]) => <button className={active === key ? "nav-item active" : "nav-item"} key={key} onClick={() => setActive(key)}><span>{item.icon}</span>{item.label}</button>)}</nav><div className="role-switch"><span className="mono">SIGNED IN AS</span><strong>{roleLabels[role]}</strong></div><div className="sidebar-footer"><button className="text-button sidebar-back" onClick={logout}>Sign out</button><span className={online ? "connection online" : "connection"}><i />{online ? "Gateway online" : "Offline"}</span><span className="mono">v0.1 · LOCAL CONSOLE</span></div></aside><div className="main-area"><header className="topbar"><span className="eyebrow">{active === "overview" ? roleLabels[role] : "Data management"}</span><span className="mono">NORTHGATE / ESTATE 01</span></header>{active === "overview" ? <Overview title={roleLabels[role]} events={events} plate={plate} setPlate={setPlate} onDecide={onDecide} online={online} message={message} /> : active === "profile" ? <ProfileView user={user} onUserUpdate={setUser} onMessage={setMessage} /> : <ResourceView resourceKey={active} onMessage={(text, type) => setMessage(type === "error" ? text : text)} />}</div></main>;
}
