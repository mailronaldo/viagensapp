// Só para scripts de teste fora do Next: neutraliza o guard `server-only`.
const Module = require("node:module");
const orig = Module._load;
Module._load = function (request, ...rest) {
  if (request === "server-only") return {};
  return orig.call(this, request, ...rest);
};
