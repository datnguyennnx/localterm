import { useCallback, useEffect, useRef } from "react";
import { Terminal } from "@/features/terminal";

export const App = () => {
  const isModalOpenRef = useRef(false);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isModalOpenRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  const handleModalOpenChange = useCallback((open: boolean) => {
    isModalOpenRef.current = open;
  }, []);

  return <Terminal onModalOpenChange={handleModalOpenChange} />;
};
