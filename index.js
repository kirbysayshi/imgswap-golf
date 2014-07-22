var cvs = document.createElement('canvas');
var ctx = cvs.getContext('2d');
document.body.appendChild(cvs);

var ITERATIONS_PER_DRAW = 200;
var L = [0.2126, 0.7152, 0.0722];

getData('mona.png', cvs, ctx, function(err, source) {
  getData('goth.png', cvs, ctx, function(err, palette) {

    cvs.width = palette.width;
    cvs.height = palette.height;

    (function animate() {
      for(var i = 0; i < ITERATIONS_PER_DRAW; i++) {
        swap(palette, source);
      }
      draw(palette, ctx)
      requestAnimationFrame(animate)
    }())
  })
})


function swap(palette, source) {
  var max = (palette.data.length / 4) - 1;
  var p1 = Math.floor(Math.random() * max);
  var p2 = Math.floor(Math.random() * max);

  var pdata = palette.data;
  var sdata = source.data;

  var p1l = L[0]*pdata[4*p1+0] + L[1]*pdata[4*p1+1] + L[2]*pdata[4*p1+2];
  var p2l = L[0]*pdata[4*p2+0] + L[1]*pdata[4*p2+1] + L[2]*pdata[4*p2+2];
  var sl =  L[0]*sdata[4*p1+0] + L[1]*sdata[4*p1+1] + L[2]*sdata[4*p1+2];

  var p1dist = Math.abs(sl - p1l);
  var p2dist = Math.abs(sl - p2l);

  if (p2dist < p1dist) {
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
    return true;
  }

  return false;
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
