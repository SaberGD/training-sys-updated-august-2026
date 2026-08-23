import React, { createContext, useContext, useState, useEffect } from 'react';

interface SensitiveDataContextType {
  showSensitiveData: boolean;
  setShowSensitiveData: (show: boolean) => void;
  toggleShowSensitiveData: () => void;
}

const SensitiveDataContext = createContext<SensitiveDataContextType>({
  showSensitiveData: false,
  setShowSensitiveData: () => {},
  toggleShowSensitiveData: () => {},
});

export const SensitiveDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [showSensitiveData, setShowSensitiveData] = useState<boolean>(() => {
    return localStorage.getItem('show_sensitive_data') === 'true';
  });

  const toggleShowSensitiveData = () => {
    setShowSensitiveData(prev => {
      const next = !prev;
      localStorage.setItem('show_sensitive_data', String(next));
      return next;
    });
  };

  useEffect(() => {
    localStorage.setItem('show_sensitive_data', String(showSensitiveData));
  }, [showSensitiveData]);

  return (
    <SensitiveDataContext.Provider value={{ showSensitiveData, setShowSensitiveData, toggleShowSensitiveData }}>
      {children}
    </SensitiveDataContext.Provider>
  );
};

export const useSensitiveData = () => useContext(SensitiveDataContext);
