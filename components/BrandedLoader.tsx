import React from 'react';

interface BrandedLoaderProps {
  message?: string;
  dir?: 'ltr' | 'rtl';
}

const BrandedLoader: React.FC<BrandedLoaderProps> = ({
  message = 'Preparing your workspace',
  dir = 'ltr',
}) => (
  <div className="sg-branded-loader" dir={dir} role="status" aria-live="polite">
    <div className="sg-loader-grid" aria-hidden="true" />
    <div className="sg-loader-content">
      <div className="sg-loader-logo-wrap">
        <span className="sg-loader-orbit sg-loader-orbit-outer" aria-hidden="true" />
        <span className="sg-loader-orbit sg-loader-orbit-inner" aria-hidden="true" />
        <img src="/saber-group-logo.png" alt="Saber Group" className="sg-loader-logo" />
      </div>

      <div className="sg-loader-copy">
        <span className="sg-loader-kicker">SABER GROUP / TRAINING OS</span>
        <p>{message}</p>
      </div>

      <div className="sg-loader-progress" aria-hidden="true">
        <span />
      </div>
      <span className="sg-loader-status"><i /> SYSTEM LOADING</span>
    </div>
  </div>
);

export default BrandedLoader;
