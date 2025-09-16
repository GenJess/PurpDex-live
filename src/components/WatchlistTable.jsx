import React from 'react';
import MomentumBadge from './MomentumBadge';
import { getMomentumCategory } from '../utils/momentum';

const WatchlistTable = ({ watchlistData, allCoins, onRemoveCoin, isLoading }) => {
  const coinIds = Object.keys(watchlistData || {});

  if (isLoading) {
    return <div className="text-center p-8">Loading watchlist data...</div>;
  }

  if (!watchlistData || coinIds.length === 0) {
    return <div className="text-center p-8 text-textSecondary">Your watchlist is empty. Add coins using the search bar above.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr>
            <th className="p-4 text-left text-xs font-semibold text-textSecondary uppercase tracking-wider">Asset</th>
            <th className="p-4 text-right text-xs font-semibold text-textSecondary uppercase tracking-wider">Price</th>
            <th className="p-4 text-right text-xs font-semibold text-textSecondary uppercase tracking-wider">24h Change</th>
            <th className="p-4 text-center text-xs font-semibold text-textSecondary uppercase tracking-wider">Momentum</th>
            <th className="p-4 text-center text-xs font-semibold text-textSecondary uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody>
          {coinIds.map(coinId => {
            const coinDetails = allCoins?.find(c => c.id === coinId);
            const data = watchlistData[coinId];
            const price = data?.usd;
            const change = data?.usd_24h_change;
            const momentum = getMomentumCategory(coinId); // Using centralized function

            return (
              <tr key={coinId} className="border-t border-borderPrimary hover:bg-bgHover transition-colors">
                <td className="p-4">
                  <div className="flex items-center gap-4">
                    <img src={coinDetails?.image} alt={coinDetails?.name} className="w-9 h-9" />
                    <div>
                      <div className="font-semibold text-textPrimary">{coinDetails?.name}</div>
                      <div className="text-sm text-textMuted">{coinDetails?.symbol.toUpperCase()}</div>
                    </div>
                  </div>
                </td>
                <td className="p-4 text-right font-mono text-textPrimary">${price?.toLocaleString()}</td>
                <td className={`p-4 text-right font-mono ${change >= 0 ? 'text-accentSuccess' : 'text-accentHot'}`}>
                  {change?.toFixed(2)}%
                </td>
                <td className="p-4 text-center">
                    <MomentumBadge momentum={momentum} />
                </td>
                <td className="p-4 text-center">
                  <button
                    onClick={() => onRemoveCoin(coinId)}
                    className="px-3 py-1 text-xs bg-red-600/50 text-red-300 hover:bg-red-600/80 hover:text-white rounded-md transition-all"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default WatchlistTable;
