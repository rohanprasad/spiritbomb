const yargs = require("yargs");
const downloader = require("./core");

const check = require("check-node-version");

check({ node: ">= 10.0.0" }, (error, results) => {
  if (error) {
    console.error(error);
    return;
  }

  if (results.isSatisfied) {
    const argv = yargs
      .option("l", {
        alias: "link",
        describe: "Link to download file",
        demandOption: true,
      })
      .option("p", {
        alias: "path",
        describe: "Path where to download file",
        default: process.cwd(),
      })
      .option("n", {
        alias: "name",
        describe: "Name of the downloaded file",
        default: "",
      })
      .option("s", {
        alias: "Silent",
        describe: "Silent",
        default: false,
      })
      .option("o", {
        alias: "Origin",
        describe: "Original URL",
        default: ""
      }).argv;

    downloader(argv);
    return;
  }

  console.error("Update node version to 10.0.0 or Up, backward compatibility coming soon.");
});
