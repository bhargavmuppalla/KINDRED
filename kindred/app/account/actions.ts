"use server";

import { createClient } from "@supabase/supabase-js";
import { featuredMovieId, getTmdbMovie } from "@/lib/providers/tmdb";
import { redirect } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/server";

export async function signIn(formData: FormData) {
  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || !email.trim() ||
      typeof password !== "string" || !password) {
    redirect("/account?error=missing");
  }

  const supabase = await createSupabaseClient(true);
  if (!supabase) redirect("/account?error=unavailable");

  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) {
    const reason = error.code === "invalid_credentials" || error.code === "email_not_confirmed"
      ? "credentials"
      : "unavailable";
    redirect(`/account?error=${reason}`);
  }

  redirect("/account");
}

export async function signOut() {
  const supabase = await createSupabaseClient(true);
  if (!supabase) redirect("/account?error=unavailable");

  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) redirect("/account?error=sign-out");

  redirect("/account");
}

export async function updateFeaturedMovie(formData: FormData) {
  const intent = formData.get("intent");
  if (intent !== "-1" && intent !== "1" && intent !== "2" && intent !== "save" && intent !== "unsave") {
    redirect("/account?error=movie-update");
  }

  const supabase = await createSupabaseClient(true);
  if (!supabase) redirect("/account?error=movie-update");

  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) redirect("/account");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) redirect("/account?error=movie-update");

  const movie = await getTmdbMovie(featuredMovieId);
  if (!movie) redirect("/account?error=movie-update");

  const { category, provider, provider_id } = movie;
  const catalog = createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: item, error: catalogError } = await catalog.from("catalog_items")
    .upsert({ category, provider, provider_id }, { onConflict: "category,provider,provider_id" })
    .select("id")
    .single();
  if (catalogError) redirect("/account?error=movie-update");

  const selection = { user_id: userId, item_id: item.id };
  const result = intent === "save"
    ? await supabase.from("saved_items").upsert(selection, { onConflict: "user_id,item_id", ignoreDuplicates: true })
    : intent === "unsave"
      ? await supabase.from("saved_items").delete().match(selection)
      : await supabase.from("ratings").upsert({ ...selection, score: Number(intent) }, { onConflict: "user_id,item_id" });

  redirect(result.error ? "/account?error=movie-update" : "/account");
}
