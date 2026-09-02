import { useState } from "react";
import { attemptLogin } from "./auth.js";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function submit(e) {
    e.preventDefault();
    const session = attemptLogin(username, password);
    if (!session) {
      setError("Incorrect username or password.");
      return;
    }
    setError("");
    onLogin(session);
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <h1>Elas Electronics</h1>
        <p>Sign in to access the sales tracker</p>

        <label>
          Username
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            placeholder="Enter your username"
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
          />
        </label>

        {error && <p className="login-error">{error}</p>}

        <button type="submit" className="btn btn-primary login-submit">
          Sign in
        </button>
      </form>
    </div>
  );
}
