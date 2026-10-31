// Boxy, the cardboard box who helps you pack. Boxy offers a tip when tapped,
// smiles when the box fits the weight, looks worried when you're paying for air
// or the parcel is oversize, and puffs a little packing confetti if you tap five
// times fast. Everything Boxy says goes through the bubble's live region, so a
// screen reader hears it too. Moods are driven by the app, never on a timer of
// its own.
(function () {
  "use strict";
  var btn = document.getElementById("boxy");
  var bubble = document.getElementById("boxy-bubble");
  var dock = document.getElementById("boxy-dock");
  var hide = document.getElementById("boxy-hide");
  if (!btn) { window.Boxy = { react: function () {}, context: function () {}, say: function () {} }; return; }

  var still = matchMedia("(prefers-reduced-motion: reduce)");
  var baseMood = "calm", tipKey = "start";
  var bubbleTimer = null, flashTimer = null, taps = [], tipAt = {};

  var TIPS = {
    start: [
      "Hi, I'm Boxy! Put in the box size and the weight and I'll tell you what you'll be charged.",
      "Couriers charge on the box size OR the weight, whichever is bigger. I work out which one you'll pay.",
      "Measure the box on the outside, including the lid."
    ],
    box: [
      "Length, width and height of the box as it'll be sealed, on the outside.",
      "A big box with a light thing inside is where people overpay. Let's check yours.",
      "Pick the basis that matches your courier: most use 5000 for cm and kg."
    ],
    weight: [
      "That's the whole parcel on the scales: item, padding and box.",
      "If the box size costs more than the weight, a smaller box saves you money.",
      "Round up a bit on the weight to be safe; couriers round up too."
    ],
    result: [
      "Use the smallest box the item safely fits. Less air, smaller bill.",
      "Fill empty space so the box can't be crushed, but don't size up for padding.",
      "Check the divisor and the rounding with your courier before you book."
    ]
  };

  function setMood(m) { btn.setAttribute("data-mood", m); }

  function say(text, ms) {
    if (dock.classList.contains("tucked")) return;
    bubble.textContent = text;
    bubble.classList.remove("pop"); void bubble.offsetWidth; bubble.classList.add("pop");
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(function () { bubble.textContent = ""; }, ms || 7000);
  }

  function flash(m, ms) {
    setMood(m);
    clearTimeout(flashTimer);
    flashTimer = setTimeout(function () { setMood(baseMood); }, ms || 1500);
  }

  function tip() {
    var list = TIPS[tipKey] || TIPS.start;
    var i = tipAt[tipKey] || 0;
    say(list[i % list.length]);
    tipAt[tipKey] = i + 1;
  }

  function puff() {
    if (still.matches) return;
    var rect = btn.getBoundingClientRect();
    for (var i = 0; i < 7; i++) {
      (function (n) {
        var s = document.createElement("span");
        s.className = "puff";
        s.style.left = (rect.left + 26) + "px";
        s.style.top = (rect.top + 22) + "px";
        s.style.setProperty("--dx", (Math.random() * 150 - 75) + "px");
        s.style.setProperty("--dy", (-40 - Math.random() * 90) + "px");
        s.style.setProperty("--dr", (Math.random() * 500 - 250) + "deg");
        s.style.animationDelay = (n * 0.05) + "s";
        document.body.appendChild(s);
        setTimeout(function () { s.remove(); }, 1200);
      })(i);
    }
  }

  btn.addEventListener("click", function () {
    var now = Date.now();
    taps = taps.filter(function (t) { return now - t < 900; });
    taps.push(now);
    if (taps.length >= 5) { taps = []; puff(); say("Taped and ready! Right, where were we?"); flash("happy"); return; }
    tip();
    flash("think", 900);
  });

  hide.addEventListener("click", function () {
    var tucked = dock.classList.toggle("tucked");
    hide.textContent = tucked ? "" : "tuck away";
    if (!tucked) { say("Back! Tap me any time for a tip."); }
  });

  // Eyes track the pointer a little, so Boxy feels awake. Cheap, eyes only.
  if (!still.matches) {
    document.addEventListener("pointermove", function (e) {
      var r = btn.getBoundingClientRect();
      var dx = Math.max(-2, Math.min(2, (e.clientX - (r.left + r.width / 2)) / 60));
      var face = btn.querySelector(".boxy-face");
      if (face) face.style.transform = "translateX(" + dx + "px)";
    }, { passive: true });
  }

  // Public hooks the page calls.
  window.Boxy = {
    // Where the user is, so the next tip fits: "box", "weight".
    context: function (key) { tipKey = TIPS[key] ? key : "start"; baseMood = "calm"; setMood(baseMood); },
    // React to a result: "tidy" (actual weight wins), "air" (paying for air),
    // "big" (oversize), "bad".
    react: function (kind) {
      tipKey = "result";
      if (kind === "tidy") { flash("happy"); say("Nice fit. You're billed on the real weight, not the box."); }
      else if (kind === "air") { flash("warn"); say("You're paying for air here. A smaller box would drop the bill."); }
      else if (kind === "big") { flash("warn"); say("This one's over the size line, so watch for an oversize surcharge."); }
      else if (kind === "bad") { flash("think"); say("I couldn't read those. Check the sizes and the weight?"); }
    },
    say: say
  };

  setTimeout(function () { if (!dock.classList.contains("tucked")) say(TIPS.start[0]); }, 900);
})();
