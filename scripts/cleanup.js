const fs = require("node:fs");
const path = require("node:path");

const directory = path.resolve(__dirname, "..");
const files = fs.readdirSync(directory);

for (const file of files) {
  if (file.endsWith(".vsix")) {
    fs.unlinkSync(path.join(directory, file));
    console.log(`Deleted: ${file}`);
  }
}
