// Simple client-side login gate.
//
// IMPORTANT: since this app has no backend, these credentials live inside
// the JavaScript bundle that ships to the browser — anyone who really wants
// to could open dev tools and read them. This is a basic access gate to
// keep casual visitors out, not real security. If you ever need this to be
// properly secure (e.g. sensitive financial data, multiple real users),
// it would need a real backend with server-side authentication.

const USERS = [
  { username: "Admin", password: "Mtbs@123", role: "admin" },
   { username: "User", password: "User@100", role: "user" },
];

const SESSION_KEY = "elas_session";

export function attemptLogin(username, password) {
  const match = USERS.find(
    (u) => u.username === username.trim() && u.password === password
  );
  if (!match) return null;
  const session = { username: match.username, role: match.role };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}
