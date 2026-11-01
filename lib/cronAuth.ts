// Scheduled jobs (Supabase Cron) call our endpoints with the shared CRON_SECRET as a bearer token.
// An unset secret never matches, so a missing env var can't open the endpoint.
export function isCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}
