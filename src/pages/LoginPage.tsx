import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, LogIn, KeyRound, LoaderCircle, ShieldCheck } from 'lucide-react'
import { Button } from '../components/ui'
import { useAuth } from '../features/auth/auth-context'
import { supabase } from '../lib/supabase'
import { LanguageSwitch } from '../features/i18n/i18n'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { status } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const returnTo =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/'

  useEffect(() => {
    if (status === 'authorized') navigate(returnTo, { replace: true })
  }, [navigate, returnTo, status])

  if (status === 'authorized') {
    return <Navigate to={returnTo} replace />
  }

  async function handleGoogle(){setSubmitting(true);setErrorMessage(null);const{error}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin}});if(error){setErrorMessage('Google 登录暂时无法使用，请使用 Email / Password。');setSubmitting(false)}}

  async function forgotPassword(){if(!email.trim()){setErrorMessage('请先输入工作邮箱。');return}const{error}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:window.location.origin+'/login'});setErrorMessage(error?'无法发送重设密码邮件。':'重设密码邮件已发送。')}

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setErrorMessage(null)

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      setErrorMessage('Sign-in failed. Check your email and password, then try again.')
      setSubmitting(false)
    }
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-ink text-paper">
      <div className="absolute inset-0 opacity-45 [background-image:linear-gradient(rgba(255,255,255,.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.045)_1px,transparent_1px)] [background-size:48px_48px]" />
      <div className="absolute -right-32 -top-36 size-[30rem] rounded-full border-[5rem] border-coral/20" />
      <div className="relative mx-auto grid min-h-dvh w-full max-w-[88rem] lg:grid-cols-[1.1fr_.9fr]">
        <section className="flex flex-col justify-between px-6 py-8 sm:px-10 lg:px-16 lg:py-12">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-coral font-display text-2xl font-semibold shadow-[4px_4px_0_#fff2]">
              C
            </div>
            <div>
              <p className="font-display text-2xl font-semibold leading-none">ContentOS</p>
              <p className="mt-1 text-[0.65rem] font-extrabold uppercase tracking-[0.22em] text-white/45">
                Internal operations
              </p>
            </div>
          </div>

          <div className="my-16 max-w-2xl page-enter">
            <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-coral-light">
              One operational workspace
            </p>
            <h1 className="mt-5 font-display text-5xl font-semibold leading-[0.96] tracking-[-0.035em] sm:text-6xl lg:text-7xl">
              Keep content work moving, visibly.
            </h1>
            <p className="mt-7 max-w-xl text-base leading-8 text-white/56 sm:text-lg">
              A private workspace for the team to plan, produce, review, publish,
              and learn from every piece of content.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-white/38">
            <ShieldCheck className="size-4 text-coral-light" aria-hidden="true" />
            Access is limited to provisioned ContentOS members.
          </div>
        </section>

        <section className="flex items-center border-t border-white/10 bg-paper px-6 py-12 text-ink sm:px-10 lg:border-l lg:border-t-0 lg:px-16">
          <div className="w-full max-w-md lg:mx-auto"><div className="mb-6 flex justify-end"><LanguageSwitch compact /></div>
            <div className="grid size-12 place-items-center rounded-xl border border-line bg-canvas-raised text-coral">
              <KeyRound className="size-5" aria-hidden="true" />
            </div>
            <p className="mt-7 text-xs font-extrabold uppercase tracking-[0.2em] text-coral">
              Secure sign in
            </p>
            <h2 className="mt-2 font-display text-4xl font-semibold tracking-[-0.02em]">
              Welcome back
            </h2>
            <p className="mt-3 leading-7 text-ink-soft">
              Use the work account issued by your ContentOS administrator.
            </p>

            <Button type="button" size="lg" variant="secondary" className="mt-8 w-full" disabled={submitting} onClick={()=>void handleGoogle()}><LogIn className="size-4"/>Continue with Google</Button><div className="my-5 flex items-center gap-3 text-xs text-ink-faint"><span className="h-px flex-1 bg-line"/>or<span className="h-px flex-1 bg-line"/></div><form className="space-y-5" onSubmit={handleSubmit}>
              <label className="block">
                <span className="mb-2 block text-sm font-bold">Work email</span>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-12 w-full rounded-lg border border-line-strong bg-white px-4 text-sm text-ink outline-none transition focus:border-coral focus:ring-3 focus:ring-coral/15"
                  placeholder="name@company.com"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold">Password</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-12 w-full rounded-lg border border-line-strong bg-white px-4 text-sm text-ink outline-none transition focus:border-coral focus:ring-3 focus:ring-coral/15"
                />
              </label>

              {errorMessage ? (
                <p role="alert" className="rounded-lg border border-coral/25 bg-coral/7 px-4 py-3 text-sm text-coral-dark">
                  {errorMessage}
                </p>
              ) : null}

              <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                {submitting ? (
                  <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <ArrowRight className="size-4" aria-hidden="true" />
                )}
                {submitting ? 'Signing in…' : 'Sign in to ContentOS'}
              </Button>
            </form><button type="button" onClick={()=>void forgotPassword()} className="mt-4 text-sm font-bold text-blue hover:underline">Forgot password</button>

            <p className="mt-6 text-xs leading-5 text-ink-muted">
              Public registration is not available. Access is provisioned by a
              Super Admin.
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}
