const userAgent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.75 Safari/537.36";

const headers = {
  "User-Agent": userAgent,
};

const acceptRangesEnum = {
  yes: "accepts-ranges",
  no: "does-no-accepts-ranges",
  maybe: "might-accept-ranges",
};

const partStatusEnum = {
  starting: "part-download-starting",
  running: "part-download-running",
  failed: "part-download-failed",
  completed: "part-download-completed",
};

module.exports = {
  headers,
  acceptRangesEnum,
  partStatusEnum,
};
