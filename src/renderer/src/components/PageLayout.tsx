import React from 'react';

type PageLayoutProps = {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
};

export const PageLayout = ({ children, title, subtitle }: PageLayoutProps) => (
  <div className="page-content">
    {(title || subtitle) && (
      <header className="page-header">
        {title && <h2 className="page-title">{title}</h2>}
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </header>
    )}
    {children}
  </div>
);
