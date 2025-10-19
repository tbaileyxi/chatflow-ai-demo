// Smart scheduling logic to optimize API usage within rate limits
export function shouldPollNow(league: 'NFL' | 'NCAA'): boolean {
  const now = new Date();
  const utcHours = now.getUTCHours();
  const utcDay = now.getUTCDay(); // 0=Sun, 6=Sat
  
  // Convert UTC to ET (UTC-5 or UTC-4 depending on DST)
  // Simplified: assume EST (UTC-5) for conservative polling
  const etHour = (utcHours - 5 + 24) % 24;
  
  if (league === 'NFL') {
    // Thursday Night Football (7pm-midnight ET) - extended for pregame
    if (utcDay === 4 && etHour >= 19 && etHour <= 23) return true;
    // Sunday games (10am-midnight ET) - catch all pregame + late games
    if (utcDay === 0 && etHour >= 10 && etHour <= 23) return true;
    // Monday Night Football (7pm-midnight ET) - extended for pregame
    if (utcDay === 1 && etHour >= 19 && etHour <= 23) return true;
  }
  
  if (league === 'NCAA') {
    // Friday night games (6pm-midnight ET) - extended for pregame
    if (utcDay === 5 && etHour >= 18 && etHour <= 23) return true;
    // Saturday games (10am-midnight ET) - catch all day games + late games
    if (utcDay === 6 && etHour >= 10 && etHour <= 23) return true;
  }
  
  return false; // Off-peak, skip intensive polling
}

export function isNFLGameTime(): boolean {
  const now = new Date();
  const utcHours = now.getUTCHours();
  const utcDay = now.getUTCDay();
  const month = now.getMonth(); // 0=Jan, 11=Dec
  
  // NFL season: September (8) through February (1)
  if (month < 8 && month > 1) return false;
  
  const etHour = (utcHours - 5 + 24) % 24;
  
  // Sunday games (10am-midnight ET for full coverage)
  if (utcDay === 0 && etHour >= 10 && etHour <= 23) return true;
  
  // Monday Night Football (7pm-midnight ET)
  if (utcDay === 1 && etHour >= 19 && etHour <= 23) return true;
  
  // Thursday Night Football (7pm-midnight ET)
  if (utcDay === 4 && etHour >= 19 && etHour <= 23) return true;
  
  // Saturday games (December/January only, 1pm-midnight ET)
  if (utcDay === 6 && month >= 11 && etHour >= 13 && etHour <= 23) return true;
  
  return false;
}

export function isNCAAGameTime(): boolean {
  const now = new Date();
  const utcHours = now.getUTCHours();
  const utcDay = now.getUTCDay();
  const month = now.getMonth();
  
  // NCAA season: August (7) through January (0)
  if (month > 1 && month < 7) return false;
  
  const etHour = (utcHours - 5 + 24) % 24;
  
  // Friday night games (6pm-midnight ET)
  if (utcDay === 5 && etHour >= 18 && etHour <= 23) return true;
  
  // Saturday games (10am-midnight ET for full coverage)
  if (utcDay === 6 && etHour >= 10 && etHour <= 23) return true;
  
  return false;
}
