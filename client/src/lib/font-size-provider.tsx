import { createContext, useContext, useEffect, useState } from "react";

export type FontSize = "small" | "default" | "large" | "xlarge";

type FontSizeProviderProps = {
  children: React.ReactNode;
  defaultFontSize?: FontSize;
};

type FontSizeProviderState = {
  fontSize: FontSize;
  setFontSize: (fontSize: FontSize) => void;
};

const FontSizeProviderContext = createContext<FontSizeProviderState | undefined>(undefined);

const FONT_SIZE_MAP: Record<FontSize, string> = {
  small: "90%",
  default: "100%",
  large: "108%",
  xlarge: "116%",
};

export function FontSizeProvider({
  children,
  defaultFontSize = "default",
}: FontSizeProviderProps) {
  const [fontSize, setFontSize] = useState<FontSize>(
    () => (localStorage.getItem("font-size") as FontSize) || defaultFontSize
  );

  useEffect(() => {
    const root = document.documentElement;
    root.style.fontSize = FONT_SIZE_MAP[fontSize];
    localStorage.setItem("font-size", fontSize);
  }, [fontSize]);

  return (
    <FontSizeProviderContext.Provider value={{ fontSize, setFontSize }}>
      {children}
    </FontSizeProviderContext.Provider>
  );
}

export function useFontSize() {
  const context = useContext(FontSizeProviderContext);
  if (context === undefined) {
    throw new Error("useFontSize must be used within a FontSizeProvider");
  }
  return context;
}




