import React, { createContext, useContext, useState } from "react";

type FileContextType = {
  file?: File | undefined;
  setFile: (file?: File | undefined) => void;
  parsedData?: any;
  setParsedData: (data?: any) => void;
};

const FileContext = createContext<FileContextType | undefined>(undefined);

export const FileProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [file, setFile] = useState<File | undefined>(undefined);
  const [parsedData, setParsedData] = useState<any | undefined>(undefined);

  return (
    <FileContext.Provider value={{ file, setFile, parsedData, setParsedData }}>
      {children}
    </FileContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useFile = (): FileContextType => {
  const ctx = useContext(FileContext);
  if (!ctx) {
    throw new Error("useFile must be used inside FileProvider");
  }

  return ctx;
};
