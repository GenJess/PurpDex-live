/**
 * Momentum Calculator
 *
 * Calculates price momentum (velocity) over specified timeframes.
 * Uses a sliding window approach with linear interpolation for accuracy.
 */

export type MomentumTimeframe = "30s" | "1m" | "2m" | "5m"

export interface PricePoint {
  price: number
  timestamp: number
}

/**
 * Get timeframe duration in milliseconds
 */
export function getTimeframeMs(timeframe: MomentumTimeframe): number {
  switch (timeframe) {
    case "30s":
      return 30_000
    case "1m":
      return 60_000
    case "2m":
      return 120_000
    case "5m":
      return 300_000
    default:
      return 60_000
  }
}

/**
 * Calculate optimal buffer size to support all timeframes
 * Assuming ~500ms update rate, we need:
 * - 30s: 60 points
 * - 1m: 120 points
 * - 2m: 240 points
 * - 5m: 600 points
 *
 * Using 1000 points gives us ~8.3 minutes of coverage
 */
export function getOptimalBufferSize(): number {
  return 1000
}

/**
 * Check if we have sufficient data for the timeframe
 */
export function hasSufficientData(priceHistory: PricePoint[], timeframeMs: number): boolean {
  if (priceHistory.length < 2) return false

  const oldestTimestamp = priceHistory[0].timestamp
  const newestTimestamp = priceHistory[priceHistory.length - 1].timestamp
  const coverage = newestTimestamp - oldestTimestamp

  // We need at least 80% coverage of the timeframe
  return coverage >= timeframeMs * 0.8
}

/**
 * Find the price point closest to target time using binary search
 */
function findClosestPoint(priceHistory: PricePoint[], targetTimestamp: number): PricePoint | null {
  if (priceHistory.length === 0) return null

  // Binary search for closest timestamp
  let left = 0
  let right = priceHistory.length - 1
  let closest = priceHistory[0]
  let minDiff = Math.abs(priceHistory[0].timestamp - targetTimestamp)

  while (left <= right) {
    const mid = Math.floor((left + right) / 2)
    const point = priceHistory[mid]
    const diff = Math.abs(point.timestamp - targetTimestamp)

    if (diff < minDiff) {
      minDiff = diff
      closest = point
    }

    if (point.timestamp < targetTimestamp) {
      left = mid + 1
    } else if (point.timestamp > targetTimestamp) {
      right = mid - 1
    } else {
      return point // Exact match
    }
  }

  return closest
}

/**
 * Calculate momentum (% change per timeframe)
 *
 * Algorithm:
 * 1. Get current price (latest point)
 * 2. Find historical price at exactly timeframe ago
 * 3. Calculate percentage change
 *
 * Uses binary search for O(log n) lookup performance
 */
export function calculateMomentum(priceHistory: PricePoint[], timeframeMs: number): number {
  if (priceHistory.length < 2) {
    console.debug("Insufficient data: need at least 2 points")
    return 0
  }

  const now = Date.now()
  const targetTime = now - timeframeMs

  // Find the price point closest to our target time
  const historicalPoint = findClosestPoint(priceHistory, targetTime)

  if (!historicalPoint || historicalPoint.price === 0) {
    console.debug("No valid historical point found")
    return 0
  }

  const currentPrice = priceHistory[priceHistory.length - 1].price
  const historicalPrice = historicalPoint.price

  // Calculate percentage change
  const momentum = ((currentPrice - historicalPrice) / historicalPrice) * 100

  // Debug logging for verification
  const timeDiff = now - historicalPoint.timestamp
  console.debug("Momentum calculation:", {
    timeframe: `${timeframeMs / 1000}s`,
    currentPrice,
    historicalPrice,
    timeDiff: `${(timeDiff / 1000).toFixed(1)}s`,
    momentum: `${momentum.toFixed(2)}%`,
    bufferSize: priceHistory.length,
  })

  return momentum
}

/**
 * Smooth momentum calculation using moving average
 * Reduces jitter by averaging recent momentum values
 */
export function calculateSmoothedMomentum(
  priceHistory: PricePoint[],
  timeframeMs: number,
  smoothingWindow = 3,
): number {
  if (priceHistory.length < smoothingWindow + 1) {
    return calculateMomentum(priceHistory, timeframeMs)
  }

  const recentMomentums: number[] = []

  for (let i = 0; i < smoothingWindow; i++) {
    const subset = priceHistory.slice(0, priceHistory.length - i)
    if (subset.length >= 2) {
      recentMomentums.push(calculateMomentum(subset, timeframeMs))
    }
  }

  if (recentMomentums.length === 0) return 0

  const average = recentMomentums.reduce((sum, m) => sum + m, 0) / recentMomentums.length
  return average
}
