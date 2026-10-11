// Polyfill URL.canParse for Node.js < 19.9.0
if (typeof URL !== "undefined" && !URL.canParse) {
  URL.canParse = function (url, base) {
    try {
      new URL(url, base);
      return true;
    } catch {
      return false;
    }
  };
}

try {
  const urlModule = require("url");
  if (urlModule && urlModule.URL && !urlModule.URL.canParse) {
    urlModule.URL.canParse = URL.canParse;
  }
} catch {
  // Ignore if url module cannot be required
}

// Polyfill ECMAScript 2023 Array methods for Node.js < 20
if (!Array.prototype.toReversed) {
  Array.prototype.toReversed = function () {
    return Array.from(this).reverse();
  };
}

if (!Array.prototype.toSorted) {
  Array.prototype.toSorted = function (compareFn) {
    return Array.from(this).sort(compareFn);
  };
}

if (!Array.prototype.toSpliced) {
  Array.prototype.toSpliced = function (start, deleteCount, ...items) {
    const copy = Array.from(this);
    copy.splice(start, deleteCount, ...items);
    return copy;
  };
}

if (!Array.prototype.with) {
  Array.prototype.with = function (index, value) {
    const copy = Array.from(this);
    copy[index] = value;
    return copy;
  };
}

// Polyfill Promise.withResolvers for Node.js < 22
if (!Promise.withResolvers) {
  Promise.withResolvers = function () {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}
