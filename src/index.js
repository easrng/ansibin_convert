import { in as in_, err, exit } from "std";
console.error = (str) => err.puts(str + "\n");
globalThis.setTimeout = (fn, t) => {
  if (t) throw new Error("not implemented");
  Promise.resolve().then(fn);
};
import xterm from "xterm-headless";
import { SerializeAddon } from "./serialize.js";
function parse(string) {
  const lines = string.split("\n");
  const header = JSON.parse(lines.shift());
  if (
    !header ||
    header.version !== 2 ||
    typeof header.width !== "number" ||
    typeof header.height !== "number"
  ) {
    throw new Error("not an asciinema v2 file");
  }
  return {
    width: header.width,
    height: header.height,
    events: (function* () {
      for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        const parsed = JSON.parse(line);
        const types = {
          o: "output",
          i: "input",
          m: "marker",
        };
        if (parsed[1] in types) {
          yield {
            time: parsed[0],
            type: types[parsed[1]],
            data: parsed[2],
          };
        } else {
          console.warn("unknown type " + parsed[1]);
        }
      }
    })(),
  };
}
const convert = async (r) => {
  const rec = parse(r);
  const term = new xterm.Terminal({
    cols: rec.width,
    rows: rec.height,
    scrollback: Infinity,
    smoothScrollDuration: 0,
    allowProposedApi: true,
  });
  const serializeAddon = new SerializeAddon();
  term.loadAddon(serializeAddon);
  const promises = [];
  for (const event of rec.events) {
    if (event.type !== "output") continue;
    promises.push(new Promise((cb) => term.write(event.data, cb)));
  }
  await Promise.all(promises);
  return JSON.stringify(
    serializeAddon.serializeAsHTML({
      includeGlobalBackground: true,
    })
  );
};

convert(in_.readAsString())
  .then(console.log)
  .catch((e) => {
    console.error(e.message);
    exit(1);
  });
