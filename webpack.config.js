const path = require("path");

module.exports = {
  entry: "./blockchain.js",
  output: {
    filename: "blockchain.js",
    path: path.resolve(__dirname, "dist"),
  },
  target: "node",
  mode: "development",
};
