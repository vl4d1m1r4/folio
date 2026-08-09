import assert from "node:assert/strict";
import test from "node:test";

import { videoAspectRatio, videoEmbedUrl } from "../lib/video.js";

test("normalizes supported YouTube URLs to privacy-enhanced embeds", () => {
  assert.equal(
    videoEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
  );
  assert.equal(
    videoEmbedUrl("youtu.be/dQw4w9WgXcQ?t=20"),
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
  );
  assert.equal(
    videoEmbedUrl("https://youtube.com/shorts/dQw4w9WgXcQ"),
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
  );
});

test("normalizes Vimeo URLs", () => {
  assert.equal(
    videoEmbedUrl("https://vimeo.com/76979871"),
    "https://player.vimeo.com/video/76979871",
  );
  assert.equal(
    videoEmbedUrl("https://player.vimeo.com/video/76979871"),
    "https://player.vimeo.com/video/76979871",
  );
  assert.equal(
    videoEmbedUrl("https://vimeo.com/76979871/abc123"),
    "https://player.vimeo.com/video/76979871?h=abc123",
  );
  assert.equal(
    videoEmbedUrl("https://player.vimeo.com/video/76979871?h=abc123"),
    "https://player.vimeo.com/video/76979871?h=abc123",
  );
});

test("adds autoplay and control options", () => {
  assert.equal(
    videoEmbedUrl("https://youtu.be/dQw4w9WgXcQ", true, false),
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&mute=1&controls=0",
  );
  assert.equal(
    videoEmbedUrl("https://vimeo.com/76979871", true, false),
    "https://player.vimeo.com/video/76979871?autoplay=1&muted=1&controls=0",
  );
});

test("rejects unsupported or malformed URLs", () => {
  assert.equal(videoEmbedUrl("https://example.com/watch?v=dQw4w9WgXcQ"), "");
  assert.equal(videoEmbedUrl("javascript:alert(1)"), "");
  assert.equal(videoEmbedUrl("https://vimeo.com/not-a-video"), "");
  assert.equal(videoEmbedUrl(""), "");
});

test("allows only known aspect ratios", () => {
  assert.equal(videoAspectRatio("9 / 16"), "9 / 16");
  assert.equal(videoAspectRatio("1); color: red"), "16 / 9");
});
