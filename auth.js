const { useState } = React;
const API_BASE = "http://localhost:4000";
const SESSION_KEY = "marketplace.auth.user";

/* ── Validation ─────────────────────────────────────────── */
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function validatePassword(pw) {
  const errors = [];
  if (pw.length < 8) errors.push('At least 8 characters');
  if (!/^[A-Z]/.test(pw)) errors.push('Must start with a capital letter');
  return errors;
}

async function requestJson(path, payload) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || 'Request failed');
  }
  return data;
}

/* ── Login ──────────────────────────────────────────────── */
function Login({ onGoSignup }) {
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [showPw, setShowPw]         = useState(false);
  const [errors, setErrors]         = useState({});
  const [successMsg, setSuccessMsg] = useState('');
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = {};

    if (!email.trim()) {
      errs.email = 'Email is required.';
    } else if (!validateEmail(email)) {
      errs.email = 'Please enter a valid email address.';
    }

    if (!password) {
      errs.password = 'Password is required.';
    } else {
      const pwErrs = validatePassword(password);
      if (pwErrs.length > 0) errs.password = pwErrs.join(' · ');
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setServerError('');
    setErrors({});
    setLoading(true);
    try {
      const data = await requestJson('/api/auth/login', {
        email: email.trim(),
        password
      });

      localStorage.setItem(SESSION_KEY, JSON.stringify(data.user));
      setSuccessMsg('Logged in successfully! Redirecting...');

      setTimeout(() => {
        window.location.href = data.user.role === 'seller' ? 'seller.html' : 'Buyer.html';
      }, 600);
    } catch (err) {
      setServerError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-card">
      <div className="auth-logo">🔐</div>
      <h1 className="auth-title">Welcome back</h1>
      <p className="auth-subtitle">Sign in to your account</p>

      {successMsg && <div className="alert alert-success">{successMsg}</div>}
      {serverError && <div className="alert alert-error">{serverError}</div>}

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label className="form-label">Email</label>
          <input
            type="email"
            className={`form-input${errors.email ? ' input-error' : ''}`}
            placeholder="you@example.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setErrors(p => ({...p, email: ''})); }}
          />
          {errors.email && <span className="error-msg">{errors.email}</span>}
        </div>

        <div className="form-group">
          <label className="form-label">Password</label>
          <div className="input-wrapper">
            <input
              type={showPw ? 'text' : 'password'}
              className={`form-input with-toggle${errors.password ? ' input-error' : ''}`}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setErrors(p => ({...p, password: ''})); }}
            />
            <button type="button" className="toggle-pw" onClick={() => setShowPw(!showPw)}>
              {showPw ? '🙈' : '👁️'}
            </button>
          </div>
          {errors.password && <span className="error-msg">{errors.password}</span>}
        </div>

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <p className="auth-footer">
        Don't have an account?{' '}
        <button className="link-btn" onClick={onGoSignup}>Sign up</button>
      </p>
    </div>
  );
}

