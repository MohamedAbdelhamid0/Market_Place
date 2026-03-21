import { useState } from 'react';
import { validatePassword, validateEmail } from './auth.js';

export default function Signup({ onNavigateLogin }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [success, setSuccess] = useState(false);

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const newErrors = {};

    if (!form.name.trim()) {
      newErrors.name = 'Full name is required.';
    }

    if (!form.email) {
      newErrors.email = 'Email is required.';
    } else if (!validateEmail(form.email)) {
      newErrors.email = 'Please enter a valid email address.';
    }

    const pwResult = validatePassword(form.password);
    if (!form.password) {
      newErrors.password = 'Password is required.';
    } else if (!pwResult.valid) {
      newErrors.password = pwResult.errors[0];
    }

    if (!form.confirm) {
      newErrors.confirm = 'Please confirm your password.';
    } else if (form.password !== form.confirm) {
      newErrors.confirm = 'Passwords do not match.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setSuccess(true);

    setTimeout(() => {
      onNavigateLogin();
    }, 2000);
  }

  const pwResult = form.password ? validatePassword(form.password) : null;

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="logo-icon">✨</div>
        </div>
        <h1 className="auth-title">Create account</h1>
        <p className="auth-subtitle">Join us today — it's free</p>

        {success && (
          <div className="alert alert-success">
            Account created! Redirecting to login...
          </div>
        )}

        {!success && (
          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="signup-name">Full Name</label>
              <input
                id="signup-name"
                type="text"
                className={`form-input ${errors.name ? 'input-error' : ''}`}
                placeholder="Jane Doe"
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
              />
              {errors.name && <span className="error-msg">{errors.name}</span>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="signup-email">Email</label>
              <input
                id="signup-email"
                type="email"
                className={`form-input ${errors.email ? 'input-error' : ''}`}
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
              />
              {errors.email && <span className="error-msg">{errors.email}</span>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="signup-password">Password</label>
              <div className="input-wrapper">
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  className={`form-input ${errors.password ? 'input-error' : ''}`}
                  placeholder="Create a password"
                  value={form.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                />
                <button
                  type="button"
                  className="toggle-pw"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
              {errors.password && <span className="error-msg">{errors.password}</span>}

              {form.password && (
                <div className="pw-hints">
                  <span className={form.password.length >= 8 ? 'hint-ok' : 'hint-bad'}>
                    {form.password.length >= 8 ? '✓' : '✗'} At least 8 characters
                  </span>
                  <span className={/^[A-Z]/.test(form.password) ? 'hint-ok' : 'hint-bad'}>
                    {/^[A-Z]/.test(form.password) ? '✓' : '✗'} Starts with a capital letter
                  </span>
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="signup-confirm">Confirm Password</label>
              <div className="input-wrapper">
                <input
                  id="signup-confirm"
                  type={showConfirm ? 'text' : 'password'}
                  className={`form-input ${errors.confirm ? 'input-error' : ''}`}
                  placeholder="Repeat your password"
                  value={form.confirm}
                  onChange={(e) => handleChange('confirm', e.target.value)}
                />
                <button
                  type="button"
                  className="toggle-pw"
                  onClick={() => setShowConfirm(!showConfirm)}
                  aria-label="Toggle confirm password visibility"
                >
                  {showConfirm ? '🙈' : '👁️'}
                </button>
              </div>
              {errors.confirm && <span className="error-msg">{errors.confirm}</span>}
            </div>

            <button type="submit" className="btn-primary">Create Account</button>
          </form>
        )}

        <p className="auth-footer">
          Already have an account?{' '}
          <button className="link-btn" onClick={onNavigateLogin}>
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}
