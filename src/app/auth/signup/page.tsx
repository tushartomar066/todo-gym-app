'use client';

import { useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { LogIn } from 'lucide-react';

function useSupabase() {
  const ref = useRef<ReturnType<typeof createClient> | null>(null);
  if (!ref.current) ref.current = createClient();
  return ref.current;
}

export default function SignUpPage() {
  const supabase = useSupabase();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (password !== confirmPassword) {
        throw new Error('Passwords do not match');
      }

      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) throw signUpError;

      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [email, password, confirmPassword, supabase]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50 px-4">
      <div className="w-full max-w-md space-y-6 p-6 sm:p-8 bg-white rounded-lg shadow-md">
        <h2 className="text-center text-2xl font-bold text-gray-800">
          {success ? 'Account Created' : 'Sign Up'}
        </h2>
        {success ? (
          <div className="text-center text-green-600">
            <p>Your account has been created successfully!</p>
            <p className="mt-4">
              {/* Login page is at the root route */}
              <a href="/" className="underline">
                Click here to log in
              </a>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                minLength={6}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-70"
            >
              {loading ? (
                <>
                  <span className="mr-2 h-4 w-4 animate-spin border-2 border-white border-t-transparent rounded-full" />
                  Signing up...
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign Up
                </>
              )}
            </button>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </form>
        )}
        <div className="text-center text-sm">
          <p className="text-gray-500">
            Already have an account?{' '}
            <a href="/" className="text-indigo-600 hover:underline">
              Log in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
