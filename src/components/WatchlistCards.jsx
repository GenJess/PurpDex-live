import React from 'react';
import MomentumBadge from './MomentumBadge';
import { getMomentumCategory } from '../utils/momentum';

const WatchlistCards = ({ watchlistData, allCoins, onRemoveCoin, isLoading }) => {
  const coinIds = Object.keys(watchlistData || {});

  if (isLoading) {
    return <div className="text-center p-8">Loading watchlist data...</div>;
  }

  if (!watchlistData || coinIds.length === 0) {
    return <div className="text-center p-8 text-textSecondary">Your watchlist is empty.</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
      {coinIds.map(coinId => {
        const coinDetails = allCoins?.find(c => c.id === coinId);
        const data = watchlistData[coinId];
        const price = data?.usd;
        const change = data?.usd_24h_change;
        const momentum = getMomentumCategory(coinId); // Using centralized function

        return (
          <div key={coinId} className="bg-bgTertiary border border-borderPrimary rounded-xl p-4 transition-all hover:-translate-y-1 hover:border-purpleBorder">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <img src={coinDetails?.image} alt={coinDetails?.name} className="w-9 h-9" />
                <div>
                  <div className="font-semibold text-textPrimary">{coinDetails?.name}</div>
                  <div className="text-sm text-textMuted">{coinDetails?.symbol.toUpperCase()}</div>
                </div>
              </div>
              <button
                onClick={() => onRemoveCoin(coinId)}
                className="text-textMuted hover:text-red-500 transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="text-2xl font-mono text-textPrimary mb-2">${price?.toLocaleString()}</div>
            <div className={`text-sm font-semibold mb-4 ${change >= 0 ? 'text-accentSuccess' : 'text-accentHot'}`}>
              {change?.toFixed(2)}% (24h)
            </div>

            <div className="text-center">
                <MomentumBadge momentum={momentum} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default WatchlistCards;
