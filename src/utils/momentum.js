// Placeholder for momentum calculation logic
// In a real application, this would involve more complex analysis (e.g., RSI, MACD, volume spikes).

export const getMomentumCategory = (coinId) => {
    // For now, we use a simple pseudo-random assignment based on the coin's ID length
    // This ensures the category is consistent for the same coin across renders.
    const categories = ['hot', 'active', 'positive', 'moderate', 'neutral'];
    const index = (coinId.length % 5);
    return categories[index];
};
