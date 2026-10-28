// Only the builder-confirmed installation may receive credentials. Never follow redirects.
export async function everlyticRequest(path: string, method: "GET" | "POST", username: string, apiKey: string, body?: unknown) {
  const response = await fetch(`https://newsletters.computicket-mails.com${path}`, {
    // Edge runtimes only allow "follow" or "manual"; "manual" keeps the
    // builder-confirmed host rule by never following redirects.
    method, redirect: "manual", signal: AbortSignal.timeout(30_000),
    headers: {
      Authorization: `Basic ${btoa(`${username}:${apiKey}`)}`, Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status >= 300 && response.status < 400) {
    throw Object.assign(new Error("Everlytic redirected the request. Check the configured installation host."), { status: response.status });
  }
  if (!response.ok) {
    // Provider bodies can echo credentials; do not log or return them.
    throw Object.assign(new Error(`Everlytic request failed (${response.status}). ${response.status === 401 ? "Check your Everlytic username and API key." : response.status === 403 ? "Check this account's email permissions." : "Check the campaign in Everlytic and try again."}`), { status: response.status });
  }
  const payload = await response.json();
  if (payload === false || payload?.success === false || payload?.error) throw new Error("Everlytic did not accept the request. Check the campaign in Everlytic.");
  return payload;
}
