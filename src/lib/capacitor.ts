export const isNativePlatform = (): boolean => {
    return typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();
};

export const getCapacitor = () => {
    return typeof window !== 'undefined' ? (window as any).Capacitor : null;
};
