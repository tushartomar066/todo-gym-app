const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

export function getTodayIST(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
}

export function getYesterdayIST(): string {
  const yesterday = new Date(Date.now() - 86400000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(yesterday)
}

export function istDayBounds(istDate: string): { startUtc: string; endUtc: string } {
  const startMs = new Date(`${istDate}T00:00:00Z`).getTime() - IST_OFFSET_MS
  const endMs = startMs + 86400000
  return {
    startUtc: new Date(startMs).toISOString(),
    endUtc: new Date(endMs - 1).toISOString(),
  }
}

export function istRangeBounds(startIst: string, endIst: string): { startUtc: string; endUtc: string } {
  const startMs = new Date(`${startIst}T00:00:00Z`).getTime() - IST_OFFSET_MS
  const endMs = new Date(`${endIst}T00:00:00Z`).getTime() - IST_OFFSET_MS + 86400000
  return {
    startUtc: new Date(startMs).toISOString(),
    endUtc: new Date(endMs - 1).toISOString(),
  }
}

export function utcToIstDate(iso: string): string {
  const shifted = new Date(new Date(iso).getTime() + IST_OFFSET_MS)
  return shifted.toISOString().slice(0, 10)
}
