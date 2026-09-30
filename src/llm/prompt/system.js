import SYSTEM from './system.md?raw'

// Byte-stable across requests so it caches. Anything that changes (today's
// date, data coverage, the user's team) goes in the first user message.
export const SYSTEM_PROMPT = SYSTEM.trim()

export function contextBlock({ manifest, favoriteTeam, today = new Date() }) {
  const s = manifest?.seasons || {}
  const lines = [
    `Today is ${today.toISOString().slice(0, 10)}.`,
    s.min ? `Data covers ${s.min}-${s.max}. The current season is ${s.current}; games through Week ${s.last_completed_week} are complete. Data refreshed ${manifest.generated_at?.slice(0, 10)}.` : null,
    favoriteTeam ? `The user's team is ${favoriteTeam}; use it for highlights and team themes when a question is about "my team" or has no other focus team.` : null,
  ].filter(Boolean)
  return `<context>\n${lines.join('\n')}\n</context>`
}
