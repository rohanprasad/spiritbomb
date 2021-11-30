const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const generateHash = (content) => {
  return crypto.createHash("md5").update(content).digest("hex");
};

const checkIfFileExists = (filepath) => {
  try {
    fs.accessSync(filepath, fs.constants.F_OK);
    return true;
  } catch (err) {
    return false;
  }
};

const convertSpeed = (currentDownloadSpeed) => {
  let unit = "bytes";
  let speed = currentDownloadSpeed;
  if (speed > 1024) {
    unit = "KB";
    speed = Math.round(speed / 1024);
  }

  if (speed > 1024) {
    unit = "MB";
    speed = Math.round(speed / 1024);
  }

  return `${speed} ${unit} per second`;
};

const generateFilenameFromUrl = (url) => {
  let finalFilename;
  try {
    finalFilename = url.split("?")[0].split("/").pop();
  } catch (err) {
    finalFilename = generateHash(url);
  }
  return finalFilename;
};

module.exports = {
  generateHash,
  checkIfFileExists,
  convertSpeed,
  generateFilenameFromUrl,
};
