"use strict";
var test = require("node:test");
var assert = require("node:assert");
var P = require("../src/core.js");

// A small, light parcel in a right-sized box: billed on actual weight.
test("actual weight wins for a tight box", function () {
  var r = P.quote({
    length: { value: 20, unit: "cm" }, width: { value: 15, unit: "cm" }, height: { value: 10, unit: "cm" },
    weight: { value: 2, unit: "kg" }, basis: "intl-5000"
  });
  assert.strictEqual(r.ok, true);
  // volume 3000 cm^3 / 5000 = 0.6 kg volumetric, under the 2 kg actual
  assert.strictEqual(r.volumetric, 0.6);
  assert.strictEqual(r.volumetricWins, false);
  assert.strictEqual(r.billable, 2);
  assert.strictEqual(r.billableRounded, 2);
  assert.strictEqual(r.air, 0);
});

// A light thing in a big box: billed on the box size, the classic trap.
test("volumetric weight wins for a big light box", function () {
  var r = P.quote({
    length: { value: 60, unit: "cm" }, width: { value: 50, unit: "cm" }, height: { value: 40, unit: "cm" },
    weight: { value: 3, unit: "kg" }, basis: "intl-5000"
  });
  // volume 120000 / 5000 = 24 kg volumetric
  assert.strictEqual(r.volumetric, 24);
  assert.strictEqual(r.volumetricWins, true);
  assert.strictEqual(r.billable, 24);
  assert.strictEqual(r.air, 21);
  assert.strictEqual(r.fillPercent, 13); // 3/24 = 12.5% -> 13
});

// FedEx's own worked example: 36 x 25 x 16 cm at divisor 5000 = 2.88 -> ~3 kg.
test("matches the FedEx cm example at divisor 5000", function () {
  var r = P.quote({
    length: { value: 36, unit: "cm" }, width: { value: 25, unit: "cm" }, height: { value: 16, unit: "cm" },
    weight: { value: 1, unit: "kg" }, basis: "intl-5000"
  });
  assert.strictEqual(r.volumetric, 2.88);
  assert.strictEqual(r.billableRounded, 3); // rounds up to the next 0.5 kg: 2.88 -> 3.0
});

// Express divisor 6000 gives a lighter volumetric weight than 5000.
test("express divisor 6000 lowers the volumetric weight", function () {
  var base = { length: { value: 60, unit: "cm" }, width: { value: 50, unit: "cm" }, height: { value: 40, unit: "cm" }, weight: { value: 3, unit: "kg" } };
  var five = P.quote(Object.assign({ basis: "intl-5000" }, base));
  var six = P.quote(Object.assign({ basis: "express-6000" }, base));
  assert.strictEqual(five.volumetric, 24);
  assert.strictEqual(six.volumetric, 20); // 120000 / 6000
});

// US imperial basis: inches and pounds, divisor 139.
test("US imperial basis uses inches, pounds and divisor 139", function () {
  var r = P.quote({
    length: { value: 24, unit: "in" }, width: { value: 18, unit: "in" }, height: { value: 12, unit: "in" },
    weight: { value: 10, unit: "lb" }, basis: "us-139"
  });
  assert.strictEqual(r.weightUnit, "lb");
  assert.strictEqual(r.lengthUnit, "in");
  // 24*18*12 = 5184 / 139 = 37.29 lb
  assert.strictEqual(r.volumetric, 37.29);
  assert.strictEqual(r.volumetricWins, true);
  assert.strictEqual(r.billableRounded, 38); // next whole pound
});

// Units convert into the basis system: a box given in inches on a metric basis.
test("input units convert into the basis system", function () {
  var cm = P.quote({ length: { value: 50, unit: "cm" }, width: { value: 40, unit: "cm" }, height: { value: 30, unit: "cm" }, weight: { value: 5, unit: "kg" }, basis: "intl-5000" });
  var inches = P.quote({ length: { value: 50 / 2.54, unit: "in" }, width: { value: 40 / 2.54, unit: "in" }, height: { value: 30 / 2.54, unit: "in" }, weight: { value: 5, unit: "kg" }, basis: "intl-5000" });
  assert.strictEqual(cm.volumetric, inches.volumetric);
});

