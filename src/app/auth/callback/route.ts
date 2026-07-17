import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const nextParam = requestUrl.searchParams.get('next') ?? '/dashboard'

  // Reject protocol-relative URLs (//evil.com) and anything that isn't a
  // plain relative path so the redirect can never leave this origin.
  const safePath =
    nextParam.startsWith('/') && !nextParam.startsWith('//')
      ? nextParam
      : '/dashboard'

  if (!code) {
    return NextResponse.redirect(`${requestUrl.origin}/?error=auth-failed`)
  }

  try {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
    return NextResponse.redirect(`${requestUrl.origin}${safePath}`)
  } catch {
    return NextResponse.redirect(`${requestUrl.origin}/?error=auth-failed`)
  }
}
