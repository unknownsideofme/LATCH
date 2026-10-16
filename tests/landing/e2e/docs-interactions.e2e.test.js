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
    value: "",
    style: {},
    children,
    parentNode: null,
    get firstChild() {
      return children[0] || null;
    },
    classList: {
      toggle(cls, force) {
        if (force === true) {
          classListSet.add(cls);
          el.className = [...classListSet].join(" ");
          return true;
        } else if (force === false) {
          classListSet.delete(cls);
          el.className = [...classListSet].join(" ");
          return false;
        }
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
    trigger(type, eventObj = {}) {
      if (listeners[type]) {
        for (const fn of listeners[type]) fn(eventObj);
      }
    },
    appendChild(child) {
      child.parentNode = el;
      children.push(child);
      return child;
    },
    querySelector(selector) {
      if (selector === "pre") return children.find((c) => c.tagName === "PRE") || null;
      if (selector === "code") return children.find((c) => c.tagName === "CODE") || null;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === "a") return children.filter((c) => c.tagName === "A");
      return [];
    },
    focus() {
      el.isFocused = true;
    },
  };
  return el;
}

test("landing e2e: code block decoration and copy to clipboard", async () => {
  const { decorate } = require("../../../landing/docs.js");

  const block = createMockElement("code-block-1");
  block.setAttribute("data-lang", "bash");
  const pre = createMockElement("pre-1", "pre");
  const code = createMockElement("code-1", "code");
  code.textContent = "$ latch init\n$ latch serve";
  pre.appendChild(code);
  block.appendChild(pre);

  let clipboardData = null;
  Object.defineProperty(globalThis, "navigator", {
    value: {
      clipboard: {
        writeText: async (t) => {
          clipboardData = t;
        },
      },
    },
    configurable: true,
    writable: true,
  });

  global.document = {
    createElement: (tag) => createMockElement(`btn-${tag}`, tag),
  };

  decorate(block);

  // Syntax highlighting was applied to code.innerHTML
  assert.ok(code.innerHTML.includes('class="tok-prompt"'));
  assert.ok(code.innerHTML.includes('class="tok-cmd"'));

  // Copy button was appended to block
  const copyBtn = block.children.find((c) => c.className === "copy-btn");
  assert.ok(copyBtn);
  assert.equal(copyBtn.textContent, "Copy");

  // Clicking copy button strips "$ " and copies to clipboard
  await copyBtn.click();
  assert.equal(clipboardData, "latch init\nlatch serve");
  assert.equal(copyBtn.textContent, "Copied");
  assert.equal(copyBtn.classList.contains("is-done"), true);
});

test("landing e2e: docs sidebar search filtering and shortcut", () => {
  const searchInput = createMockElement("docs-search-input", "input");
  const emptyState = createMockElement("docs-nav-empty");

  const navGroup1 = createMockElement("group-1");
  navGroup1.className = "docs-nav-group";
  const link1 = createMockElement("link-1", "a");
  link1.textContent = "Getting Started";
  const link2 = createMockElement("link-2", "a");
  link2.textContent = "Configuration";
  navGroup1.appendChild(link1);
  navGroup1.appendChild(link2);

  const docListeners = {};
  global.document = {
    getElementById(id) {
      if (id === "docs-search-input") return searchInput;
      if (id === "docs-rail") return null;
      return null;
    },
    querySelector(sel) {
      if (sel === ".docs-nav-empty") return emptyState;
      if (sel === ".docs-article") return null;
      return null;
    },
    querySelectorAll(sel) {
      if (sel === ".docs-nav-group") return [navGroup1];
      if (sel === ".code-block") return [];
      return [];
    },
    addEventListener(type, fn) {
      if (!docListeners[type]) docListeners[type] = [];
      docListeners[type].push(fn);
    },
    activeElement: null,
  };
  global.window = {
    addEventListener: () => {},
    scrollY: 0,
  };

  const { ready } = require("../../../landing/docs.js");
  ready();

  // 1. Typing 'config' filters sidebar
  searchInput.value = "config";
  searchInput.trigger("input");

  assert.equal(link1.classList.contains("is-hidden"), true);
  assert.equal(link2.classList.contains("is-hidden"), false);
  assert.equal(emptyState.style.display, "none");

  // 2. Typing non-matching query reveals empty state
  searchInput.value = "nonexistent_query";
  searchInput.trigger("input");
  assert.equal(link1.classList.contains("is-hidden"), true);
  assert.equal(link2.classList.contains("is-hidden"), true);
  assert.equal(emptyState.style.display, "block");

  // 3. Pressing '/' focuses search input
  for (const fn of docListeners["keydown"] || []) {
    fn({ key: "/", preventDefault: () => {} });
  }
  assert.equal(searchInput.isFocused, true);
});
