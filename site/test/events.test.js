import assert from "node:assert/strict";
import test from "node:test";

import {
  eventField,
  eventDetailUrl,
  formatEventDateRange,
  generatedEventPath,
  safeEventUrl,
} from "../lib/events.js";

test("eventField uses resolved translations and falls back to item text", () => {
  const item = { id: "one", title: "Fallback title" };
  assert.equal(
    eventField({ event_one_title: "Translated title" }, item, "title"),
    "Translated title",
  );
  assert.equal(eventField({}, item, "title"), "Fallback title");
  assert.equal(eventField({}, item, "description"), "");
});

test("generated event paths use an explicit slug or a title fallback", () => {
  const config = { event_one_title: "Community Meetup" };
  assert.equal(
    generatedEventPath(config, { id: "one", slug: "spring-meetup" }, "de"),
    "/de/events/spring-meetup/",
  );
  assert.equal(
    generatedEventPath(config, { id: "one" }, "en"),
    "/en/events/community-meetup/",
  );
});

test("eventDetailUrl defaults to generated pages and supports explicit URLs", () => {
  const config = {
    event_one_title: "Community Meetup",
    event_one_detailUrl: "https://example.com/register",
  };
  assert.equal(
    eventDetailUrl(config, { id: "one" }, "en"),
    "/en/events/community-meetup/",
  );
  assert.equal(
    eventDetailUrl(config, { id: "one", detailMode: "external" }, "en"),
    "https://example.com/register",
  );
});

test("formatEventDateRange handles dates, times, ranges, and bad locales", () => {
  assert.match(formatEventDateRange("2027-03-15", "", "en"), /Mar 15, 2027/);
  assert.match(
    formatEventDateRange(
      "2027-03-15T18:00",
      "2027-03-15T20:00",
      "en",
    ),
    /Mar 15, 2027/,
  );
  assert.match(
    formatEventDateRange("2027-03-15", "", "not_a_locale"),
    /Mar 15, 2027/,
  );
  assert.equal(formatEventDateRange("not-a-date", "", "en"), "not-a-date");
});

test("safeEventUrl allows web and relative links only", () => {
  assert.equal(safeEventUrl("/events/example/"), "/events/example/");
  assert.equal(safeEventUrl("#details"), "#details");
  assert.equal(
    safeEventUrl("https://example.com/events/1"),
    "https://example.com/events/1",
  );
  assert.equal(safeEventUrl("javascript:alert(1)"), "");
  assert.equal(safeEventUrl("data:text/html,unsafe"), "");
});
