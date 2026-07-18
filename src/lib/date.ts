// Returns today's date in YYYY-MM-DD format for Indian timezone (UTC+5:30).
// Used consistently across client and server to avoid UTC-local date mismatches.
export function getTodayIST(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
}

// Returns yesterday's date in YYYY-MM-DD format for Indian timezone (UTC+5:30).
export function getYesterdayIST(): string {
  const yesterday = new Date(Date.now() - 86400000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(yesterday)
}