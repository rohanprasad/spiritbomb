const fs = require("fs");
const { checkIfFileExists, generateHash } = require("./utils");

const readMetaFile = (url) => {
  const metaFileName = `${generateHash(url)}.meta`;
  let fileMeta;
  try {
    fileMeta = JSON.parse(fs.readFileSync(`${metaFileName}`));
  } catch (err) {
    return;
  }
  return fileMeta;
};

const generateMetaFile = (url) => {
  const fileMeta = {
    fileName: generateHash(url),
    finalFilename: "",
    originalUrl: url,
    currentUrl: url,
    partStatus: {},
    contentLength: -1,
    partCount: 1,
    isHeadAssessed: false,
    downloadCompleted: false,
  };
  fs.writeFileSync(`${fileMeta.fileName}.meta`, JSON.stringify(fileMeta, null, 2));
  console.log("Generated meta file successfully.");
  return fileMeta;
};

const updateFileMeta = (fileMeta) => {
  fs.writeFileSync(`${fileMeta.fileName}.meta`, JSON.stringify(fileMeta, null, 2));
};

const generateOrReadMetaFile = (url) => {
  const metaFileName = `${generateHash(url)}.meta`;
  if (checkIfFileExists(metaFileName)) {
    const content = readMetaFile(url);
    if (content) {
      return content;
    }
  }
  return generateMetaFile(url);
};

module.exports = {
  readMetaFile,
  generateMetaFile,
  updateFileMeta,
  generateOrReadMetaFile,
};
