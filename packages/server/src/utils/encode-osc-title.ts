const OSC_INTRODUCER = "\x1b]2;";
const BEL_TERMINATOR = "\x07";
const SPACE_CHAR_CODE = 0x20;
const DEL_CHAR_CODE = 0x7f;

const stripControlCharacters = (input: string): string => {
  let result = "";
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    if (code >= SPACE_CHAR_CODE && code !== DEL_CHAR_CODE) result += input[index];
  }
  return result;
};

export const encodeOscTitle = (title: string): string =>
  `${OSC_INTRODUCER}${stripControlCharacters(title)}${BEL_TERMINATOR}`;
