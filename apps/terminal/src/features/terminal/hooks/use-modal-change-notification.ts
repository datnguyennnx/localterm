import { useEffect } from "react";

export const useModalChangeNotification = (
  isModalOpen: boolean,
  onModalOpenChange?: (open: boolean) => void,
): void => {
  useEffect(() => {
    onModalOpenChange?.(isModalOpen);
  }, [isModalOpen, onModalOpenChange]);
};
