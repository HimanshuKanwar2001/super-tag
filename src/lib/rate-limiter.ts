
'use server';

interface RateLimitInfo {
  count: number;
  resetTime: number; // Timestamp when the quota will reset
}

// WARNING: This in-memory store is not suitable for production in a serverless environment.
// It will reset on new instance spin-ups or deployments.
// For production, use a persistent store like Firestore or Redis.
const ipUsageStore: Map<string, RateLimitInfo> = new Map();
const MAX_GENERATIONS_PER_DAY = 5; // Made internal
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function getRateLimitInfo(ip: string): RateLimitInfo {
  const now = Date.now();
  let userData = ipUsageStore.get(ip);

  if (!userData || now >= userData.resetTime) {
    // New user or quota expired, reset it
    userData = { count: MAX_GENERATIONS_PER_DAY, resetTime: now + ONE_DAY_MS };
    ipUsageStore.set(ip, userData);
  }
  return userData;
}

export async function checkAndRecordGeneration(ip: string | null): Promise<{ 
  allowed: boolean; 
  remaining: number; 
  error?: string;
  resetTime?: number;
}> {
  if (!ip) {
    return { allowed: false, remaining: 0, error: 'IP address not available for rate limiting.' };
  }

  const userData = getRateLimitInfo(ip);

  if (userData.count <= 0) {
    return { 
      allowed: false, 
      remaining: 0, 
      error: `Daily generation limit of ${MAX_GENERATIONS_PER_DAY} reached.`,
      resetTime: userData.resetTime 
    };
  }

  // Decrement count and update store
  const newCount = userData.count - 1;
  ipUsageStore.set(ip, { ...userData, count: newCount });
  
  return { allowed: true, remaining: newCount, resetTime: userData.resetTime };
}

export async function getRemainingGenerations(ip: string | null): Promise<{ remaining: number; resetTime?: number; maxGenerations: number }> {
    if (!ip) {
        // Default if no IP, or could throw error/return specific state
        return { remaining: MAX_GENERATIONS_PER_DAY, maxGenerations: MAX_GENERATIONS_PER_DAY, resetTime: Date.now() + ONE_DAY_MS };
    }
    const userData = getRateLimitInfo(ip);
    return { remaining: userData.count, resetTime: userData.resetTime, maxGenerations: MAX_GENERATIONS_PER_DAY };
}

