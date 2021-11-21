const superagent = require("superagent").agent();
const fs = require("fs");
const { pipeline } = require("stream");
const readline = require("readline");

const MetaHelper = require("./meta-helper");
const config = require("./config");
const constants = require("./constants");
const utils = require("./utils");
const SpeedHelper = require("./speed-helper");

let downloadsInProgress = 0;
let currentDownloadSpeed = 0;
let currentProgress = 0;

const setReferer = () => {
  // Set referer if required.
};

const cookies = () => {};

let metainfo = {};

const getBytesRange = (part) => {
  let startRange = (part - 1) * config.chunkSizeInBytes;
  let endRange = part * config.chunkSizeInBytes - 1;
  endRange = Math.min(endRange, metainfo.contentLength);
  startRange = Math.min(startRange, endRange);
  return `${startRange}-${endRange}`;
};

const isFilePartSane = (part) => {
  if (!utils.checkIfFileExists(`${metainfo.fileName}.${part}`)) {
    return false;
  }
  const stats = fs.statSync(`${metainfo.fileName}.${part}`);
  if (part === metainfo.partCount && stats.size === metainfo.contentLength % config.chunkSizeInBytes) {
    return true;
  }
  if (part !== metainfo.partCount && stats.size === Math.min(metainfo.contentLength, config.chunkSizeInBytes)) {
    return true;
  }
  return false;
};

const getContentLength = (res) => {
  if (res && res.header && res.header["content-length"]) {
    metainfo.contentLength = parseInt(res.header["content-length"]);
    MetaHelper.updateFileMeta(metainfo);
    return true;
  }
  return false;
};

const checkAcceptRanges = (res) => {
  if (res && res.header) {
    if (res.header["accept-ranges"] && res.header["accept-ranges"] === "bytes") {
      metainfo.acceptsRanges = constants.acceptRangesEnum.yes;
      MetaHelper.updateFileMeta(metainfo);
      return true;
    } else if (res.header["accept-ranges"] && res.header["accept-ranges"] === "none") {
      metainfo.acceptsRanges = constants.acceptRangesEnum.no;
    } else {
      metainfo.acceptsRanges = constants.acceptRangesEnum.maybe;
    }
  }
  MetaHelper.updateFileMeta(metainfo);
  return false;
};

