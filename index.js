var options = parseQuery(window.location.search);
var cvs = document.createElement('canvas');
var ctx = cvs.getContext('2d');
document.body.appendChild(cvs);

var ITERATIONS_PER_DRAW = options.iterations || 10000;
var SOURCE_PATH = options.source || 'mona.png';
var PALETTE_PATH = options.palette || 'goth.png';
var SAMPLE_ALGO = samplings(options.sample || 'random');
var COMPARISON_ALGO = comparisons(options.comparison || 'relative-srgb-luminance-difference');

getData(SOURCE_PATH, cvs, ctx, function(err, source) {
  getData(PALETTE_PATH, cvs, ctx, function(err, palette) {

    // Make the palette data match the dimensions of the source.
    var corrected = ctx.createImageData(source.width, source.height);
    corrected.data.set(palette.data);
    palette = corrected;

    cvs.width = source.width;
    cvs.height = source.height;

    var indices = [];

    (function animate() {
      for(var i = 0; i < ITERATIONS_PER_DRAW; i++) {
        COMPARISON_ALGO(palette, source, indices);
      }
      draw(palette, ctx)
      requestAnimationFrame(animate)
    }())
  })
})

function comparisons(type) {

  var types = {};

  var L = [0.2126, 0.7152, 0.0722];
  types['relative-srgb-luminance-difference'] = function(palette, source, indices) {
    indices = SAMPLE_ALGO(palette, source, indices);
    var p1 = indices[0];
    var p2 = indices[1];

    var pdata = palette.data;
    var sdata = source.data;

    var p1l = L[0]*pdata[4*p1+0] + L[1]*pdata[4*p1+1] + L[2]*pdata[4*p1+2];
    var p2l = L[0]*pdata[4*p2+0] + L[1]*pdata[4*p2+1] + L[2]*pdata[4*p2+2];
    var sl =  L[0]*sdata[4*p1+0] + L[1]*sdata[4*p1+1] + L[2]*sdata[4*p1+2];

    var p1dist = Math.abs(sl - p1l);
    var p2dist = Math.abs(sl - p2l);

    if (p2dist < p1dist) {
      swapPixels(pdata, p1, p2);
    }
  }

  types['weighted-euclidean-distance-rgb'] = function(palette, source, indices) {
    indices = SAMPLE_ALGO(palette, source, indices);

    var p1 = indices[0];
    var p2 = indices[1];

    var pdata = palette.data;
    var sdata = source.data;

    var p1r = pdata[4*p1+0]
    var p1g = pdata[4*p1+1]
    var p1b = pdata[4*p1+2]

    var p2r = pdata[4*p2+0]
    var p2g = pdata[4*p2+1]
    var p2b = pdata[4*p2+2]

    var s1r = sdata[4*p1+0]
    var s1g = sdata[4*p1+1]
    var s1b = sdata[4*p1+2]

    // http://robots.thoughtbot.com/closer-look-color-lightness
    // https://citational.com/v/615

    var pl1 = Math.sqrt(p1r*p1r*0.299 + p1g*p1g*0.587 + p1b*p1b*0.114)
    var pl2 = Math.sqrt(p2r*p2r*0.299 + p2g*p2g*0.587 + p2b*p2b*0.114)
    var sl1 = Math.sqrt(s1r*s1r*0.299 + s1g*s1g*0.587 + s1b*s1b*0.114)

    var p1dist = Math.abs(sl1 - pl1);
    var p2dist = Math.abs(sl1 - pl2);

    if (p2dist < p1dist) {
      swapPixels(pdata, p1, p2);
    }
  }

  types['hsl-distance'] = function(palette, source, indices) {
    indices = SAMPLE_ALGO(palette, source, indices);

    var p1 = indices[0];
    var p2 = indices[1];

    var pdata = palette.data;
    var sdata = source.data;

    var p1r = pdata[4*p1+0]
    var p1g = pdata[4*p1+1]
    var p1b = pdata[4*p1+2]

    var p2r = pdata[4*p2+0]
    var p2g = pdata[4*p2+1]
    var p2b = pdata[4*p2+2]

    var s1r = sdata[4*p1+0]
    var s1g = sdata[4*p1+1]
    var s1b = sdata[4*p1+2]

    var p1hsl = rgbToHsl(p1r, p1g, p1b, indices);
    var p1h = p1hsl[0];
    var p1s = p1hsl[1];
    var p1l = p1hsl[2];

    var p2hsl = rgbToHsl(p2r, p2g, p2b, indices);
    var p2h = p2hsl[0];
    var p2s = p2hsl[1];
    var p2l = p2hsl[2];

    var s1hsl = rgbToHsl(s1r, s1g, s1b, indices);
    var s1h = s1hsl[0];
    var s1s = s1hsl[1];
    var s1l = s1hsl[2];

    var h1 = Math.min(1+p1h-s1h, Math.abs(p1h-s1h));
    var h2 = Math.min(1+p2h-s1h, Math.abs(p2h-s1h));

    var p1dist = Math.sqrt( h1*h1 + (p1s-s1s)*(p1s-s1s) + (p1l-s1l)*(p1l-s1l) )
    var p2dist = Math.sqrt( h2*h2 + (p2s-s1s)*(p2s-s1s) + (p2l-s1l)*(p2l-s1l) )

    if (p2dist < p1dist) {
      swapPixels(pdata, p1, p2);
    }
  }


  types['colour-distance'] = function(palette, source, indices) {
    indices = SAMPLE_ALGO(palette, source, indices);

    var p1 = indices[0];
    var p2 = indices[1];

    var pdata = palette.data;
    var sdata = source.data;

    var p1r = L[0]*pdata[4*p1+0]
    var p1g = L[1]*pdata[4*p1+1]
    var p1b = L[2]*pdata[4*p1+2]

    var p2r = L[0]*pdata[4*p2+0]
    var p2g = L[1]*pdata[4*p2+1]
    var p2b = L[2]*pdata[4*p2+2]

    var s1r = L[0]*sdata[4*p1+0]
    var s1g = L[1]*sdata[4*p1+1]
    var s1b = L[2]*sdata[4*p1+2]

    var p1dist = colourDistance(p1r, p1g, p1b, s1r, s1g, s1b);
    var p2dist = colourDistance(p2r, p2g, p2b, s1r, s1g, s1b);

    if (p2dist < p1dist) {
      swapPixels(pdata, p1, p2);
    }
  }

  // http://www.compuphase.com/cmetric.htm
  function colourDistance(r1, g1, b1, r2, g2, b2) {
    var rmean = (r1+ r2) / 2;
    var r = r1 - r2;
    var g = g1 - g2;
    var b = b1 - b2;
    return Math.sqrt((((512 + rmean) * r * r) >> 8) + 4*g*g + (((767-rmean)*b*b)>>8));
  }

  types['hsl-distance-only-if-better'] = function(palette, source, indices) {
    indices = SAMPLE_ALGO(palette, source, indices);

    var p1 = indices[0];
    var p2 = indices[1];

    var pdata = palette.data;
    var sdata = source.data;

    var p1s1dist = rgbHslDist(
      pdata[4*p1+0], pdata[4*p1+1], pdata[4*p1+2],
      sdata[4*p1+0], sdata[4*p1+1], sdata[4*p1+2],
      indices
    )

    var p2s2dist = rgbHslDist(
      pdata[4*p2+0], pdata[4*p2+1], pdata[4*p2+2],
      sdata[4*p2+0], sdata[4*p2+1], sdata[4*p2+2],
      indices
    )

    var p1s2dist = rgbHslDist(
      pdata[4*p1+0], pdata[4*p1+1], pdata[4*p1+2],
      sdata[4*p2+0], sdata[4*p2+1], sdata[4*p2+2],
      indices
    )

    var p2s1dist = rgbHslDist(
      pdata[4*p2+0], pdata[4*p2+1], pdata[4*p2+2],
      sdata[4*p1+0], sdata[4*p1+1], sdata[4*p1+2],
      indices
    )

    if (p1s1dist + p2s2dist > p1s2dist + p2s1dist) {
      swapPixels(pdata, p2, p1);
    }
  }

  types['rgb-distance-only-if-better'] = function(palette, source, indices) {
    indices = SAMPLE_ALGO(palette, source, indices);

    var p1 = indices[0];
    var p2 = indices[1];

    var pdata = palette.data;
    var sdata = source.data;

    var p1s1dist = rgbDist(
      pdata[4*p1+0], pdata[4*p1+1], pdata[4*p1+2],
      sdata[4*p1+0], sdata[4*p1+1], sdata[4*p1+2],
      indices
    )

    var p2s2dist = rgbDist(
      pdata[4*p2+0], pdata[4*p2+1], pdata[4*p2+2],
      sdata[4*p2+0], sdata[4*p2+1], sdata[4*p2+2],
      indices
    )

    var p1s2dist = rgbDist(
      pdata[4*p1+0], pdata[4*p1+1], pdata[4*p1+2],
      sdata[4*p2+0], sdata[4*p2+1], sdata[4*p2+2],
      indices
    )

    var p2s1dist = rgbDist(
      pdata[4*p2+0], pdata[4*p2+1], pdata[4*p2+2],
      sdata[4*p1+0], sdata[4*p1+1], sdata[4*p1+2],
      indices
    )

    if (p1s1dist + p2s2dist > p1s2dist + p2s1dist) {
      swapPixels(pdata, p2, p1);
    }
  }

  return types[type];
}

