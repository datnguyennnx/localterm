import { FRIENDLY_HOSTNAME } from "../constants.js";

export const getFriendlyUrl = (port: number): string => `http://${FRIENDLY_HOSTNAME}:${port}`;