/* ── Signup ─────────────────────────────────────────────── */
function Signup({ onGoLogin }) {
  const [role, setRole]             = useState('buyer');
  const [name, setName]             = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [confirm, setConfirm]       = useState('');
  const [showPw, setShowPw]         = useState(false);
  const [showCfm, setShowCfm]       = useState(false);
  const [errors, setErrors]         = useState({});
  const [successMsg, setSuccessMsg] = useState('');
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  const matchStatus = !confirm ? null : password === confirm ? 'match' : 'nomatch';

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = {};

    if (!name.trim()) {
      errs.name = 'Name is required.';
    }

    if (role === 'seller' && !businessName.trim()) {
      errs.businessName = 'Business name is required for sellers.';
    }

    if (!email.trim()) {
      errs.email = 'Email is required.';
    } else if (!validateEmail(email)) {
      errs.email = 'Please enter a valid email address.';
    }

    const pwErrs = validatePassword(password);
    if (pwErrs.length > 0) errs.password = pwErrs.join(' · ');

    if (!confirm) {
      errs.confirm = 'Please confirm your password.';
    } else if (password !== confirm) {
      errs.confirm = 'Passwords do not match.';
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setServerError('');
    setErrors({});
    setLoading(true);
    try {
      await requestJson('/api/auth/signup', {
        role,
        name: name.trim(),
        businessName: businessName.trim(),
        email: email.trim(),
        password
      });
      setSuccessMsg('Account created! Redirecting to login...');
      setTimeout(() => { setSuccessMsg(''); onGoLogin(); }, 1000);
    } catch (err) {
      setServerError(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-card">
      <div className="auth-logo">✨</div>
      <h1 className="auth-title">Create account</h1>
      <p className="auth-subtitle">Sign up to get started</p>

      {successMsg && <div className="alert alert-success">{successMsg}</div>}
      {serverError && <div className="alert alert-error">{serverError}</div>}

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label className="form-label">Account Type</label>
          <select
            className="form-input"
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setErrors(p => ({ ...p, businessName: '' }));
            }}
          >
            <option value="buyer">Buyer</option>
            <option value="seller">Seller</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Full Name</label>
          <input
            type="text"
            className={`form-input${errors.name ? ' input-error' : ''}`}
            placeholder="Your full name"
            value={name}
            onChange={(e) => { setName(e.target.value); setErrors(p => ({...p, name: ''})); }}
          />
          {errors.name && <span className="error-msg">{errors.name}</span>}
        </div>

        {role === 'seller' && (
          <div className="form-group">
            <label className="form-label">Business Name</label>
            <input
              type="text"
              className={`form-input${errors.businessName ? ' input-error' : ''}`}
              placeholder="Your store/business name"
              value={businessName}
              onChange={(e) => { setBusinessName(e.target.value); setErrors(p => ({...p, businessName: ''})); }}
            />
            {errors.businessName && <span className="error-msg">{errors.businessName}</span>}
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Email</label>
          <input
            type="email"
            className={`form-input${errors.email ? ' input-error' : ''}`}
            placeholder="you@example.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setErrors(p => ({...p, email: ''})); }}
          />
          {errors.email && <span className="error-msg">{errors.email}</span>}
        </div>

        <div className="form-group">
          <label className="form-label">Password</label>
          <div className="input-wrapper">
            <input
              type={showPw ? 'text' : 'password'}
              className={`form-input with-toggle${errors.password ? ' input-error' : ''}`}
              placeholder="Min 8 chars, starts with capital"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setErrors(p => ({...p, password: ''})); }}
            />
            <button type="button" className="toggle-pw" onClick={() => setShowPw(!showPw)}>
              {showPw ? '🙈' : '👁️'}
            </button>
          </div>
          {password && (
            <div style={{marginTop:'6px'}}>
              <span className={`hint-msg ${password.length >= 8 ? 'hint-match' : 'hint-nomatch'}`}>
                {password.length >= 8 ? '✓' : '✗'} At least 8 characters
              </span>
              <span className={`hint-msg ${/^[A-Z]/.test(password) ? 'hint-match' : 'hint-nomatch'}`}>
                {/^[A-Z]/.test(password) ? '✓' : '✗'} Starts with a capital letter
              </span>
            </div>
          )}
          {errors.password && <span className="error-msg">{errors.password}</span>}
        </div>

        <div className="form-group">
          <label className="form-label">Confirm Password</label>
          <div className="input-wrapper">
            <input
              type={showCfm ? 'text' : 'password'}
              className={`form-input with-toggle${errors.confirm ? ' input-error' : ''}`}
              placeholder="Re-enter your password"
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); setErrors(p => ({...p, confirm: ''})); }}
            />
            <button type="button" className="toggle-pw" onClick={() => setShowCfm(!showCfm)}>
              {showCfm ? '🙈' : '👁️'}
            </button>
          </div>
          {matchStatus === 'match'   && <span className="hint-msg hint-match">✓ Passwords match</span>}
          {matchStatus === 'nomatch' && <span className="hint-msg hint-nomatch">✗ Passwords do not match</span>}
          {errors.confirm && <span className="error-msg">{errors.confirm}</span>}
        </div>

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
      </form>

      <p className="auth-footer">
        Already have an account?{' '}
        <button className="link-btn" onClick={onGoLogin}>Sign in</button>
      </p>
    </div>
  );
}

/* ── App Root ────────────────────────────────────────────── */
function App() {
  const [page, setPage] = useState('login');
  return (
    <div className="auth-wrapper">
      {page === 'login'
        ? <Login  onGoSignup={() => setPage('signup')} />
        : <Signup onGoLogin={()  => setPage('login')}  />
      }
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
