import React from 'react';

const MomentumBadge = ({ momentum }) => {
    const badgeClasses = {
      hot: 'bg-accentHot/15 text-accentHot border-accentHot/30',
      active: 'bg-accentCyan/15 text-accentCyan border-accentCyan/30',
      positive: 'bg-accentSuccess/15 text-accentSuccess border-accentSuccess/30',
      moderate: 'bg-accentWarning/15 text-accentWarning border-accentWarning/30',
      neutral: 'bg-textSecondary/15 text-textSecondary border-textSecondary/30',
    };

    return (
      <div className={`px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-1.5 border ${badgeClasses[momentum] || badgeClasses['neutral']}`}>
        {momentum}
      </div>
    );
};

export default MomentumBadge;
