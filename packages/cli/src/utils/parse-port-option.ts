import { InvalidArgumentError } from "commander";
import { MAX_TCP_PORT, MIN_TCP_PORT } from "../constants.js";
import { cliError, formatCliError } from "../errors.js";

export const parsePortOption = (raw: string): number => {
  if (!/^\d+$/.test(raw)) {
    throw new InvalidArgumentError(
      formatCliError(cliError.invalidPort(raw, "expected an integer port number")),
    );
  }
  const port = Number.parseInt(raw, 10);
  if (port < MIN_TCP_PORT || port > MAX_TCP_PORT) {
    throw new InvalidArgumentError(
      formatCliError(
        cliError.invalidPort(raw, `must be between ${MIN_TCP_PORT} and ${MAX_TCP_PORT}`),
      ),
    );
  }
  return port;
};
