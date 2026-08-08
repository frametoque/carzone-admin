export const clientCache = new Map<string, any>();

export const getCachedData = (key: string) => clientCache.get(key);
export const setCachedData = (key: string, data: any) => clientCache.set(key, data);
export const clearCache = (key?: string) => key ? clientCache.delete(key) : clientCache.clear();
