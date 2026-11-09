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

// Royal Mail UK size formats: classify by size and weight, and name the
// dimension that keeps a parcel out of the cheaper band (the thickness trap).
test("a thin item posts as a Large Letter, a fraction thicker is a Small Parcel", function () {
  // 30 x 20 x 2.5 cm, 300 g: within Large Letter (353x250x25 mm, 750 g).
  var ll = P.royalMail(30, 20, 2.5, 0.3);
  assert.strictEqual(ll.format, "large-letter");
  // bump the thickness to 2.6 cm (26 mm): over the 25 mm Large Letter limit.
  var sp = P.royalMail(30, 20, 2.6, 0.3);
  assert.strictEqual(sp.format, "small-parcel");
  assert.strictEqual(sp.overBy.toFormat, "Large Letter");
  assert.strictEqual(sp.overBy.items[0].what, "thickness");
  assert.ok(sp.overBy.items[0].byMm >= 0.9 && sp.overBy.items[0].byMm <= 1.1);
});

test("orientation doesn't matter: the smallest fitting format is found", function () {
  // same box entered thickness-first still classifies as Large Letter.
  var a = P.royalMail(2.5, 20, 30, 0.3);
  assert.strictEqual(a.format, "large-letter");
});

test("weight alone can push a small box up a band", function () {
  // tiny box but 900 g: too heavy for Large Letter (750 g), so Small Parcel.
  var r = P.royalMail(20, 15, 2, 0.9);
  assert.strictEqual(r.format, "small-parcel");
  assert.ok(r.overBy.items.some(function (i) { return i.what === "weight"; }));
});

test("a big box is past every parcel format", function () {
  var r = P.royalMail(80, 50, 50, 25);
  assert.strictEqual(r.format, null);
});

test("ukFormat is on the metric quote and absent on the imperial one", function () {
  var m = P.quote({ length: { value: 30, unit: "cm" }, width: { value: 20, unit: "cm" }, height: { value: 2.5, unit: "cm" }, weight: { value: 0.3, unit: "kg" }, basis: "intl-5000" });
  assert.ok(m.ukFormat && m.ukFormat.format === "large-letter");
  var i = P.quote({ length: { value: 12, unit: "in" }, width: { value: 8, unit: "in" }, height: { value: 1, unit: "in" }, weight: { value: 1, unit: "lb" }, basis: "us-139" });
  assert.strictEqual(i.ukFormat, null);
});

test("rounding dims up bills a bigger box, as the courier measures", () => {
  const base = { basis: "intl-5000", length: { value: 30.2, unit: "cm" }, width: { value: 20.4, unit: "cm" }, height: { value: 10.6, unit: "cm" }, weight: { value: 1, unit: "kg" } };
  const off = P.quote(Object.assign({}, base, { roundDims: false }));
  const on = P.quote(Object.assign({}, base, { roundDims: true }));
  assert.ok(off.ok && on.ok);
  // 31 x 21 x 11 > 30.2 x 20.4 x 10.6, so the billed volume and volumetric weight rise
  assert.ok(on.volume > off.volume);
  assert.ok(on.volumetric >= off.volumetric);
  assert.strictEqual(on.dimsRounded, true);
  assert.strictEqual(on.billedL, 31);
  assert.strictEqual(on.billedH, 11);
});

test("rounding a box already on whole units changes nothing", () => {
  const base = { basis: "intl-5000", length: { value: 40, unit: "cm" }, width: { value: 30, unit: "cm" }, height: { value: 20, unit: "cm" }, weight: { value: 2, unit: "kg" } };
  const on = P.quote(Object.assign({}, base, { roundDims: true }));
  assert.strictEqual(on.dimsRounded, false);
  assert.strictEqual(on.billedL, 40);
  assert.strictEqual(on.volume, 40 * 30 * 20);
});

// --- cost of the air ---

test("a light box in a big carton pays for air in money", function () {
  // 60x40x40 cm = 96000 cm3 / 5000 = 19.2 kg volumetric vs 2 kg actual
  var r = P.quote({
    length: { value: 60, unit: "cm" }, width: { value: 40, unit: "cm" }, height: { value: 40, unit: "cm" },
    weight: { value: 2, unit: "kg" }, basis: "intl-5000", price: 3
  });
  assert.ok(r.ok);
  assert.ok(r.volumetricWins);
  assert.strictEqual(r.cost, r.billableRounded * 3);
  assert.ok(r.airCost > 0, "air should cost money");
  // cost on the real 2 kg (rounded to 2) is 6; the billed ~19.5 kg is far more
  assert.strictEqual(r.costOnActual, 6);
  assert.strictEqual(r.airCost, Math.round((r.cost - r.costOnActual) * 100) / 100);
});

test("a dense box pays no air cost", function () {
  var r = P.quote({
    length: { value: 20, unit: "cm" }, width: { value: 20, unit: "cm" }, height: { value: 20, unit: "cm" },
    weight: { value: 10, unit: "kg" }, basis: "intl-5000", price: 3
  });
  assert.ok(!r.volumetricWins);
  assert.strictEqual(r.airCost, 0);
});

test("no price, no cost figures", function () {
  var r = P.quote({
    length: { value: 30, unit: "cm" }, width: { value: 20, unit: "cm" }, height: { value: 10, unit: "cm" },
    weight: { value: 1, unit: "kg" }, basis: "intl-5000"
  });
  assert.strictEqual(r.cost, null);
  assert.strictEqual(r.airCost, null);
});
