import kleur from "kleur";
import { type CliError, formatCliError, hintForCliError } from "../errors.js";

const colorForSeverity = (severity: CliError["severity"]): ((value: string) => string) => {
  switch (severity) {
    case "error":
      return kleur.red;
    case "warning":
      return kleur.yellow;
    default:
      return (value: string) => value;
  }
};

export const reportCliError = (error: CliError): void => {
  const colored = colorForSeverity(error.severity);
  const prefix = error.severity === "error" ? "✗ " : "";
  console.log(colored(`${prefix}${formatCliError(error)}`));
  const hint = hintForCliError(error);
  if (hint !== null) console.log(hint);
};
