// Parcelwise core: what a courier will really charge you to send a parcel, and
// whether your box is costing you money. No DOM in here, so the same file runs
// in the page and under `node --test`.
//
// The trap a plain "it only weighs a kilo" guess misses: couriers bill on the
// GREATER of the actual weight and the "volumetric" (dimensional) weight, which
// is worked out from the box size: length x width x height divided by a fixed
// number the courier sets. A light thing in a big box is billed as if it were
// heavy, so you pay for the empty space, the "air". The standard divisor is
// 5000 for centimetres and kilograms (DHL, UPS and FedEx international), 6000
// for some express and air freight, and 139 for inches and pounds in the US
// (166 on older/USPS rates). Parcelwise works out the volumetric weight, which
// weight you'll be billed on, how much air you're paying for, the length-plus-
// girth that triggers an oversize surcharge, and the smaller box that would stop
// you overpaying. Confirm the divisor with your own courier; it can vary.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Parcelwise = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var IN = 2.54;      // cm per inch
  var LB = 0.45359237; // kg per pound

  // A "basis" is a courier's way of charging: which units it measures in and the
  // divisor it uses. The divisor's units are cm^3 per kg (metric) or in^3 per lb
  // (imperial), so dividing the box volume by it gives a weight.
  var BASES = {
    "intl-5000": { label: "Standard (DHL / UPS / FedEx), cm & kg", system: "metric", divisor: 5000 },
    "express-6000": { label: "Express / air freight, cm & kg", system: "metric", divisor: 6000 },
    "us-139": { label: "US domestic (UPS / FedEx), in & lb", system: "imperial", divisor: 139 },
    "usps-166": { label: "USPS / older rates, in & lb", system: "imperial", divisor: 166 }
  };

  // Each courier rounds the billed weight up to the next step: usually half a
  // kilo on metric services, a whole pound on US ones. This is a common default,
  // not a rule for every service, so the page shows it as guidance.
  function stepFor(system) { return system === "imperial" ? 1 : 0.5; }

  function num(v) {
    var n = typeof v === "number" ? v : parseFloat(String(v == null ? "" : v).replace(",", "."));
    return isFinite(n) ? n : NaN;
  }

  // Length into the basis unit (cm for metric, in for imperial).
  function toLen(value, unit, system) {
    var n = num(value);
    if (!isFinite(n)) return NaN;
    var cm = unit === "in" ? n * IN : unit === "mm" ? n / 10 : unit === "m" ? n * 100 : n; // default cm
    return system === "imperial" ? cm / IN : cm;
  }

  // Weight into the basis unit (kg for metric, lb for imperial).
  function toWeight(value, unit, system) {
    var n = num(value);
    if (!isFinite(n)) return NaN;
    var kg = unit === "lb" ? n * LB : unit === "g" ? n / 1000 : n; // default kg
    return system === "imperial" ? kg / LB : kg;
  }

  function round2(x) { return Math.round(x * 100) / 100; }
  function round1(x) { return Math.round(x * 10) / 10; }
  function roundUpTo(x, step) { return Math.ceil((x - 1e-9) / step) * step; }

  // Work out the chargeable weight and the box advice.
  //   length/width/height: { value, unit }  the box, outside measurements
  //   weight:              { value, unit }  the packed parcel's actual weight
  //   basis:               key into BASES (default intl-5000)
  //   divisor:             optional override of the basis divisor
  //   price / priceUnit:   optional, per kg or per lb, to put a cost on it
  // UK Royal Mail size formats, the cheaper-to-dearer price ladder a domestic
  // parcel drops into by its size and weight. Each is the maximum the format
  // allows: length x width x thickness in mm, and the weight in grams. A parcel
  // has to fit ALL three dimensions (in its best orientation) and be under the
  // weight to qualify. The classic trap is thickness: a 26 mm item can't post as
  // a Large Letter and jumps to the dearer Small Parcel price, where a 25 mm one
  // squeaks in. Figures from the Royal Mail size guide.
  var RM_FORMATS = [
    { key: "letter", label: "Letter", mm: [240, 165, 5], g: 100 },
    { key: "large-letter", label: "Large Letter", mm: [353, 250, 25], g: 750 },
    { key: "small-parcel", label: "Small Parcel", mm: [450, 350, 160], g: 2000 },
    { key: "medium-parcel", label: "Medium Parcel", mm: [610, 460, 460], g: 20000 }
  ];

  // Classify a box (cm) and weight (kg) into the smallest Royal Mail format it
  // fits, and, when it just misses a cheaper one, say which dimension is over
  // and by how much. Returns null for anything bigger than a Medium Parcel.
  function royalMail(Lcm, Wcm, Hcm, actualKg) {
    var mm = [Lcm * 10, Wcm * 10, Hcm * 10].sort(function (a, b) { return b - a; });
    var grams = actualKg * 1000;
    function fits(f) {
      var fm = f.mm.slice().sort(function (a, b) { return b - a; });
      return mm[0] <= fm[0] + 1e-6 && mm[1] <= fm[1] + 1e-6 && mm[2] <= fm[2] + 1e-6 && grams <= f.g + 1e-6;
    }
    var idx = -1;
    for (var i = 0; i < RM_FORMATS.length; i++) { if (fits(RM_FORMATS[i])) { idx = i; break; } }
    if (idx < 0) return { format: null, label: "Bigger than a parcel", overBy: null };

    var out = { format: RM_FORMATS[idx].key, label: RM_FORMATS[idx].label, overBy: null };
    // If a cheaper format exists, work out what keeps the parcel out of it: the
    // dimension (or the weight) that's over, and by how much. Thickness first,
    // since that's the usual culprit.
    if (idx > 0) {
      var cheaper = RM_FORMATS[idx - 1];
      var fm = cheaper.mm.slice().sort(function (a, b) { return b - a; });
      var labels = ["length", "width", "thickness"];
      var overs = [];
      for (var d = 0; d < 3; d++) {
        if (mm[d] > fm[d] + 1e-6) overs.push({ what: labels[d], byMm: round1(mm[d] - fm[d]) });
      }
      if (grams > cheaper.g + 1e-6) overs.push({ what: "weight", byG: Math.round(grams - cheaper.g) });
      out.overBy = { toFormat: cheaper.label, items: overs };
    }
    return out;
  }

  function quote(opts) {
    opts = opts || {};
    var b = BASES[opts.basis] ? opts.basis : "intl-5000";
    var basis = BASES[b];
    var system = basis.system;
    var wUnit = system === "imperial" ? "lb" : "kg";
    var dUnit = system === "imperial" ? "in" : "cm";

    var divisor = num(opts.divisor);
    if (!(divisor > 0)) divisor = basis.divisor;

    var L = toLen(opts.length && opts.length.value, opts.length && opts.length.unit, system);
    var W = toLen(opts.width && opts.width.value, opts.width && opts.width.unit, system);
    var H = toLen(opts.height && opts.height.value, opts.height && opts.height.unit, system);
    var actual = toWeight(opts.weight && opts.weight.value, opts.weight && opts.weight.unit, system);

    if (!(L > 0) || !(W > 0) || !(H > 0)) return { ok: false, reason: "bad-box" };
    if (!(actual > 0)) return { ok: false, reason: "bad-weight" };

    // Couriers measure to the next whole unit up: a 30.2 cm side is billed as
    // 31 cm (or the next whole inch), so the box you're charged for is a little
    // bigger than the one you packed, and the rounding can nudge you into the
    // next chargeable kilo. With roundDims on, the volume is worked out from the
    // rounded-up sides, which is what the courier actually bills.
    var unit = 1; // one whole cm or inch
    var roundDims = !!opts.roundDims;
    var Lb = roundDims ? Math.ceil(L - 1e-9) : L;
    var Wb = roundDims ? Math.ceil(W - 1e-9) : W;
    var Hb = roundDims ? Math.ceil(H - 1e-9) : H;
    var dimsRounded = roundDims && (Lb > L + 1e-9 || Wb > W + 1e-9 || Hb > H + 1e-9);

    var volume = Lb * Wb * Hb;            // cm^3 or in^3, on the billed sides
    var volumetric = volume / divisor;    // kg or lb
    var billable = Math.max(actual, volumetric);
    var volumetricWins = volumetric > actual + 1e-9;

    var step = stepFor(system);
    var billableRounded = roundUpTo(billable, step);

    // How much of what you pay for is empty space. "Air" is the weight you're
    // billed for over and above what the parcel actually weighs.
    var air = Math.max(0, volumetric - actual);
    var fillPercent = volumetric > 0 ? Math.round((actual / volumetric) * 100) : 100;

    // The biggest box (by volume) that wouldn't push the volumetric weight above
    // the actual weight: actual x divisor. If the current box is bigger than
    // that, you're paying for air, and dropping one dimension to this target
    // height would stop it.
    var maxFreeVolume = actual * divisor;
    var targetHeight = null;
    if (volumetricWins && L * W > 0) {
      var th = maxFreeVolume / (L * W);
      if (th > 0 && th < H) targetHeight = th;
    }

    // Length + girth. The length is the longest side; the girth wraps the other
    // two: girth = 2 x (W + H). Most couriers add an oversize surcharge past a
    // length-plus-girth threshold and refuse very large parcels outright.
    var dims = [L, W, H].sort(function (a, c) { return c - a; });
    var longest = dims[0];
    var girth = 2 * (dims[1] + dims[2]);
    var lengthPlusGirth = longest + girth;
    // Common thresholds, expressed in each system's unit.
    var overLimit = system === "imperial" ? 130 : 330;   // oversize surcharge beyond this
    var maxLimit = system === "imperial" ? 165 : 419;    // generally not accepted beyond this
    var sizeFlag = lengthPlusGirth > maxLimit ? "too-big" : lengthPlusGirth > overLimit ? "oversize" : "ok";

    var out = {
      ok: true,
      basis: b,
      basisLabel: basis.label,
      system: system,
      weightUnit: wUnit,
      lengthUnit: dUnit,
      divisor: divisor,
      step: step,
      L: round1(L), W: round1(W), H: round1(H),
      roundDims: roundDims,
      billedL: round1(Lb), billedW: round1(Wb), billedH: round1(Hb),
      dimsRounded: dimsRounded,
      volume: Math.round(volume),
      actual: round2(actual),
      volumetric: round2(volumetric),
      billable: round2(billable),
      billableRounded: round2(billableRounded),
      volumetricWins: volumetricWins,
      air: round2(air),
      fillPercent: fillPercent,
      targetHeight: targetHeight == null ? null : round1(targetHeight),
      longest: round1(longest),
      girth: round1(girth),
      lengthPlusGirth: round1(lengthPlusGirth),
      overLimit: overLimit,
      maxLimit: maxLimit,
      sizeFlag: sizeFlag,
      // Royal Mail size format, for a UK domestic parcel in cm and kg. Only
      // meaningful on the metric bases; null on the imperial (US) ones.
      ukFormat: system === "metric" ? royalMail(L, W, H, actual) : null
    };

    // Cost, if a price per billed unit is given. As well as the total, work out
    // how much of it is air: what you'd pay on the actual weight (rounded up the
    // same way) versus what the box size makes you pay, so the empty space shows
    // up as money, not just as extra kilos.
    var price = num(opts.price);
    if (isFinite(price) && price > 0) {
      var actualRounded = roundUpTo(actual, step);
      out.cost = round2(billableRounded * price);
      out.costOnActual = round2(actualRounded * price);
      out.airCost = round2(Math.max(0, out.cost - out.costOnActual));
    } else {
      out.cost = null;
      out.costOnActual = null;
      out.airCost = null;
    }

    out.advice = advise(out);
    return out;
  }

  function advise(r) {
    var u = r.weightUnit, du = r.lengthUnit;
    var tips = [];
    if (r.volumetricWins) {
      tips.push("You'll be billed on the box size, not the weight: " + r.billableRounded + " " + u +
        " (volumetric " + r.volumetric + " " + u + " beats the actual " + r.actual + " " + u + ").");
      tips.push("That's " + r.air + " " + u + " of air, so the box is only about " + r.fillPercent +
        "% as heavy as its size allows.");
      if (r.targetHeight != null) {
        tips.push("A box about " + r.targetHeight + " " + du + " tall (instead of " + r.H + ") would bring the billed weight down to the real weight. Use the smallest box the item safely fits.");
      } else {
        tips.push("A smaller or tighter box would lower the billed weight. Use the smallest one the item safely fits.");
      }
      if (r.airCost != null && r.airCost > 0) {
        tips.push("At this rate that air is costing about " + r.airCost + " a parcel on top of the " + r.costOnActual + " the real weight would cost.");
      }
    } else {
      tips.push("You'll be billed on the actual weight: " + r.billableRounded + " " + u +
        " (the box size only works out to " + r.volumetric + " " + u + ", so it isn't costing you).");
      tips.push("The box is a good fit for the weight. No air to trim.");
    }
    if (r.sizeFlag === "oversize") {
      tips.push("Heads up: length plus girth is " + r.lengthPlusGirth + " " + du + ", over the usual " +
        r.overLimit + " " + du + " oversize line, so expect a large-parcel surcharge.");
    } else if (r.sizeFlag === "too-big") {
      tips.push("Length plus girth is " + r.lengthPlusGirth + " " + du + ", past the roughly " +
        r.maxLimit + " " + du + " most couriers will take. You may need a freight service.");
    }
    if (r.ukFormat && r.ukFormat.format) {
      var rm = "UK post: this fits Royal Mail's " + r.ukFormat.label + " size.";
      if (r.ukFormat.overBy && r.ukFormat.overBy.items.length) {
        var it = r.ukFormat.overBy.items[0];
        var by = it.byMm != null ? it.byMm + " mm" : it.byG + " g";
        rm += " It's over the cheaper " + r.ukFormat.overBy.toFormat + " only on " + it.what + ", by " + by +
          " — trimming that would drop it a price band.";
      }
      tips.push(rm);
    } else if (r.ukFormat && !r.ukFormat.format) {
      tips.push("UK post: bigger than Royal Mail's largest parcel size; a courier parcel service is the one to price.");
    }
    tips.push("Planning figures. The divisor is " + r.divisor + " here; confirm it, and whether the billed weight rounds up, with your own courier before you book.");
    return tips;
  }

  // The whole input goes in the URL fragment, which a browser never sends to a
  // server, so a shared link reopens on the same parcel without anything leaving
  // the device.
  function pack(state) {
    var json = JSON.stringify(state);
    var b64 = typeof btoa === "function" ? btoa(unescape(encodeURIComponent(json))) : Buffer.from(json, "utf8").toString("base64");
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function unpack(text) {
    try {
      var b64 = String(text).replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4) b64 += "=";
      var json = typeof atob === "function" ? decodeURIComponent(escape(atob(b64))) : Buffer.from(b64, "base64").toString("utf8");
      var o = JSON.parse(json);
      return o && typeof o === "object" ? o : null;
    } catch (e) { return null; }
  }

  return {
    IN: IN, LB: LB, BASES: BASES, stepFor: stepFor, RM_FORMATS: RM_FORMATS,
    toLen: toLen, toWeight: toWeight, round1: round1, round2: round2, roundUpTo: roundUpTo,
    royalMail: royalMail, quote: quote, advise: advise, pack: pack, unpack: unpack
  };
});
