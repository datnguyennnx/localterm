import type { Context, MiddlewareHandler } from "hono";
import { LOOPBACK_HOSTS } from "../constants.js";

const stripPort = (hostHeader: string | undefined): string | null => {
  if (!hostHeader) return null;
  const trimmed = hostHeader.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("[")) {
    const end = trimmed.indexOf("]");
    return end === -1 ? trimmed : trimmed.slice(0, end + 1);
  }
  // More than one colon → bare IPv6 (e.g. ::1, fe80::1, ::ffff:127.0.0.1)
  if ((trimmed.match(/:/g) || []).length > 1) {
    return `[${trimmed}]`;
  }
  // Exactly one colon → host:port — strip the port
  const colonIndex = trimmed.lastIndexOf(":");
  if (colonIndex !== -1) {
    const afterColon = trimmed.slice(colonIndex + 1);
    if (/^\d{1,5}$/.test(afterColon)) {
      return trimmed.slice(0, colonIndex); // it's a port, strip it
    }
  }
  return trimmed;
};

const originHostname = (originHeader: string | undefined): string | null => {
  if (!originHeader) return null;
  if (originHeader === "null") return null;
  try {
    return new URL(originHeader).hostname;
  } catch {
    return null;
  }
};

const isLoopback = (hostname: string | null): boolean => {
  if (!hostname) return false;
  if (LOOPBACK_HOSTS.has(hostname)) return true;
  if (hostname === "localhost" || hostname.endsWith(".localhost")) return true;
  return false;
};

const normalizeBareIpv6 = (host: string): string =>
  host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;

export const isLoopbackHost = (host: string): boolean => isLoopback(normalizeBareIpv6(host));

export const enforceLoopback = (context: Context): Response | null => {
  const hostHeader = context.req.header("host");
  const hostname = stripPort(hostHeader);
  if (!isLoopback(hostname)) {
    return new Response("forbidden: non-loopback host", { status: 403 });
  }
  const origin = context.req.header("origin");
  if (origin !== undefined) {
    const originHost = originHostname(origin);
    if (!isLoopback(originHost)) {
      return new Response("forbidden: cross-origin", { status: 403 });
    }
  }
  return null;
};

export const loopbackMiddleware: MiddlewareHandler = async (context, next) => {
  const blocked = enforceLoopback(context);
  if (blocked) return blocked;
  await next();
};
