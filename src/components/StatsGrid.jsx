import React from 'react';

const StatCard = ({ title, value, change, changeType, icon, suffix }) => {
  const momentumClasses = {
    positive: 'text-accentSuccess bg-accentSuccess/10 border border-accentSuccess/20',
    active: 'text-accentCyan bg-accentCyan/10 border border-accentCyan/20',
    high: 'text-accentHot bg-accentHot/10 border border-accentHot/20',
  };

  return (
    <div className="bg-bgSecondary border border-borderPrimary rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-glowSubtle hover:border-purpleBorder relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-purplePrimary to-transparent opacity-70" />
      <div className="flex items-center justify-between mb-5">
        <span className="text-sm font-medium text-textSecondary">{title}</span>
        <div className="p-2 rounded-lg bg-purpleLight">{icon}</div>
      </div>
      <div className="text-3xl font-bold text-textPrimary mb-3">
        {value}
        {suffix && <span className="text-sm text-textSecondary font-medium ml-2">{suffix}</span>}
      </div>
      <div className={`text-sm font-semibold flex items-center gap-1.5 px-3 py-1 rounded-full w-fit ${momentumClasses[changeType]}`}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M7 17L17 7M17 7H7M17 7V17"/>
        </svg>
        {change}
      </div>
    </div>
  );
};

const StatsGrid = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
      <StatCard
        title="Total Market Cap"
        value="$2.10T"
        suffix="($2.1T)"
        change="+2.4%"
        changeType="positive"
        icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L22 8.5V15.5L12 22L2 15.5V8.5L12 2Z" fill="var(--purple-primary)" fillOpacity="0.3"/><path d="M12 2L22 8.5L12 15L2 8.5L12 2Z" stroke="var(--purple-primary)" strokeWidth="2"/></svg>}
      />
      <StatCard
        title="24h Volume"
        value="$89.2B"
        suffix="($89.2B)"
        change="+12.1% 🔥"
        changeType="active"
        icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" fill="var(--accent-cyan)" fillOpacity="0.3"/><path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" stroke="var(--accent-cyan)" strokeWidth="2"/></svg>}
      />
      <StatCard
        title="Hot Momentum"
        value="47"
        suffix="Assets"
        change="+8 assets"
        changeType="high"
        icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L15.09 8.26L22 9L17 14L18.18 21L12 17.77L5.82 21L7 14L2 9L8.91 8.26L12 2Z" fill="var(--accent-hot)" fillOpacity="0.3"/><path d="M12 2L15.09 8.26L22 9L17 14L18.18 21L12 17.77L5.82 21L7 14L2 9L8.91 8.26L12 2Z" stroke="var(--accent-hot)" strokeWidth="2"/></svg>}
      />
      <StatCard
        title="Dominance: BTC"
        value="52.7%"
        suffix="ETH: 18.2%"
        change="+0.1%"
        changeType="positive"
        icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9" fill="var(--purple-primary)" fillOpacity="0.2"/><path d="M9 12L11 14L15 10M21 12C21 16.97 17 21 12 21C7 21 3 16.97 3 12C3 7.03 7 3 12 3C17 3 21 7.03 21 12Z" stroke="var(--purple-primary)" strokeWidth="2"/></svg>}
      />
    </div>
  );
};

export default StatsGrid;
