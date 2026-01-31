import React from 'react';

type CardProps = {
  children: React.ReactNode;
  className?: string;
  title?: string;
};

export const Card = ({ children, className = '', title }: CardProps) => (
  <div className={`card card-float ${className}`}>
    {title && <h3 className="card-title">{title}</h3>}
    {children}
  </div>
);
