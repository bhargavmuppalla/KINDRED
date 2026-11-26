export const featuredMovieId = "329865";

export async function getTmdbMovie(id: string) {
  const token = process.env.TMDB_READ_TOKEN;
  if (!token || !/^[1-9]\d{0,9}$/.test(id)) return null;

  try {
    const response = await fetch(`https://api.themoviedb.org/3/movie/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;

    const movie = await response.json();
    if (String(movie?.id) !== id || typeof movie.title !== "string" || !movie.title.trim()) {
      return null;
    }
    return { category: "movies", provider: "tmdb", provider_id: id, title: movie.title };
  } catch {
    return null;
  }
}
