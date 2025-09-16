import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import WatchlistTable from './components/WatchlistTable';
import WatchlistCards from './components/WatchlistCards';

const Watchlist = ({ watchlist, allCoins, onRemoveCoin }) => {
  const [view, setView] = useState('table'); // 'table' or 'cards'

  const { data: watchlistData, isLoading: isLoadingWatchlist, error } = useQuery({
    queryKey: ['watchlistPrices', watchlist],
    queryFn: async () => {
      if (watchlist.length === 0) return {};
      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/simple/price`, {
        params: { ids: watchlist.join(','), vs_currencies: 'usd', include_24hr_change: true },
      });
      return response.data;
    },
    refetchInterval: 30000,
    enabled: watchlist.length > 0,
  });

  if (error) {
    return <div className="text-center text-red-500">Error fetching data. Please try again later.</div>;
  }

  const isLoading = isLoadingWatchlist && watchlist.length > 0;

  return (
    <div className="bg-bgSecondary border border-borderPrimary rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between p-6 border-b border-borderPrimary bg-gradient-to-r from-bgSecondary to-bgTertiary">
        <h2 className="text-xl font-semibold text-textPrimary flex items-center gap-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14H12L11 22L21 10H12L13 2Z"/></svg>
          Live Watchlist
        </h2>
        <div className="flex gap-1 bg-bgTertiary p-1 rounded-xl border border-borderPrimary">
          <button onClick={() => setView('table')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${view === 'table' ? 'bg-purplePrimary text-white shadow-glowPurple' : 'text-textSecondary hover:bg-bgHover'}`}>Table</button>
          <button onClick={() => setView('cards')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${view === 'cards' ? 'bg-purplePrimary text-white shadow-glowPurple' : 'text-textSecondary hover:bg-bgHover'}`}>Cards</button>
        </div>
      </div>

      <div>
        {view === 'table' ? (
          <WatchlistTable
            watchlistData={watchlistData}
            allCoins={allCoins}
            onRemoveCoin={onRemoveCoin}
            isLoading={isLoading}
          />
        ) : (
          <WatchlistCards
            watchlistData={watchlistData}
            allCoins={allCoins}
            onRemoveCoin={onRemoveCoin}
            isLoading={isLoading}
          />
        )}
      </div>
    </div>
  );
};

export default Watchlist;
