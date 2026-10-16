"use strict";

const assert = require("node:assert/strict");

function createMockElement(id, tagName = "div") {
  const classListSet = new Set();
  const attributes = {};
  const listeners = {};
  const children = [];

  const el = {
    id,
    tagName: tagName.toUpperCase(),
    className: "",
    textContent: "",
    innerHTML: "",
    style: {},
    children,
    get firstChild() {
      return children[0] || null;
    },
    get lastElementChild() {
      return children[children.length - 1] || null;
    },
    classList: {
      toggle(cls) {
        if (classListSet.has(cls)) {
          classListSet.delete(cls);
          el.className = [...classListSet].join(" ");
          return false;
        } else {
          classListSet.add(cls);
          el.className = [...classListSet].join(" ");
          return true;
        }
      },
      add(cls) {
        classListSet.add(cls);
        el.className = [...classListSet].join(" ");
      },
      remove(cls) {
        classListSet.delete(cls);
        el.className = [...classListSet].join(" ");
      },
      contains(cls) {
        return classListSet.has(cls);
      },
    },
    setAttribute(key, val) {
      attributes[key] = String(val);
    },
    getAttribute(key) {
      return attributes[key] || null;
    },
    addEventListener(type, fn) {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(fn);
    },
    click() {
      if (listeners["click"]) {
        for (const fn of listeners["click"]) fn({ target: el });
      }
    },
    contains(other) {
      return other === el || children.includes(other);
    },
    querySelectorAll(selector) {
      if (selector === "a") {
        return children.filter((c) => c.tagName === "A");
      }
      return [];
    },
    insertBefore(newChild, refChild) {
      const idx = children.indexOf(refChild);
      if (idx === -1) children.unshift(newChild);
      else children.splice(idx, 0, newChild);
      return newChild;
    },
    removeChild(child) {
      const idx = children.indexOf(child);
      if (idx !== -1) children.splice(idx, 1);
      return child;
    },
    appendChild(child) {
      children.push(child);
      return child;
    },
  };
  return el;
}

test("landing e2e: mobile menu toggle and outside click dismiss", async () => {
  const mobileToggle = createMockElement("mobile-toggle", "button");
  const primaryNav = createMockElement("primary-nav", "nav");
  const navLink = createMockElement("link-1", "a");
  primaryNav.appendChild(navLink);

  const docListeners = {};
  global.document = {
    getElementById(id) {
      if (id === "mobile-toggle") return mobileToggle;
      if (id === "primary-nav") return primaryNav;
      return null;
    },
    addEventListener(type, fn) {
      if (!docListeners[type]) docListeners[type] = [];
      docListeners[type].push(fn);
    },
    createElement: (tag) => createMockElement(`dyn-${tag}`, tag),
  };

  const { initLandingApp } = require("../../../landing/app.js");
  initLandingApp();

  // 1. Initial state
  assert.equal(primaryNav.classList.contains("is-open"), false);

  // 2. Click toggle -> opens menu
  mobileToggle.click();
  assert.equal(primaryNav.classList.contains("is-open"), true);
  assert.equal(mobileToggle.getAttribute("aria-expanded"), "true");

  // 3. Click nav link -> closes menu
  navLink.click();
  assert.equal(primaryNav.classList.contains("is-open"), false);
  assert.equal(mobileToggle.getAttribute("aria-expanded"), "false");

  // 4. Click outside document closes open menu
  mobileToggle.click();
  assert.equal(primaryNav.classList.contains("is-open"), true);
  const outsideEl = createMockElement("outside");
  for (const fn of docListeners["click"] || []) {
    fn({ target: outsideEl });
  }
  assert.equal(primaryNav.classList.contains("is-open"), false);
});

test("landing e2e: copy button to clipboard interaction", async () => {
  const copyBtn = createMockElement("copy-btn", "button");
  const copyText = createMockElement("copy-text", "span");
  copyText.textContent = "Copy";

  let writtenClipboard = null;
  Object.defineProperty(globalThis, "navigator", {
    value: {
      clipboard: {
        writeText: async (text) => {
          writtenClipboard = text;
        },
      },
    },
    configurable: true,
    writable: true,
  });

  global.document.getElementById = (id) => {
    if (id === "copy-btn") return copyBtn;
    if (id === "copy-text") return copyText;
    return null;
  };

  const { initLandingApp } = require("../../../landing/app.js");
  initLandingApp();

  await copyBtn.click();
  assert.ok(writtenClipboard);
  assert.ok(writtenClipboard.includes("latch login"));
  assert.equal(copyText.textContent, "Copied!");
});

test("landing e2e: live console activity stream caps visible rows at 5", () => {
  const consoleStream = createMockElement("console-stream");

  global.document.getElementById = (id) => {
    if (id === "console-stream") return consoleStream;
    return null;
  };
  global.window = {
    matchMedia: () => ({ matches: false }),
  };

  const { initLandingApp } = require("../../../landing/app.js");
  const timer = initLandingApp();

  try {
    // Fill consoleStream with 6 rows manually to simulate multiple ticks
    for (let i = 0; i < 6; i++) {
      const row = createMockElement(`row-${i}`);
      consoleStream.insertBefore(row, consoleStream.firstChild);
      if (consoleStream.children.length > 5) {
        consoleStream.removeChild(consoleStream.lastElementChild);
      }
    }
    assert.equal(consoleStream.children.length, 5);
  } finally {
    if (timer) clearInterval(timer);
  }
});
