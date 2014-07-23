var options = parseQuery(window.location.search);
var cvs = document.createElement('canvas');
var ctx = cvs.getContext('2d');
document.body.appendChild(cvs);

var ITERATIONS_PER_DRAW = options.iterations || 10000;
var SOURCE_PATH = options.source || 'mona.png';
var PALETTE_PATH = options.palette || 'goth.png';
var SAMPLE_ALGO = samplings(options.sample || 'random');
var COMPARISON_ALGO = comparisons(options.comparison || 'luminance-distance');

getData(SOURCE_PATH, cvs, ctx, function(err, source) {
  getData(PALETTE_PATH, cvs, ctx, function(err, palette) {

    cvs.width = palette.width;
    cvs.height = palette.height;

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
  types['luminance-distance'] = function(palette, source, indices) {
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

  return types[type];
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
