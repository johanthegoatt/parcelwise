// Parcelwise page glue: read the form, run the engine in core.js, draw the
// quote, keep the share link in sync, and tell Boxy what's going on. All the
// real work lives in core.js so it can be tested without a browser.
(function () {
  "use strict";
  var P = window.Parcelwise;
  var $ = function (id) { return document.getElementById(id); };

  var ids = ["len", "wid", "hei", "dim-unit", "wt", "wt-unit", "basis", "divisor", "price", "round-dims"];
  var el = {};
  ids.forEach(function (id) { el[id] = $(id); });
  var out = $("out");

  function readState() {
    return {
      l: el.len.value.trim(), w: el.wid.value.trim(), h: el.hei.value.trim(), du: el["dim-unit"].value,
      wt: el.wt.value.trim(), wu: el["wt-unit"].value,
      b: el.basis.value, dv: el.divisor.value.trim(), p: el.price.value.trim(),
      rd: el["round-dims"].checked ? 1 : 0
    };
  }

  function writeState(s) {
    if (!s) return;
    if (s.l != null) el.len.value = s.l;
    if (s.w != null) el.wid.value = s.w;
    if (s.h != null) el.hei.value = s.h;
    if (s.du) el["dim-unit"].value = s.du;
    if (s.wt != null) el.wt.value = s.wt;
    if (s.wu) el["wt-unit"].value = s.wu;
    if (s.b) el.basis.value = s.b;
    if (s.dv != null) el.divisor.value = s.dv;
    if (s.p != null) el.price.value = s.p;
    if (s.rd != null) el["round-dims"].checked = !!s.rd;
  }

  function cell(k, v, u, big) {
    return '<div class="cell' + (big ? " big" : "") + '"><span class="k">' + k + '</span><span class="v">' + v +
      (u ? '<span class="u"> ' + u + '</span>' : "") + '</span></div>';
  }

  function render(r) {
    if (!r || !r.ok) {
      var msg = r && r.reason === "bad-weight" ? "Enter the parcel's weight."
        : r && r.reason === "bad-box" ? "Enter the box length, width and height."
        : "Fill in the box size and the weight to start.";
      out.innerHTML = '<div class="result bad"><h3>Nothing to weigh up yet</h3><p class="msg">' + msg + '</p></div>';
      return "bad";
    }

    var u = r.weightUnit, du = r.lengthUnit;
    var wins = r.volumetricWins;
    var pill = wins
      ? '<span class="tagpill warn">billed on the box size</span>'
      : '<span class="tagpill good">billed on the weight</span>';

    var grid =
      cell("You pay for", r.billableRounded, u, true) +
      cell("Actual", r.actual, u) +
      cell("By size", r.volumetric, u) +
      (r.cost != null ? cell("Cost", r.cost, "") : "") +
      (r.airCost != null && r.airCost > 0 ? cell("Of that, air", r.airCost, "") : "");

    var fillClass = r.fillPercent >= 100 ? "fill-bar full" : "fill-bar";
    var fillWidth = Math.max(4, Math.min(100, r.fillPercent));
    var fillBlock =
      '<div class="fill">' +
        '<div class="fill-track"><div class="' + fillClass + '" style="width:' + fillWidth + '%"></div></div>' +
        '<p class="fill-label">' + (wins
          ? "The box is about " + r.fillPercent + "% as heavy as its size allows. The rest, " + r.air + " " + u + ", is air you're billed for."
          : "The weight fills the box's size allowance. No air you're paying for.") +
        '</p>' +
      '</div>';

    var size = "";
    if (r.sizeFlag === "oversize") {
      size = '<div class="opt"><div class="opt-h">Size check <span class="tagpill warn">oversize</span></div>' +
        '<p class="opt-sub">Length plus girth is ' + r.lengthPlusGirth + ' ' + du + ', over the usual ' + r.overLimit +
        ' ' + du + ' line. Expect a large-parcel surcharge.</p></div>';
    } else if (r.sizeFlag === "too-big") {
      size = '<div class="opt"><div class="opt-h">Size check <span class="tagpill warn">too big</span></div>' +
        '<p class="opt-sub">Length plus girth is ' + r.lengthPlusGirth + ' ' + du + ', past the roughly ' + r.maxLimit +
        ' ' + du + ' most couriers accept. You may need a freight service.</p></div>';
    } else {
      size = '<div class="opt"><div class="opt-h">Size check <span class="tagpill good">within limits</span></div>' +
        '<p class="opt-sub">Length plus girth is ' + r.lengthPlusGirth + ' ' + du + ', under the usual ' + r.overLimit +
        ' ' + du + ' oversize line.</p></div>';
    }

    var advice = '<ul class="advice">' + r.advice.map(function (a) { return "<li>" + a + "</li>"; }).join("") + "</ul>";

    out.innerHTML =
      '<div class="result">' +
        '<h3>' + r.basisLabel + ' · divisor ' + r.divisor + '</h3>' +
        '<div class="opt pick">' +
          '<div class="opt-h">Chargeable weight ' + pill + '</div>' +
          '<div class="grid">' + grid + '</div>' +
          fillBlock +
        '</div>' +
      '</div>' +
      '<div class="result"><h3>Box &amp; limits</h3>' + size +
        (r.dimsRounded ? '<p class="opt-sub">Billed as ' + r.billedL + ' &times; ' + r.billedW + ' &times; ' + r.billedH + ' ' + r.lengthUnit +
          ': the courier rounds each side up to the next whole ' + r.lengthUnit + ', so you pay on a slightly bigger box than you measured.</p>' : "") +
      '</div>' +
      '<div class="result"><h3>What to do</h3>' + advice + '</div>';

    if (r.sizeFlag !== "ok") return "big";
    return wins ? "air" : "tidy";
  }

  function recompute() {
    var s = readState();
    var r = P.quote({
      length: { value: s.l, unit: s.du }, width: { value: s.w, unit: s.du }, height: { value: s.h, unit: s.du },
      weight: { value: s.wt, unit: s.wu },
      basis: s.b, divisor: s.dv === "" ? undefined : parseFloat(s.dv),
      roundDims: !!s.rd,
      price: s.p, priceUnit: s.wu
    });
    var kind = render(r);
    if (window.Boxy && r.ok) window.Boxy.react(kind);
    syncLink(s);
  }

  var linkState = "";
  function syncLink(s) {
    linkState = P.pack(s);
    try { history.replaceState(null, "", "#" + linkState); } catch (e) { /* ignore */ }
  }

  $("share").addEventListener("click", function () {
    var url = location.origin + location.pathname + "#" + linkState;
    var done = $("share-done");
    function ok() { done.textContent = "Link copied"; setTimeout(function () { done.textContent = ""; }, 2500); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(ok, function () { done.textContent = url; });
    else { done.textContent = url; }
  });

  // When the basis changes, show its divisor as a placeholder and set the
  // dimension and weight units to the system that basis measures in, but never
  // overwrite a divisor the user has typed in.
  function onBasis() {
    var b = P.BASES[el.basis.value] || P.BASES["intl-5000"];
    el.divisor.placeholder = String(b.divisor);
    if (b.system === "imperial") {
      el["dim-unit"].value = "in"; el["wt-unit"].value = "lb";
    } else {
      if (el["dim-unit"].value === "in") el["dim-unit"].value = "cm";
      if (el["wt-unit"].value === "lb") el["wt-unit"].value = "kg";
    }
  }

  // Tips follow where the eye is.
  ["len", "wid", "hei", "dim-unit", "basis", "divisor", "round-dims"].forEach(function (id) {
    el[id].addEventListener("focus", function () { if (window.Boxy) window.Boxy.context("box"); });
  });
  ["wt", "wt-unit", "price"].forEach(function (id) {
    el[id].addEventListener("focus", function () { if (window.Boxy) window.Boxy.context("weight"); });
  });

  el.basis.addEventListener("change", function () { onBasis(); recompute(); });

  ids.forEach(function (id) {
    el[id].addEventListener("input", recompute);
    el[id].addEventListener("change", recompute);
  });

  // Open on a shared link if there is one, otherwise a sensible starting point.
  var frag = location.hash.replace(/^#/, "");
  var initial = frag ? P.unpack(frag) : null;
  if (initial) { writeState(initial); }
  onBasis();
  recompute();
})();
