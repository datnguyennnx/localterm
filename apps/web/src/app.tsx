import { useEffect } from "react";
import { Terminal } from "@/components/terminal";

export const App = () => {
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    const armBeforeUnload = () => window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("keydown", armBeforeUnload, { once: true });
    return () => {
      window.removeEventListener("keydown", armBeforeUnload);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  return <Terminal />;
};
