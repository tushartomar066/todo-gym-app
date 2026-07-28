'use client';

import { useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Mail, Lock, Eye, EyeOff, Loader2, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

function useSupabase() {
  const ref = useRef<ReturnType<typeof createClient> | null>(null);
  if (!ref.current) ref.current = createClient();
  return ref.current;
}

const fadeUp = {
  hidden:  { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

export default function SignUpPage() {
  const supabase        = useSupabase();
  const [email,         setEmail]         = useState('');
  const [password,      setPassword]      = useState('');
  const [confirmPass,   setConfirmPass]   = useState('');
  const [showPass,      setShowPass]      = useState(false);
  const [showConfirm,   setShowConfirm]   = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [success,       setSuccess]       = useState(false);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPass) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) throw signUpError;
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [email, password, confirmPass, supabase]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-slate-900 to-indigo-950 px-4">

      {/* Ambient glow blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-indigo-600/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-purple-600/10 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-md"
      >
        <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-800 rounded-2xl shadow-2xl shadow-black/40 p-7 sm:p-9 space-y-7">

          {/* Branding */}
          <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible" className="text-center space-y-1">
            <span className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent tracking-tight">
              Jtrac
            </span>
            {success ? (
              <>
                <h2 className="text-xl font-semibold text-gray-100">Account created!</h2>
                <p className="text-sm text-gray-500">Check your email to confirm your address.</p>
              </>
            ) : (
              <>
                <h2 className="text-xl font-semibold text-gray-100">Create an account</h2>
                <p className="text-sm text-gray-500">Sign up to get started</p>
              </>
            )}
          </motion.div>

          {success ? (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center space-y-4"
            >
              <div className="flex items-center justify-center w-12 h-12 bg-emerald-500/15 rounded-full mx-auto">
                <UserPlus className="h-6 w-6 text-emerald-400" />
              </div>
              <p className="text-sm text-gray-400">
                Once confirmed,{' '}
                <Link href="/" className="text-indigo-400 hover:text-indigo-300 font-medium underline-offset-2 hover:underline transition-colors">
                  sign in here
                </Link>
              </p>
            </motion.div>
          ) : (
            <>
              {/* Error */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-2.5 px-4 py-3 bg-red-500/10 border border-red-500/25 rounded-xl text-red-400 text-sm"
                >
                  <span className="mt-0.5 h-4 w-4 flex-shrink-0">✕</span>
                  {error}
                </motion.div>
              )}

              {/* Form */}
              <motion.form
                custom={1} variants={fadeUp} initial="hidden" animate="visible"
                onSubmit={handleSubmit}
                className="space-y-4"
              >
                {/* Email */}
                <div className="space-y-1.5">
                  <label htmlFor="email" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
                    <input
                      id="email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-100 placeholder-gray-600 text-sm
                                 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label htmlFor="password" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
                    <input
                      id="password"
                      type={showPass ? 'text' : 'password'}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-10 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-100 placeholder-gray-600 text-sm
                                 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                      aria-label={showPass ? 'Hide password' : 'Show password'}
                    >
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="space-y-1.5">
                  <label htmlFor="confirmPassword" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
                    <input
                      id="confirmPassword"
                      type={showConfirm ? 'text' : 'password'}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      value={confirmPass}
                      onChange={e => setConfirmPass(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-10 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-100 placeholder-gray-600 text-sm
                                 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                      aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4
                             bg-gradient-to-r from-indigo-600 to-indigo-500
                             hover:from-indigo-500 hover:to-indigo-400
                             active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed
                             text-white text-sm font-semibold rounded-xl
                             transition-all duration-200 shadow-lg shadow-indigo-500/20"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating account…
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      Sign Up
                    </>
                  )}
                </button>
              </motion.form>

              <motion.p
                custom={2} variants={fadeUp} initial="hidden" animate="visible"
                className="text-center text-sm text-gray-500"
              >
                Already have an account?{' '}
                <Link
                  href="/"
                  className="text-indigo-400 hover:text-indigo-300 font-medium underline-offset-2 hover:underline transition-colors"
                >
                  Sign in
                </Link>
              </motion.p>
            </>
          )}

        </div>
      </motion.div>
    </div>
  );
}
