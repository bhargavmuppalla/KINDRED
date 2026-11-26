import { Suspense } from "react";
import Link from "next/link";
import { createSupabaseClient } from "@/lib/supabase/server";
import { signIn, signOut } from "./actions";
import { FeaturedMovie } from "./movie";

const errors: Record<string, string> = {
  missing: "Enter your email and password.",
  credentials: "Check your email and password and make sure your account is confirmed.",
  unavailable: "Sign-in is temporarily unavailable. Try again in a moment.",
  "movie-update": "The movie update failed. Try again in a moment.",
  "sign-out": "Sign-out failed. Try again in a moment.",
};

const inputClass = "w-full rounded-lg border border-zinc-400 px-3 py-2";
const buttonClass = "rounded-lg bg-foreground px-4 py-2 font-medium text-background";

async function AccountForm({ searchParams }: PageProps<"/account">) {
  const query = await searchParams;
  const error = typeof query.error === "string" && Object.hasOwn(errors, query.error)
    ? errors[query.error]
    : null;
  const supabase = await createSupabaseClient();
  if (!supabase) return <p>Account access is temporarily unavailable.</p>;

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  return (
    <>
      {error && <p role="alert" className="mb-4">{error}</p>}
      {claims?.sub ? (
        <>
          <form action={signOut} className="space-y-4">
            <p>Signed in{claims.email ? ` as ${claims.email}` : ""}.</p>
            <button className={buttonClass} type="submit">Sign out</button>
          </form>
          <FeaturedMovie supabase={supabase} userId={claims.sub} />
        </>
      ) : (
        <form action={signIn} className="space-y-4">
          <label className="block space-y-1">
            <span>Email</span>
            <input className={inputClass} type="email" name="email" autoComplete="email" required />
          </label>
          <label className="block space-y-1">
            <span>Password</span>
            <input className={inputClass} type="password" name="password" autoComplete="current-password" required />
          </label>
          <button className={buttonClass} type="submit">Sign in</button>
        </form>
      )}
    </>
  );
}

export default function AccountPage(props: PageProps<"/account">) {
  return (
    <main className="mx-auto w-full max-w-md space-y-6 px-6 py-16">
      <Link className="underline" href="/">Kindred</Link>
      <h1 className="text-3xl font-semibold">Account</h1>
      <Suspense fallback={<p>Loading account…</p>}>
        <AccountForm {...props} />
      </Suspense>
    </main>
  );
}