// http://stackoverflow.com/a/9493060/169491
function rgbToHsl(r, g, b, out) {
  r /= 255;
  g /= 255;
  b /= 255;
  var max = Math.max(r, g, b)
  var min = Math.min(r, g, b)
  var h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    var d = max - min;
    s = l > 0.5
      ? d / (2 - max - min)
      : d / (max + min);
    if (max === r) {
      h = (g - b) / d + (g < b ? 6 : 0);
    } else if (max === g) {
      h = (b - r) / d + 2;
    } else {
      h = (r - g) / d + 4;
    }
    h /= 6;
  }

  out[0] = h;
  out[1] = s;
  out[2] = l;
  return out;
}

function rgbHslDist(r1, g1, b1, r2, g2, b2, buffer) {
  var hsl1 = rgbToHsl(r1, g1, b1, buffer);
  var h1 = hsl1[0];
  var s1 = hsl1[1];
  var l1 = hsl1[2];

  var hsl2 = rgbToHsl(r2, g2, b2, buffer);
  var h2 = hsl2[0];
  var s2 = hsl2[1];
  var l2 = hsl2[2];

  var h = Math.min(1+h1-h2, Math.abs(h1-h2));
  var s = s1 - s2;
  var l = l1 - l2;

  return Math.sqrt(h*h + s*s + l*l);
}

