import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, saveAuth } from "../api";

export default function AuthPage({ onAuthSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({ name: "", businessName: "", email: "", password: "" });
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setError("");

    try {
      const payload = isRegister
        ? { ...form, role: "seller" }
        : { email: form.email, password: form.password };

      const data = isRegister ? await api.register(payload) : await api.login(payload);
      if (data.user?.role !== "seller") {
        setError("This account is not a seller account.");
        return;
      }

      saveAuth(data.token, data.user);
      if (typeof onAuthSuccess === "function") {
        onAuthSuccess();
      }
      navigate("/");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="auth-shell">
      <aside className="seller-auth-cover" aria-label="Seller operations preview">
        <div className="seller-auth-cover__visual">
          <div className="seller-auth-cover__glow" />
          <div className="seller-auth-cover__shelf seller-auth-cover__shelf--top" />
          <div className="seller-auth-cover__shelf seller-auth-cover__shelf--middle" />
          <div className="seller-auth-cover__package seller-auth-cover__package--one">📦</div>
          <div className="seller-auth-cover__package seller-auth-cover__package--two">🏷️</div>
          <div className="seller-auth-cover__chart">
            <span />
            <span />
            <span />
          </div>
          <div className="seller-auth-cover__order-card">
            <strong>New order</strong>
            <span>Ready to process</span>
          </div>
        </div>
        <div className="seller-auth-cover__content">
          <span>Seller workspace</span>
          <h1>Manage products, orders, and delivery details faster.</h1>
          <p>Sign in to update inventory, process paid orders, and keep buyers informed.</p>
          <div className="seller-auth-cover__metrics" aria-label="Seller portal highlights">
            <span><strong>24/7</strong> order access</span>
            <span><strong>Live</strong> inventory tools</span>
          </div>
        </div>
      </aside>

      <section className="auth-card-dark">
        <div className="auth-brand" style={{ marginBottom: "24px" }}>
          <div className="logo-badge" style={{ fontSize: "2.4rem", padding: "12px", background: "linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9))", borderRadius: "16px", border: "1px solid rgba(148, 163, 184, 0.2)", display: "inline-flex", marginBottom: "16px", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1), 0 8px 20px rgba(0,0,0,0.2)" }}>📦</div>
          <h2>{isRegister ? "Create Seller Account" : "Welcome back"}</h2>
          <p>{isRegister ? "Marketplace seller portal" : "Sign in to your seller account"}</p>
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {isRegister ? (
            <>
              <div className="form-group" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label>Owner Name</label>
                <input
                  placeholder="Owner Name"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label>Business Name</label>
                <input
                  placeholder="Business Name"
                  value={form.businessName}
                  onChange={(e) => setForm((p) => ({ ...p, businessName: e.target.value }))}
                  required
                />
              </div>
            </>
          ) : null}

          <div className="form-group" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label>Email</label>
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              required
            />
          </div>

          <div className="form-group" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label>Password</label>
            <input
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              required
            />
          </div>

          {error ? <div className="alert error">{error}</div> : null}
          
          <button type="submit" className="btn-save" style={{ marginTop: "8px" }}>
            {isRegister ? "Create account" : "Sign in"}
          </button>
        </form>

        <div className="seller-auth-perks" aria-label="Seller account benefits" style={{ marginTop: "24px", justifyContent: "center" }}>
          <span>📈 Sales dashboard</span>
          <span>🚚 Delivery addresses</span>
        </div>

        <p className="auth-footer" style={{ textAlign: "center", marginTop: "12px", color: "var(--text-dim)", fontSize: "0.95rem" }}>
          {isRegister ? "Already registered?" : "No account?"}{" "}
          <button type="button" onClick={() => setIsRegister((v) => !v)} style={{ display: "inline", background: "none", border: "none", color: "var(--accent)", fontWeight: "600", padding: "0", cursor: "pointer", fontSize: "0.95rem" }}>
            {isRegister ? "Sign in" : "Sign up"}
          </button>
        </p>
      </section>

      <aside className="seller-auth-cover seller-auth-cover--secondary" aria-label="Seller insights preview">
        <div className="seller-auth-cover__insights">
          <div className="seller-auth-cover__insight-card seller-auth-cover__insight-card--hero">
            <span>💰</span>
            <strong>Credited earnings</strong>
            <small>Balance updates as orders progress</small>
          </div>
          <div className="seller-auth-cover__mini-grid">
            <div>⭐<strong>Ratings</strong></div>
            <div>📍<strong>Addresses</strong></div>
            <div>✅<strong>Reports</strong></div>
          </div>
        </div>
        <div className="seller-auth-cover__content seller-auth-cover__content--compact">
          <span>Business insights</span>
          <h1>See payouts, ratings, and delivery info clearly.</h1>
          <p>Use your seller portal to make faster decisions after every new order.</p>
        </div>
      </aside>
    </main>
  );
}
