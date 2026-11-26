import Image from "next/image";
import { featuredMovieId, getTmdbMovie } from "@/lib/providers/tmdb";
import type { createSupabaseClient } from "@/lib/supabase/server";
import { updateFeaturedMovie } from "./actions";

const ratingChoices = [
  { value: "-1", label: "Not for me" },
  { value: "1", label: "Liked it" },
  { value: "2", label: "Loved it" },
];

type Props = {
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseClient>>>;
  userId: string;
};

export async function FeaturedMovie({ supabase, userId }: Props) {
  const [movie, catalog] = await Promise.all([
    getTmdbMovie(featuredMovieId),
    supabase.from("catalog_items").select("id").match({
      category: "movies", provider: "tmdb", provider_id: featuredMovieId,
    }).maybeSingle(),
  ]);
  if (!movie || catalog.error) return <p>The featured movie is temporarily unavailable.</p>;

  const itemId = catalog.data?.id;
  const selection = { user_id: userId, item_id: itemId };
  const [rating, saved] = itemId ? await Promise.all([
    supabase.from("ratings").select("score").match(selection).maybeSingle(),
    supabase.from("saved_items").select("item_id").match(selection).maybeSingle(),
  ]) : [];
  if (rating?.error || saved?.error) return <p>Your movie rating is temporarily unavailable.</p>;

  const score = rating?.data?.score;
  const isSaved = Boolean(saved?.data);
  const choiceClass = "rounded-lg border border-zinc-400 px-3 py-2 aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background";

  return (
    <section className="space-y-4 border-t border-zinc-300 pt-6" aria-labelledby="featured-movie">
      <h2 id="featured-movie" className="text-xl font-semibold">{movie.title}</h2>
      <form action={updateFeaturedMovie} className="space-y-4">
        <fieldset>
          <legend className="mb-2 font-medium">Your rating</legend>
          <div className="flex flex-wrap gap-2">
            {ratingChoices.map(({ value, label }) => (
              <button key={value} className={choiceClass} type="submit" name="intent" value={value}
                aria-pressed={String(score) === value}>
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <button className={choiceClass} type="submit" name="intent" value={isSaved ? "unsave" : "save"}>
          {isSaved ? "Remove from saved" : "Save movie"}
        </button>
      </form>
      <footer className="space-y-2 text-sm">
        <h3 className="font-medium">Credits</h3>
        <a href="https://www.themoviedb.org">
          <Image src="/tmdb.svg" alt="TMDB" width={72} height={12} unoptimized />
        </a>
        <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
      </footer>
    </section>
  );
}
