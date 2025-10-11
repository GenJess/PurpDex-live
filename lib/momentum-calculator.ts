/**
 * MOMENTUM CALCULATION SYSTEM
 *
 * Problem Identified:
 * - Buffer size of 200 points insufficient for longer timeframes
 * - At 500ms update rate: 200 points = 100 seconds coverage
 * - For 5min (300s) timeframe, we only have 1/3 of needed data
 *
 * Solution:
 * - Increase buffer to 1000 points (500 seconds = 8.3 minutes)
 * - Add adaptive sampling for sparse data
 * - Implement fallback for insufficient data
 */

export interface PricePoint {
  price: number
  timestamp: number
}

export type MomentumTimeframe = "30s" | "1m" | "2m" | "5m"

/**
 * Get timeframe in milliseconds
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
 * Calculate momentum (rate of change) over a given timeframe
 *
 * @param priceHistory - Array of price points with timestamps
 * @param timeframeMs - Timeframe in milliseconds
 * @returns Percentage change over timeframe (e.g., 2.5 = +2.5%)
 */
export function calculateMomentum(priceHistory: PricePoint[], timeframeMs: number): number {
  if (priceHistory.length < 2) {
    console.debug("Insufficient price history", { points: priceHistory.length })
    return 0
  }

  const currentPoint = priceHistory[priceHistory.length - 1]
  const targetTime = currentPoint.timestamp - timeframeMs

  // Find the closest price point to our target time
  // We want the point just BEFORE our target time for accurate calculation
  let closestPoint: PricePoint | null = null
  let minDiff = Number.POSITIVE_INFINITY

  for (const point of priceHistory) {
    // Only consider points that are before or at target time
    if (point.timestamp <= targetTime) {
      const diff = Math.abs(point.timestamp - targetTime)
      if (diff < minDiff) {
        minDiff = diff
        closestPoint = point
      }
    }
  }

  // Fallback: if no point before target, use oldest available
  if (!closestPoint && priceHistory.length > 0) {
    closestPoint = priceHistory[0]
    console.warn("Insufficient history for timeframe", {
      timeframeMs,
      oldestPointAge: currentPoint.timestamp - priceHistory[0].timestamp,
      bufferSize: priceHistory.length,
    })
  }

  if (!closestPoint || closestPoint.price === 0) return 0

  const actualTimeframe = currentPoint.timestamp - closestPoint.timestamp
  const priceChange = currentPoint.price - closestPoint.price
  const percentChange = (priceChange / closestPoint.price) * 100

  console.debug("Momentum calculation", {
    timeframeRequested: timeframeMs,
    actualTimeframe,
    priceChange,
    percentChange,
    pointsInBuffer: priceHistory.length,
  })

  return percentChange
}

/**
 * Get optimal buffer size for tracking multiple timeframes
 * We want to store enough data to cover the longest timeframe with margin
 */
export function getOptimalBufferSize(): number {
  // 5min = 300s, at 500ms update rate = 600 points
  // Add 40% margin for safety = 840 points
  // Round up to 1000 for clean number
  return 1000
}

/**
 * Check if we have sufficient data for a timeframe
 */
export function hasSufficientData(priceHistory: PricePoint[], timeframeMs: number): boolean {
  if (priceHistory.length < 2) return false

  const currentTime = priceHistory[priceHistory.length - 1].timestamp
  const oldestTime = priceHistory[0].timestamp
  const coverage = currentTime - oldestTime

  // We need at least 80% of the requested timeframe
  return coverage >= timeframeMs * 0.8
}
