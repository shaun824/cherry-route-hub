// Only the builder-confirmed installation may receive credentials. Never follow redirects.
export async function everlyticRequest(path: string, method: "GET" | "POST", username: string, apiKey: string) {
  const response = await fetch(`https://newsletters.computicket-mails.com${path}`, {
    method, redirect: "error", signal: AbortSignal.timeout(30_000),
    headers: { Authorization: `Basic ${btoa(`${username}:${apiKey}`)}`, Accept: "application/json" },
  });
  if (!response.ok) {
    // Provider bodies can echo credentials; do not log or return them.
    throw new Error(`Everlytic request failed (${response.status}). ${response.status === 401 ? "Check your Everlytic username and API key." : response.status === 403 ? "Check this account's email permissions." : "Check the campaign in Everlytic and try again."}`);
  }
  const payload = await response.json();
  if (payload === false || payload?.success === false || payload?.error) throw new Error("Everlytic did not accept the request. Check the campaign in Everlytic.");
  return payload;
}