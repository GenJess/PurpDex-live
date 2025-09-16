import React, { useState } from 'react';
import { useQuery, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import Watchlist from './Watchlist';
import Header from './components/Header';
import StatsGrid from './components/StatsGrid';

const queryClient = new QueryClient();

const AppContent = () => {
  const [watchlist, setWatchlist] = useState(['bitcoin', 'ethereum', 'solana', 'cardano', 'ripple']);

  const { data: allCoins, isLoading: isLoadingAllCoins } = useQuery({
    queryKey: ['allCoins'],
    queryFn: async () => {
      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/coins/markets`, {
        params: { vs_currency: 'usd', order: 'market_cap_desc', per_page: 100, page: 1 },
      });
      return response.data;
    },
    staleTime: Infinity,
  });

  const handleAddCoin = (coinId) => {
    if (!watchlist.includes(coinId)) {
      setWatchlist([...watchlist, coinId]);
    }
  };

  const handleRemoveCoin = (coinId) => {
    setWatchlist(watchlist.filter((id) => id !== coinId));
  };

  return (
    <div className="container mx-auto px-4 sm:px-8 max-w-7xl">
      <Header allCoins={allCoins} onAddCoin={handleAddCoin} isLoading={isLoadingAllCoins} />
      <StatsGrid />
      <main>
        <Watchlist
          watchlist={watchlist}
          allCoins={allCoins}
          onRemoveCoin={handleRemoveCoin}
        />
      </main>
    </div>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;