// The target height brings the volumetric weight back down to the actual weight.
test("suggests a smaller height that removes the air", function () {
  var r = P.quote({
    length: { value: 60, unit: "cm" }, width: { value: 50, unit: "cm" }, height: { value: 40, unit: "cm" },
    weight: { value: 3, unit: "kg" }, basis: "intl-5000"
  });
  // maxFreeVolume = 3 * 5000 = 15000; /(60*50)=5 cm
  assert.strictEqual(r.targetHeight, 5);
  // a box of that height would make volumetric == actual
  var fixed = P.quote({ length: { value: 60, unit: "cm" }, width: { value: 50, unit: "cm" }, height: { value: 5, unit: "cm" }, weight: { value: 3, unit: "kg" }, basis: "intl-5000" });
  assert.strictEqual(fixed.volumetric, 3);
  assert.strictEqual(fixed.volumetricWins, false);
});

// No target height when the box already fits the weight.
test("no target height when actual weight already wins", function () {
  var r = P.quote({ length: { value: 20, unit: "cm" }, width: { value: 15, unit: "cm" }, height: { value: 10, unit: "cm" }, weight: { value: 5, unit: "kg" }, basis: "intl-5000" });
  assert.strictEqual(r.targetHeight, null);
});

// Length + girth and the oversize flag.
test("length plus girth flags an oversize parcel", function () {
  var r = P.quote({
    length: { value: 150, unit: "cm" }, width: { value: 50, unit: "cm" }, height: { value: 50, unit: "cm" },
    weight: { value: 20, unit: "kg" }, basis: "intl-5000"
  });
  // longest 150, girth 2*(50+50)=200, L+girth = 350
  assert.strictEqual(r.longest, 150);
  assert.strictEqual(r.girth, 200);
  assert.strictEqual(r.lengthPlusGirth, 350);
  assert.strictEqual(r.sizeFlag, "oversize"); // > 330, <= 419
});

test("a normal parcel is not flagged oversize", function () {
  var r = P.quote({ length: { value: 40, unit: "cm" }, width: { value: 30, unit: "cm" }, height: { value: 20, unit: "cm" }, weight: { value: 4, unit: "kg" }, basis: "intl-5000" });
  assert.strictEqual(r.sizeFlag, "ok");
});

// A huge parcel past what couriers accept.
test("flags a parcel too big for a parcel courier", function () {
  var r = P.quote({ length: { value: 220, unit: "cm" }, width: { value: 70, unit: "cm" }, height: { value: 70, unit: "cm" }, weight: { value: 30, unit: "kg" }, basis: "intl-5000" });
  // 220 + 2*(70+70) = 500 > 419
  assert.strictEqual(r.sizeFlag, "too-big");
});

// A custom divisor overrides the basis default (a negotiated rate).
test("a custom divisor overrides the basis default", function () {
  var r = P.quote({ length: { value: 60, unit: "cm" }, width: { value: 50, unit: "cm" }, height: { value: 40, unit: "cm" }, weight: { value: 3, unit: "kg" }, basis: "intl-5000", divisor: 5500 });
  assert.strictEqual(r.divisor, 5500);
  assert.strictEqual(r.volumetric, 21.82); // 120000/5500
});

// Optional price costs the billed (rounded) weight.
test("price costs the rounded billed weight", function () {
  var r = P.quote({ length: { value: 36, unit: "cm" }, width: { value: 25, unit: "cm" }, height: { value: 16, unit: "cm" }, weight: { value: 1, unit: "kg" }, basis: "intl-5000", price: 4, priceUnit: "kg" });
  // billableRounded 3 kg * 4 = 12
  assert.strictEqual(r.cost, 12);
});

// Bad inputs are refused, not guessed.
test("refuses a missing or zero dimension", function () {
  assert.strictEqual(P.quote({ length: { value: 0, unit: "cm" }, width: { value: 10, unit: "cm" }, height: { value: 10, unit: "cm" }, weight: { value: 1, unit: "kg" } }).reason, "bad-box");
  assert.strictEqual(P.quote({ length: { value: 10, unit: "cm" }, width: { value: 10, unit: "cm" }, height: { value: 10, unit: "cm" }, weight: { value: 0, unit: "kg" } }).reason, "bad-weight");
});

// The share link round-trips the parcel.
test("pack and unpack round-trip the state", function () {
  var state = { l: "60", w: "50", h: "40", wt: "3", basis: "intl-5000" };
  assert.deepStrictEqual(P.unpack(P.pack(state)), state);
  assert.strictEqual(P.unpack("not valid base64 @@@"), null);
});
