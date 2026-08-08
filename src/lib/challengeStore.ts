// In-memory store for WebAuthn challenges
// In a production environment with multiple serverless instances, you'd use Redis or similar.
const challenges = new Map<string, string>();

export const getChallenge = (userId: string) => challenges.get(userId);
export const setChallenge = (userId: string, challenge: string) => challenges.set(userId, challenge);
export const removeChallenge = (userId: string) => challenges.delete(userId);
