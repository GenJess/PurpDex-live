import React from 'react';
import CoinSearch from './CoinSearch';

const Header = ({ allCoins, onAddCoin, isLoading }) => {
  return (
    <header className="flex flex-col md:flex-row items-center justify-between py-6 mb-8 border-b border-borderPrimary">
      <div className="flex items-center gap-3 mb-4 md:mb-0">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-purplePrimary to-accentHot flex items-center justify-center font-bold text-lg text-white shadow-glowPurple relative overflow-hidden">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white">
              <path d="M8 8L12 4L16 8L12 12L8 8Z" fill="currentColor" opacity="0.8"/>
              <path d="M8 16L12 12L16 16L12 20L8 16Z" fill="currentColor" opacity="0.6"/>
              <path d="M4 12L8 8L12 12L8 16L4 12Z" fill="currentColor" opacity="0.4"/>
              <path d="M12 12L16 8L20 12L16 16L12 12Z" fill="currentColor" opacity="0.4"/>
          </svg>
          <div className="absolute top-0 left-[-100%] w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
        </div>
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-textPrimary to-purplePrimary text-transparent bg-clip-text">
            PurpDex
          </h1>
          <p className="text-sm text-textSecondary">Crypto Momentum Tracker</p>
        </div>
      </div>
      <div className="w-full md:w-auto md:max-w-xs">
         <CoinSearch allCoins={allCoins} onAddCoin={onAddCoin} isLoading={isLoading} />
      </div>
    </header>
  );
};

export default Header;