function rgbDist(r1, g1, b1, r2, g2, b2, buffer) {
  var r = r1 - r2;
  var g = g1 - g2;
  var b = b1 - b2;

  return Math.sqrt(r*r + g*g + b*b);
}

function samplings(type) {

  var types = {};

  types['random'] = function(palette, source, out) {
    var max = (palette.data.length / 4) - 1;
    var p1 = Math.floor(Math.random() * max);
    var p2 = Math.floor(Math.random() * max);
    out[0] = p1;
    out[1] = p2;
    return out;
  }

  return types[type];
}

function swapPixels(pdata, p1, p2) {
  var r = pdata[4*p1+0];
  var g = pdata[4*p1+1];
  var b = pdata[4*p1+2];
  var a = pdata[4*p1+3];

  pdata[4*p1+0] = pdata[4*p2+0];
  pdata[4*p1+1] = pdata[4*p2+1];
  pdata[4*p1+2] = pdata[4*p2+2];
  pdata[4*p1+3] = pdata[4*p2+3];

  pdata[4*p2+0] = r;
  pdata[4*p2+1] = g;
  pdata[4*p2+2] = b;
  pdata[4*p2+3] = a;

  return pdata;
}

function draw(palette, ctx) {
  ctx.putImageData(palette, 0, 0);
}

function getData(src, cvs, ctx, cb) {
  var img = new Image()
  img.addEventListener('load', handle.bind(null, cb));
  img.src = src;

  function handle(cb) {
    cvs.width = img.width;
    cvs.height = img.height;
    ctx.drawImage(img, 0, 0);
    cb(null, ctx.getImageData(0, 0, img.width, img.height))
  }
}

function parseQuery(qs, defaults) {
  return qs.substring(1).split('&').reduce(function(all, pair) {
    var parts = pair.split('=');
    all[parts[0]] = parts[1];
    return all;
  }, {})
}
