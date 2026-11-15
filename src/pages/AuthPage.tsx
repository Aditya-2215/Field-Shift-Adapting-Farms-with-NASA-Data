import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  User as UserIcon
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function AuthPage({ defaultMode = 'login' }: { defaultMode?: 'login' | 'register' | 'forgot' | 'reset' }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, register, forgotPassword, resetPassword, signInWithGoogle } = useAuth();

  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>(
    (searchParams.get('mode') as any) || defaultMode
  );

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState(searchParams.get('token') || '');
  const [rememberMe, setRememberMe] = useState(true);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
  const passwordStrengthCount = [hasMinLength, hasUppercase, hasLowercase, hasNumber, hasSpecial].filter(Boolean).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      if (mode === 'login') {
        if (!email.trim() || !password) throw new Error('Please enter email and password.');
        await login(email, password, rememberMe);
        navigate('/app/overview');
      } else if (mode === 'register') {
        if (!fullName.trim()) throw new Error('Please provide your full name.');
        if (!email.trim()) throw new Error('Please provide a valid email address.');
        if (passwordStrengthCount < 5) {
          throw new Error('Please ensure your password meets all strength criteria.');
        }
        if (password !== confirmPassword) throw new Error('Passwords do not match.');
        await register(fullName, email, password, confirmPassword);
        navigate('/app/overview');
      } else if (mode === 'forgot') {
        if (!email.trim()) throw new Error('Please enter your email address.');
        const res = await forgotPassword(email);
        setSuccessMsg(res.message);
        if (res.resetToken) {
          setResetToken(res.resetToken);
          setMode('reset');
        }
      } else if (mode === 'reset') {
        if (!resetToken.trim()) throw new Error('Please provide the reset token.');
        if (password !== confirmPassword) throw new Error('Passwords do not match.');
        if (passwordStrengthCount < 5) throw new Error('Please meet all password strength criteria.');
        await resetPassword(resetToken, password, confirmPassword);
        setSuccessMsg('Password has been reset successfully. You can now sign in.');
        setTimeout(() => setMode('login'), 1200);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'An error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F8F5] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4A5D50] hover:text-[#111C15] mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to AgriShift AI</span>
        </Link>
        <h2 className="font-display text-3xl font-bold tracking-tight text-[#111C15] text-center">
          {mode === 'login' && 'Sign in to AgriShift AI'}
          {mode === 'register' && 'Create your farmer account'}
          {mode === 'forgot' && 'Reset your password'}
          {mode === 'reset' && 'Set new password'}
        </h2>
        <p className="mt-2 text-center text-sm text-[#4A5D50]">
          {mode === 'login' && 'Enter your credentials to access farm intelligence and rotation models'}
          {mode === 'register' && 'Start building resilient farms using Earth observation intelligence'}
          {mode === 'forgot' && 'We will send you instructions to safely reset your password'}
          {mode === 'reset' && 'Enter your reset token and your chosen new password'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm border border-[#DCE3DC] sm:rounded-2xl sm:px-10 space-y-5">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-800">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {(mode === 'login' || mode === 'register') && (
            <>
              <button
                type="button"
                onClick={() => signInWithGoogle().catch(() => {})}
                className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-[#DCE3DC] rounded-xl bg-white hover:bg-[#F6F8F5] text-sm font-semibold text-[#111C15] transition-colors shadow-sm"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="relative flex items-center justify-center">
                <div className="border-t border-[#DCE3DC] w-full" />
                <span className="bg-white px-3 text-[11px] font-medium text-[#4A5D50] uppercase tracking-wider shrink-0">
                  Or continue with email
                </span>
                <div className="border-t border-[#DCE3DC] w-full" />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-[#111C15] mb-1">Full Name</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-[#4A5D50] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-[#DCE3DC] focus:outline-none focus:border-[#1B4D3E] focus:ring-1 focus:ring-[#1B4D3E]"
                  />
                </div>
              </div>
            )}

            {mode !== 'reset' && (
              <div>
                <label className="block text-xs font-semibold text-[#111C15] mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#4A5D50] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="farmer@example.com"
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-[#DCE3DC] focus:outline-none focus:border-[#1B4D3E] focus:ring-1 focus:ring-[#1B4D3E]"
                  />
                </div>
              </div>
            )}

            {mode === 'reset' && (
              <div>
                <label className="block text-xs font-semibold text-[#111C15] mb-1">Password Reset Token</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-[#4A5D50] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    placeholder="Paste reset token here"
                    className="w-full pl-9 pr-3 py-2 text-sm font-mono rounded-xl border border-[#DCE3DC] focus:outline-none focus:border-[#1B4D3E] focus:ring-1 focus:ring-[#1B4D3E]"
                  />
                </div>
              </div>
            )}

            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-[#111C15]">
                    {mode === 'login' ? 'Password' : 'New Password'}
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => setMode('forgot')}
                      className="text-xs font-medium text-[#1B4D3E] hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#4A5D50] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-10 py-2 text-sm rounded-xl border border-[#DCE3DC] focus:outline-none focus:border-[#1B4D3E] focus:ring-1 focus:ring-[#1B4D3E]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A5D50] hover:text-[#111C15]"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {(mode === 'register' || mode === 'reset') && password.length > 0 && (
                  <div className="mt-2 p-2.5 rounded-lg bg-[#F6F8F5] border border-[#DCE3DC] text-[11px] space-y-1">
                    <div className="font-semibold text-[#111C15] flex items-center justify-between mb-1">
                      <span>Password strength requirements:</span>
                      <span className={passwordStrengthCount === 5 ? 'text-emerald-700 font-bold' : 'text-amber-600'}>
                        {passwordStrengthCount}/5 met
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-[#4A5D50]">
                      <div className={hasMinLength ? 'text-emerald-700 font-medium' : ''}>
                        {hasMinLength ? '✓' : '•'} At least 8 characters
                      </div>
                      <div className={hasUppercase ? 'text-emerald-700 font-medium' : ''}>
                        {hasUppercase ? '✓' : '•'} 1 uppercase letter
                      </div>
                      <div className={hasLowercase ? 'text-emerald-700 font-medium' : ''}>
                        {hasLowercase ? '✓' : '•'} 1 lowercase letter
                      </div>
                      <div className={hasNumber ? 'text-emerald-700 font-medium' : ''}>
                        {hasNumber ? '✓' : '•'} 1 number
                      </div>
                      <div className={hasSpecial ? 'text-emerald-700 font-medium' : ''}>
                        {hasSpecial ? '✓' : '•'} 1 special character
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {(mode === 'register' || mode === 'reset') && (
              <div>
                <label className="block text-xs font-semibold text-[#111C15] mb-1">Confirm Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#4A5D50] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-10 py-2 text-sm rounded-xl border border-[#DCE3DC] focus:outline-none focus:border-[#1B4D3E] focus:ring-1 focus:ring-[#1B4D3E]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A5D50] hover:text-[#111C15]"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'login' && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="page-remember-me"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-[#DCE3DC] text-[#1B4D3E] focus:ring-[#1B4D3E]"
                />
                <label htmlFor="page-remember-me" className="text-xs text-[#4A5D50] select-none cursor-pointer">
                  Remember session on this device
                </label>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-[#1B4D3E] text-white text-sm font-semibold hover:bg-[#143B2F] transition-colors flex items-center justify-center gap-2 disabled:opacity-60 shadow-sm"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>
                {mode === 'login' && 'Sign In'}
                {mode === 'register' && 'Create Account'}
                {mode === 'forgot' && 'Send Password Reset Link'}
                {mode === 'reset' && 'Reset Password'}
              </span>
            </button>
          </form>

          <div className="pt-2 text-center text-xs text-[#4A5D50] space-y-1">
            {mode === 'login' && (
              <div>
                Don't have an account yet?{' '}
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="font-semibold text-[#1B4D3E] hover:underline"
                >
                  Create an account
                </button>
              </div>
            )}
            {mode === 'register' && (
              <div>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="font-semibold text-[#1B4D3E] hover:underline"
                >
                  Sign in
                </button>
              </div>
            )}
            {(mode === 'forgot' || mode === 'reset') && (
              <div>
                Remember your password?{' '}
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="font-semibold text-[#1B4D3E] hover:underline"
                >
                  Return to sign in
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
