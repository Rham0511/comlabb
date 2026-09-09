const fs = require("fs");
const html = fs.readFileSync("technician-dashboard.html", "utf8");
const start = html.indexOf("<script>");
const end = html.indexOf("</script>", start + 8);
if (start === -1 || end === -1) throw new Error("Script tags not found");
const js = html.slice(start + 8, end);
new Function(js);
console.log("OK");
