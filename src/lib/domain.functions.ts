import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { domainLang } from "./domains";

export const getDomainLang = createServerFn({ method: "GET" }).handler(() => {
  const req = getRequest();
  return domainLang(req.headers.get("host") ?? new URL(req.url).host);
});