const getFileNameFromContent = (res) => {
  if (res.header["content-disposition"]) {
    let contentDisposition = res.header["content-disposition"];
    contentDisposition = contentDisposition
      .split(";")
      .map((value) => value.trim())
      .filter((value) => value.indexOf("filename") === 0);
    if (contentDisposition.length) {
      metainfo.finalFilename = contentDisposition[0].split("=")[1].replace(/['"]+/g, "");
      MetaHelper.updateFileMeta(metainfo);
      return true;
    }
  }
  return false;
};

const calculateDeadlineTimeout = () => {
  const minimumDownloadSpeedInKbps = 50;
  const scaleFactor = 1.5;
  if (metainfo.contentLength <= 0) {
    return config.maxDownloadTimeInMs;
  }

  if (metainfo.partCount === 1) {
    return Math.ceil((metainfo.contentLength * scaleFactor) / (minimumDownloadSpeedInKbps * 1024)) * 1000;
  }

  return Math.ceil((config.chunkSizeInBytes * scaleFactor) / (minimumDownloadSpeedInKbps * 1024)) * 1000;
};

const downloadPart = (url, part = 0) => {
  if (part > metainfo.partCount) {
    downloadCompleteCallback(metainfo.partCount);
    return;
  }

  if (!metainfo.partStatus[part]) {
    metainfo.partStatus[part] = {};
  }
  metainfo.partStatus[part].status = constants.partStatusEnum.starting;
  metainfo.partStatus[part].attempt = metainfo.partStatus[part].attempt ? metainfo.partStatus[part].attempt + 1 : 1;
  downloadsInProgress = downloadsInProgress + 1;

  let request = superagent.get(url).timeout({
    deadline: calculateDeadlineTimeout(),
  });

  // Add all headers
  Object.keys(constants.headers).forEach((headerKey) => {
    request = request.set(headerKey, constants.headers[headerKey]);
  });

  if (metainfo.contentLength !== -1) {
    request.set("Range", `bytes=${getBytesRange(part)}`);
  }

  request = request.on("error", (err) => {
    if (err) {
      console.log(err);
    }
  });

  request = request.on("end", () => {
    if (isFilePartSane(part)) {
      metainfo.partStatus[part].status = constants.partStatusEnum.completed;
    } else {
      metainfo.partStatus[part].status = constants.partStatusEnum.failed;
    }
    downloadCompleteCallback(part);
  });

  request = request.on("abort", () => {
    metainfo.partStatus[part].status = constants.partStatusEnum.failed;
    downloadCompleteCallback(part);
  });

  request = request.on("response", (resp) => {
    if (resp.status === 200 && checkAcceptRanges(resp)) {
      getContentLength(resp);
      getFileNameFromContent(resp);
      metainfo.partCount = Math.max(Math.ceil(metainfo.contentLength / config.chunkSizeInBytes), 1);
      MetaHelper.updateFileMeta(metainfo);
      request.abort();
      return;
    }
    if (resp.status === 200 || resp.status === 206) {
      let responseContentLength = parseInt(resp.header["content-length"], 10);
      if (
        metainfo.partCount !== 1 &&
        part === metainfo.partCount &&
        responseContentLength !== Math.max(metainfo.contentLength, config.chunkSizeInBytes) % config.chunkSizeInBytes
      ) {
        throw new Error("PANIC");
        process.exit(1);
      }
      if (
        metainfo.partCount !== 1 &&
        part !== metainfo.partCount &&
        responseContentLength !== Math.min(metainfo.contentLength, config.chunkSizeInBytes)
      ) {
        throw new Error("PANIC");
        process.exit(1);
      }
      metainfo.partStatus[part].status = constants.partStatusEnum.running;
      MetaHelper.updateFileMeta(metainfo);
    } else {
      request.abort();
    }
  });

  const stream = fs.createWriteStream(`${metainfo.fileName}.${part}`);
  request.pipe(stream);
};

const isPartialRequestSupported = (url) => {
  const newPromise = new Promise(function (resolve, reject) {
    let request = superagent.head(url);
    // Add all headers
    Object.keys(constants.headers).forEach((headerKey) => {
      request = request.set(headerKey, constants.headers[headerKey]);
    });

    request
      .then((res) => {
        getContentLength(res);
        checkAcceptRanges(res);
        getFileNameFromContent(res);
        resolve();
      })
      .catch((err) => {
        if (err && err.response && err.response.status === 404) {
          console.error("404, please refresh the link");
          reject(err);
        }
        if (err && err.response && err.response.error && err.response.error.message) {
          console.error(err.response.error.message);
        } else if (err && err.message) {
          console.error(err.message);
        } else {
          console.error(err);
        }
        metainfo.acceptsRanges = constants.acceptRangesEnum.maybe;
        resolve();
      });
  });
  return newPromise;
};

const verifyAndMerge = () => {
  let part;
  for (part = 1; part <= metainfo.partCount; ++part) {
    if (!metainfo.partStatus[part]) {
      return false;
    }
    if (metainfo.partStatus[part].status !== constants.partStatusEnum.completed) {
      return false;
    }
    if (!isFilePartSane(part)) {
      return false;
    }
  }
  console.log("Verified all parts, joining them.");

  if (utils.checkIfFileExists(`${metainfo.finalFilename}`)) {
    fs.unlinkSync(`${metainfo.finalFilename}`);
  }

  const verifyMergedFile = () => {
    const stats = fs.statSync(`${metainfo.finalFilename}`);
    if (stats.size !== metainfo.contentLength) {
      throw new Error("Failed to merge file.");
    }

    for (let part = 1; part <= metainfo.partCount; ++part) {
      try {
        fs.unlinkSync(`${metainfo.fileName}.${part}`);
      } catch (err) {
        console.error(err);
      }
    }
    fs.unlinkSync(`${metainfo.fileName}.meta`);
    metainfo.downloadCompled = true;
    MetaHelper.updateFileMeta(metainfo);
    console.log("Download successfully");
  };

  const joinPart = (part = 1) => {
    if (part > metainfo.partCount) {
      verifyMergedFile();
      return;
    }
    // console.log("Joining", part);
    try {
      pipeline(
        fs.createReadStream(`${metainfo.fileName}.${part}`),
        fs.createWriteStream(`${metainfo.finalFilename}`, { flags: "a" }),
        (err) => {
          if (err) {
            console.error(err);
          } else {
            joinPart(part + 1);
          }
        }
      );
    } catch (err) {
      console.log(err);
    }
  };

  joinPart();
};

const logUStatement = (statement) => {
  readline.clearLine(process.stdout);
  readline.cursorTo(process.stdout, 0);
  process.stdout.write(statement);
};

const getNextPart = () => {
  let part;
  for (part = 1; part <= metainfo.partCount; ++part) {
    if (!metainfo.partStatus[part]) {
      return part;
    }
    if (metainfo.partStatus[part].status === constants.partStatusEnum.failed) {
      return part;
    }
  }
  return -1;
};

const downloadCompleteCallback = () => {
  downloadsInProgress = downloadsInProgress - 1;
  MetaHelper.updateFileMeta(metainfo);
  let nextPart = getNextPart();
  while (downloadsInProgress < config.maxParallelDownloads && nextPart !== -1) {
    if (nextPart === -1) {
      break;
    }
    if (
      metainfo.partStatus[nextPart] &&
      metainfo.partStatus[nextPart].attempt &&
      metainfo.partStatus[nextPart].attempt >= config.maxRetries
    ) {
      console.error(`Failed to download part ${nextPart} after multiple attempts.`);
    }
    downloadPart(metainfo.currentUrl, nextPart);
    nextPart = getNextPart();
  }
  verifyAndMerge();
};

const RebuildCurrentStatus = () => {
  let part;
  for (part = 1; part <= metainfo.partCount; ++part) {
    try {
      fs.accessSync(`${metainfo.fileName}.${part}`);
      if (isFilePartSane(part)) {
        metainfo.partStatus[part] = {
          status: constants.partStatusEnum.completed,
        };
      } else {
        fs.unlinkSync(`${metainfo.fileName}.${part}`);
        delete metainfo.partStatus[part];
      }
    } catch (err) {
      break;
    }
  }
  MetaHelper.updateFileMeta(metainfo);
  console.log("Rebuilt current status.");
};

const startDownload = () => {
  RebuildCurrentStatus();

  console.log("Starting download");

  const speedCalculator = SpeedHelper.getDownloadSpeedCalculator(metainfo);
  const progressCalculator = SpeedHelper.progressCalculator(metainfo);
  const updateInfo = setInterval(() => {
    currentDownloadSpeed = speedCalculator();
    currentProgress = progressCalculator();
    logUStatement(`${currentProgress} % (${utils.convertSpeed(currentDownloadSpeed)})`);

    if (currentProgress === 100) {
      clearInterval(updateInfo);
    }
  }, config.downloadSpeedRefreshRateInMs);

  let nextPart = -1;

  if (metainfo.acceptsRanges === constants.acceptRangesEnum.no) {
    downloadPart(metainfo.currentUrl, 1);
    return;
  }

  while (downloadsInProgress < config.maxParallelDownloads) {
    nextPart = getNextPart();
    if (nextPart === -1 || nextPart > metainfo.partCount) {
      break;
    }
    downloadPart(metainfo.currentUrl, nextPart);
  }

  if (nextPart === -1) {
    verifyAndMerge();
  }
};

const checkPartialRequest = () => {
  isPartialRequestSupported(metainfo.currentUrl)
    .then(() => {
      metainfo.isHeadAssessed = true;
      metainfo.partCount = Math.max(Math.ceil(metainfo.contentLength / config.chunkSizeInBytes), 1);
      if (metainfo.finalFilename === "") {
        metainfo.finalFilename = utils.generateFilenameFromUrl(metainfo.currentUrl);
      }
      MetaHelper.updateFileMeta(metainfo);
      startDownload();
    })
    .catch((err) => {
      if (err && err.response && err.response.status === 302) {
        checkPartialRequest();
        return;
      }
      if (err && err.response && err.response.status === 403) {
        startDownload();
        return;
      }
      console.log("Download failed");
      process.exit(1);
    });
};

const downloader = (argv) => {
  const link = argv.link;
  const name = argv.name;
  process.chdir(argv.path);

  metainfo = MetaHelper.generateOrReadMetaFile(link, name);
  if (metainfo.downloadCompleted) {
    console.log("Download completed");
    return;
  }

  if (!metainfo.isHeadAssessed) {
    checkPartialRequest();
  } else {
    startDownload();
  }
};

module.exports = downloader;
