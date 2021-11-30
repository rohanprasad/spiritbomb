const sb = require("./core/index");
const fs = require("fs");
const path = require("path");

const dir = path.resolve(process.cwd(), "test");

const clean = () => {
  fs.rmSync(dir, { recursive: true, force: true });
};

const setup = () => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
};

clean();
setup();

sb({
  link: "https://filesamples.com/samples/code/json/sample2.json",
  name: "test.json",
  origin: "https://filesamples.com/formats/json",
  path: dir,
});
