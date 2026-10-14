"use strict";

const { pushNotice } = require("../lib/notices");

class NoticeService {
  constructor(sse) {
    this.sse = sse;
  }

  emitNotice(input, opts) {
    const notice = pushNotice(input, opts);
    if (notice && this.sse) this.sse.emit("notice", notice);
    return notice;
  }
}

module.exports = {
  NoticeService,
};
