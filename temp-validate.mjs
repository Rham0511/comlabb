import { readFileSync } from "fs";
const html = readFileSync("technician-dashboard.html", "utf8");
const start = html.indexOf("<script>");
const end = html.lastIndexOf("</script>");
if (start === -1 || end === -1) throw new Error("Script tags not found");
const js = html.slice(start + 8, end);
try {
  new Function(js);
  console.log("OK");
} catch (e) {
  console.error("ERROR", e.message);
  console.error(e.stack.split("\n").slice(0,5).join("\n"));
  process.exit(1);
}
