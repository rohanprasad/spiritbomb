const fs = require("fs");

const config = require("./config");
const constants = require("./constants");

const progressCalculator = (fileMeta) => {
  return () => {
    let partDone = 0;
    for (let part = 1; part <= fileMeta.partCount; ++part) {
      if (fileMeta.partStatus[part] && fileMeta.partStatus[part].status === constants.partStatusEnum.completed) {
        partDone += 1;
      }
    }
    return Math.floor((partDone * 100) / fileMeta.partCount);
  };
};

const getDownloadSpeedCalculator = (fileMeta) => {
  let currentFileSizeSum = 0;

  return () => {
    let totalSize = 0;
    let currentDownloadSpeed = 0;
    for (let part = 1; part <= fileMeta.partCount; ++part) {
      if (fileMeta.partStatus[part] && fileMeta.partStatus[part].status === constants.partStatusEnum.completed) {
        totalSize +=
          part === fileMeta.partCount ? fileMeta.contentLength % config.chunkSizeInBytes : config.chunkSizeInBytes;
        continue;
      }
      if (!fileMeta.partStatus[part]) {
        continue;
      }
      try {
        let stats = fs.statSync(`${fileMeta.fileName}.${part}`);
        totalSize += stats.size;
      } catch (err) {
        console.error(err);
      }
    }
    currentDownloadSpeed = (totalSize - currentFileSizeSum) * (1000 / config.downloadSpeedRefreshRateInMs);
    currentFileSizeSum = totalSize;
    return currentDownloadSpeed;
  };
};

module.exports = {
  progressCalculator,
  getDownloadSpeedCalculator,
};
