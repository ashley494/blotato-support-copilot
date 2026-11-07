import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePost } from "../src/validate.js";

const now = new Date("2026-11-06T12:00:00Z");
const errs = (b: unknown) => validatePost(b, now).filter((f) => f.severity === "error");
const paths = (b: unknown) => errs(b).map((f) => f.path);

const tweet = { post: { accountId: "98432", content: { text: "Hello, world!", mediaUrls: [], platform: "twitter" }, target: { targetType: "twitter" } } };

test("docs example tweet passes", () => {
  assert.deepEqual(validatePost(tweet, now), []);
});

test("scheduledTime nested in post is caught (would publish immediately)", () => {
  const b = { post: { ...tweet.post, scheduledTime: "2026-12-25T15:00:00Z" } };
  assert.ok(paths(b).includes("post.scheduledTime"));
  assert.match(errs(b)[0].message, /publishes the post immediately/);
});

test("root-level scheduledTime passes; both methods at once fails", () => {
  assert.deepEqual(errs({ ...tweet, scheduledTime: "2026-12-25T15:00:00Z" }), []);
  assert.ok(paths({ ...tweet, scheduledTime: "2026-12-25T15:00:00Z", useNextFreeSlot: true }).includes("$"));
});

test("scheduledTime without timezone fails, past time warns", () => {
  assert.ok(paths({ ...tweet, scheduledTime: "2026-12-25 15:00" }).includes("scheduledTime"));
  const w = validatePost({ ...tweet, scheduledTime: "2025-01-01T00:00:00Z" }, now);
  assert.equal(w[0].severity, "warning");
});

test("fields at top level instead of inside post", () => {
  assert.match(errs({ accountId: "1", content: {} })[0].message, /inside a "post" object/);
});

test("mediaUrls as string", () => {
  const b = structuredClone(tweet) as any;
  b.post.content.mediaUrls = "https://x.com/a.jpg";
  assert.ok(paths(b).includes("post.content.mediaUrls"));
});

test("Google Drive share link gets a converted URL", () => {
  const b = structuredClone(tweet) as any;
  b.post.content.mediaUrls = ["https://drive.google.com/file/d/1AbC_dEf/view?usp=sharing"];
  const e = errs(b)[0];
  assert.match(e.fix, /drive\.usercontent\.google\.com\/download\?id=1AbC_dEf/);
});

test("local file path and Dropbox dl=0", () => {
  const b = structuredClone(tweet) as any;
  b.post.content.mediaUrls = ["/Users/me/video.mp4", "https://www.dropbox.com/s/x/a.mp4?dl=0"];
  const e = errs(b);
  assert.match(e[0].fix, /media\/uploads/);
  assert.match(e[1].fix, /dl=1/);
});

test("Facebook without pageId", () => {
  const b = { post: { accountId: "98433", content: { text: "hi", mediaUrls: [], platform: "facebook" }, target: { targetType: "facebook" } } };
  assert.ok(paths(b).includes("post.target.pageId"));
});

test("TikTok docs example passes, missing booleans fail", () => {
  const ok = {
    post: {
      accountId: "98435",
      content: { text: "Tips for productivity", mediaUrls: ["https://example.com/video.mp4"], platform: "tiktok" },
      target: { targetType: "tiktok", privacyLevel: "PUBLIC_TO_EVERYONE", disabledComments: false, disabledDuet: false, disabledStitch: false, isBrandedContent: false, isYourBrand: false, isAiGenerated: true },
    },
  };
  assert.deepEqual(errs(ok), []);
  const bad = structuredClone(ok) as any;
  delete bad.post.target.isAiGenerated;
  bad.post.target.privacyLevel = "PUBLIC";
  assert.deepEqual(paths(bad).sort(), ["post.target.isAiGenerated", "post.target.privacyLevel"]);
});

test("YouTube needs title, privacyStatus, notify flag and a video", () => {
  const b = { post: { accountId: "1", content: { text: "", mediaUrls: [], platform: "youtube" }, target: { targetType: "youtube" } } };
  assert.deepEqual(paths(b).sort(), ["post.content.mediaUrls", "post.target.privacyStatus", "post.target.shouldNotifySubscribers", "post.target.title"]);
});

test("targetType mismatch and unknown platform", () => {
  const b = structuredClone(tweet) as any;
  b.post.target.targetType = "x";
  assert.ok(paths(b).includes("post.target.targetType"));
  b.post.content.platform = "x";
  assert.ok(paths(b).includes("post.content.platform"));
});

test("webhook target", () => {
  const ok = { post: { accountId: "1", content: { text: "hi", mediaUrls: [], platform: "other" }, target: { targetType: "webhook", url: "https://example.com/hook" } } };
  assert.deepEqual(errs(ok), []);
});
