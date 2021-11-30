const fs = require("fs");
const { checkIfFileExists, generateHash } = require("./utils");

const readMetaFile = (metaFileName) => {
  let fileMeta;
  try {
    fileMeta = JSON.parse(fs.readFileSync(`${metaFileName}`));
  } catch (err) {
    return;
  }
  return fileMeta;
};

const generateMetaFile = (url, name = "", origin = "") => {
  const fileMeta = {
    fileName: generateHash(url),
    finalFilename: name,
    origin: origin,
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

const generateOrReadMetaFile = ({link, name, origin}) => {
  const metaFileName = `${generateHash(link)}.meta`;
  if (checkIfFileExists(metaFileName)) {
    const content = readMetaFile(metaFileName);
    if (content) {
      return content;
    }
  }
  return generateMetaFile(link, name, origin);
};

module.exports = {
  readMetaFile,
  generateMetaFile,
  updateFileMeta,
  generateOrReadMetaFile,
};
