export const withTrailingSlash = (input: string) => {
  return `${trimSlash(input)}/`;
};

export const trimSlash = (input: string) => {
  let i = input.length;
  while (i-- && input.charAt(i) === "/") {}
  return input.substring(0, i + 1);
};
