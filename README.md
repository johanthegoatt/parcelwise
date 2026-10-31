# Parcelwise

**What a courier will really charge to post your parcel, and whether your box is costing you money.**

Live: [parcelwise.johanthegoat.xyz](https://parcelwise.johanthegoat.xyz)

Couriers don't bill on weight alone. A van runs out of room long before it runs out of carrying capacity, so they work out a **volumetric weight** from the box size and bill you on the **greater** of that and the real weight. Pack a light thing in a big box and you pay for the empty space, the "air". Parcelwise shows the trap and the fix.

Put in the box (length, width, height), the packed weight, and the basis your courier uses. It tells you:

- the **volumetric weight** (box volume ÷ the divisor) and the **actual weight**,
- **which one you'll be billed on**, and the chargeable weight rounded up the way couriers round,
- **how much air you're paying for** when the box wins, as a weight and a fill bar,
- the **smaller box** (a target height) that would bring the bill down to the real weight,
- the **length plus girth**, with a flag when it crosses the usual oversize-surcharge line or the size most couriers will take,
- an optional **cost**, if you type the rate per kg or lb.

Everything is worked out in your browser. Nothing you type is uploaded, and a shareable link keeps the whole parcel in the URL fragment (which the browser never sends to a server), so you can send a quote without a server ever seeing it.

## The numbers behind it

- **Volumetric weight = L × W × H ÷ divisor.** The standard divisor is **5000** for centimetres and kilograms (DHL, UPS and FedEx international), **6000** for some express and air-freight services, and **139** for inches and pounds in the US (**166** on USPS and older rates). Confirmed against [DHL](https://www.dhl.com/discover/en-sg/ship-with-dhl/start-shipping/how-to-calculate-dhl-volumetric-weight) and [FedEx](https://www.fedex.com/en-cy/how-to/calculate-costs/dimensional-weight.html), whose own cm example (36 × 25 × 16 cm ÷ 5000 ≈ 2.88 kg) the engine reproduces in the tests.
- **Billed weight = the greater of the two,** usually rounded up to the next 0.5 kg (metric) or whole pound (imperial). Rounding steps vary by service, so they're shown as guidance.
- **Length + girth = longest side + 2 × (the other two).** Most parcel couriers add an oversize surcharge past about **330 cm / 130 in** and won't take a parcel past roughly **419 cm / 165 in**; above that it's a freight service.
- High-volume shippers sometimes negotiate a higher divisor (e.g. 5500), so the divisor is editable.

These are planning figures. The exact divisor, rounding and size limits are set by each courier and service, so the tool says to confirm them before booking rather than pretending to be a live quote.

## Running it

It's a static page. Open `index.html`, or serve the folder with any static server.

```
npm test   # runs the engine tests with node --test, no dependencies
```

The engine (`src/core.js`) has no DOM in it, so the same file runs in the page and under the tests. The page glue is in `src/app.js`, and Boxy the box lives in `src/boxy.js`.

## Boxy

Boxy is the cardboard box in the corner. Tap for a tip that fits where you are on the form; Boxy smiles when the box fits the weight and looks worried when you're paying for air or the parcel's gone oversize. Tap five times fast for a surprise. Reduced-motion is respected.

## Licence

MIT. Built by Johan.
