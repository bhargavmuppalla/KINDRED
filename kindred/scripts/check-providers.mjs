const [base = "http://localhost:3000", ...requested] = process.argv.slice(2);
const providers = ["tmdb", "geoapify", "musicbrainz"];
const selected = requested.length ? [...new Set(requested)] : providers;
const token = process.env.PROVIDER_CHECK_TOKEN;

if (!token || token.length < 32 || selected.some((provider) => !providers.includes(provider))) {
  console.error("Set PROVIDER_CHECK_TOKEN and choose tmdb, geoapify, or musicbrainz.");
  process.exit(1);
}

const endpoint = new URL("/api/provider-checks", base);
if (endpoint.protocol !== "https:" &&
    !(endpoint.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname))) {
  console.error("Use HTTPS for remote provider checks.");
  process.exit(1);
}

for (const provider of selected) {
  endpoint.searchParams.set("provider", provider);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      redirect: "error",
      signal: AbortSignal.timeout(25000),
    });
    const result = await response.json();
    console.log(JSON.stringify({ provider, routeStatus: response.status, ...result }, null, 2));
    if (!response.ok || !result.ok) process.exitCode = 1;
  } catch {
    console.error(`${provider}: could not read the provider-check route`);
    process.exitCode = 1;
  }
}
