import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

function statusElement() {
  const classes = new Set(["hidden"]);
  return {
    textContent: "",
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name),
    },
  };
}

function contactFixture(name) {
  const success = statusElement();
  const error = statusElement();
  const submit = { disabled: false };
  const handlers = {};
  const attributes = new Map();
  const wrapper = {
    querySelector(selector) {
      if (selector === "[data-contact-success]") return success;
      if (selector === "[data-contact-error]") return error;
      return null;
    },
  };
  const form = {
    name,
    dataset: { error: `${name} fallback error` },
    parentElement: wrapper,
    style: {},
    closest: () => wrapper,
    querySelector: (selector) =>
      selector === 'button[type="submit"]' ? submit : null,
    addEventListener: (event, handler) => {
      handlers[event] = handler;
    },
    setAttribute: (key, value) => attributes.set(key, value),
    removeAttribute: (key) => attributes.delete(key),
    reset() {},
  };
  return { form, success, error, submit, handlers, attributes };
}

test("contact forms submit and report status within their own block", async () => {
  const source = await readFile(
    new URL("../src/site-assets/forms.js", import.meta.url),
    "utf8",
  );
  const first = contactFixture("first");
  const second = contactFixture("second");
  let ready;
  let requestCount = 0;

  const document = {
    addEventListener(event, handler) {
      if (event === "DOMContentLoaded") ready = handler;
    },
    querySelectorAll(selector) {
      return selector === "[data-contact-form]"
        ? [first.form, second.form]
        : [];
    },
    getElementById() {
      return null;
    },
  };

  class FakeFormData {
    constructor(form) {
      this.form = form;
    }
    entries() {
      return [
        ["first_name", this.form.name],
        ["email", `${this.form.name}@example.com`],
        ["message", "Hello"],
      ];
    }
  }

  vm.runInNewContext(source, {
    document,
    FormData: FakeFormData,
    fetch: async () => {
      requestCount += 1;
      return requestCount === 1
        ? { ok: true }
        : { ok: false, json: async () => ({ error: "Rejected" }) };
    },
  });
  ready();

  const event = { preventDefault() {} };
  await first.handlers.submit(event);
  assert.equal(first.form.style.display, "none");
  assert.equal(first.success.classList.contains("hidden"), false);
  assert.equal(second.success.classList.contains("hidden"), true);
  assert.equal(first.submit.disabled, false);
  assert.equal(first.attributes.has("aria-busy"), false);

  await second.handlers.submit(event);
  assert.equal(second.form.style.display, undefined);
  assert.equal(second.error.textContent, "Rejected");
  assert.equal(second.error.classList.contains("hidden"), false);
  assert.equal(first.error.classList.contains("hidden"), true);
  assert.equal(second.submit.disabled, false);
  assert.equal(second.attributes.has("aria-busy"), false);
});
