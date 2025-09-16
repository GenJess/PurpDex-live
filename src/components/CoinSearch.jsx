import React, { useState } from 'react';

const CoinSearch = ({ allCoins, onAddCoin, isLoading }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredCoins, setFilteredCoins] = useState([]);

  const handleSearch = (e) => {
    const term = e.target.value;
    setSearchTerm(term);

    if (term.length > 1 && allCoins) {
      const filtered = allCoins.filter(coin =>
        coin.name.toLowerCase().includes(term.toLowerCase()) ||
        coin.symbol.toLowerCase().includes(term.toLowerCase())
      );
      setFilteredCoins(filtered.slice(0, 5)); // Show top 5 matches
    } else {
      setFilteredCoins([]);
    }
  };

  const handleAdd = (coin) => {
    onAddCoin(coin.id);
    setSearchTerm('');
    setFilteredCoins([]);
  };

  return (
    <div className="relative w-full">
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-textMuted">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/>
          <path d="21 21l-4.35-4.35"/>
        </svg>
      </div>
      <input
        type="text"
        placeholder={isLoading ? "Loading coins..." : "Search crypto assets..."}
        value={searchTerm}
        onChange={handleSearch}
        disabled={isLoading}
        className="w-full pl-12 pr-4 py-3 bg-bgTertiary border border-borderPrimary rounded-xl text-textPrimary text-sm transition-all duration-300 focus:outline-none focus:border-purplePrimary focus:shadow-glowPurple focus:bg-bgSecondary"
      />
      {filteredCoins.length > 0 && (
        <ul className="absolute z-10 w-full mt-2 bg-bgSecondary border border-borderPrimary rounded-xl shadow-lg">
          {filteredCoins.map(coin => (
            <li
              key={coin.id}
              onClick={() => handleAdd(coin)}
              className="p-3 cursor-pointer hover:bg-bgHover flex items-center gap-3"
            >
              <img src={coin.image} alt={coin.name} className="w-6 h-6" />
              <span className="font-medium">{coin.name} ({coin.symbol.toUpperCase()})</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CoinSearch;
