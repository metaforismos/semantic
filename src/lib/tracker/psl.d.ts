declare module "psl" {
  export type ParsedDomain = {
    input: string;
    tld: string | null;
    sld: string | null;
    domain: string | null;
    subdomain: string | null;
    listed: boolean;
  };
  export type ParseError = {
    input: string;
    error: { message: string; code: string };
  };
  export function parse(host: string): ParsedDomain | ParseError;
  export function get(host: string): string | null;
  export function isValid(host: string): boolean;
}
