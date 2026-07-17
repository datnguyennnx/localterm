import { useEffect } from "react";

export const useCwdSync = (liveCwd: string | null): void => {
  useEffect(() => {
    if (!liveCwd) return;
    const url = new URL(window.location.href);
    url.searchParams.set("cwd", liveCwd);
    window.history.replaceState(null, "", url);
  }, [liveCwd]);
};
