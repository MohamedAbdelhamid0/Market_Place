const { useState } = React;

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

/* ── Login ──────────────────────────────────────────────── */
function Login({ onGoSignup }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState({});
  const [successMsg, setSuccessMsg] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();

    const res = await fetch('http://localhost:5000/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({email, password})
    });

    const data = await res.json();

    if (res.ok) {
      setSuccessMsg('Logged in successfully!');
      localStorage.setItem("token", data.token);

      setTimeout(() => {
        window.location.href =
          data.role === 'trader'
            ? 'seller.html'
            : 'Buyer.html';
      }, 1000);
    }

    return (
      <div className="auth-card">
        <div className="auth-logo">🔐</div>
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-subtitle">Sign in to your account</p>

        {successMsg && <div className="alert alert-success">{successMsg}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              className={`form-input${errors.email ? ' input-error' : ''}`}
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrors(p => ({...p, email: ''}));
              }}
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
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrors(p => ({...p, password: ''}));
                }}
              />
              <button type="button" className="toggle-pw" onClick={() => setShowPw(!showPw)}>
                {showPw ? '🙈' : '👁️'}
              </button>
            </div>
            {errors.password && <span className="error-msg">{errors.password}</span>}
          </div>

          <button type="submit" className="btn-primary">Sign In</button>
        </form>

        <p className="auth-footer">
          Don't have an account?{' '}
          <button className="link-btn" onClick={onGoSignup}>Sign up</button>
        </p>
      </div>
    );
  }

  /* ── Signup ─────────────────────────────────────────────── */
  function Signup({onGoLogin}) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [showCfm, setShowCfm] = useState(false);
    const [errors, setErrors] = useState({});
    const [successMsg, setSuccessMsg] = useState('');

    const matchStatus = !confirm ? null : password === confirm ? 'match' : 'nomatch';

    async function handleSubmit(e) {
      e.preventDefault();

      const res = await fetch('http://localhost:5000/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({email, password})
      });

      const data = await res.json();

      if (res.ok) {
        setSuccessMsg("Account created!");
        setTimeout(() => onGoLogin(), 2000);
      } else {
        setErrors({email: data.message});
      }
    }

    return (
      <div className="auth-card">
        <div className="auth-logo">✨</div>
        <h1 className="auth-title">Create account</h1>
        <p className="auth-subtitle">Sign up to get started</p>

        {successMsg && <div className="alert alert-success">{successMsg}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              className={`form-input${errors.email ? ' input-error' : ''}`}
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrors(p => ({...p, email: ''}));
              }}
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
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrors(p => ({...p, password: ''}));
                }}
              />
              <button type="button" className="toggle-pw" onClick={() => setShowPw(!showPw)}>
                {showPw ? '🙈' : '👁️'}
              </button>
            </div>
            {password && (
              <div style={{marginTop: '6px'}}>
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
                onChange={(e) => {
                  setConfirm(e.target.value);
                  setErrors(p => ({...p, confirm: ''}));
                }}
              />
              <button type="button" className="toggle-pw" onClick={() => setShowCfm(!showCfm)}>
                {showCfm ? '🙈' : '👁️'}
              </button>
            </div>
            {matchStatus === 'match' && <span className="hint-msg hint-match">✓ Passwords match</span>}
            {matchStatus === 'nomatch' && <span className="hint-msg hint-nomatch">✗ Passwords do not match</span>}
            {errors.confirm && <span className="error-msg">{errors.confirm}</span>}
          </div>

          <button type="submit" className="btn-primary">Create Account</button>
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
          ? <Login onGoSignup={() => setPage('signup')}/>
          : <Signup onGoLogin={() => setPage('login')}/>
        }
      </div>
    );
  }

  ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
}
