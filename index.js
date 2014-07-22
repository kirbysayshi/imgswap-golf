var cvs = document.createElement('canvas');
var ctx = cvs.getContext('2d');
document.body.appendChild(cvs);

getData('goth.png', cvs, ctx, function(err, source) {
  getData('mona.png', cvs, ctx, function(err, palette) {

    cvs.width = palette.width;
    cvs.height = palette.height;

    (function animate() {
      swap(palette, source) && draw(palette, ctx)
      requestAnimationFrame(animate)
    }())
  })
})


function swap(palette, source) {
  var max = (palette.data.length / 4) - 1;
  var p1 = Math.floor(Math.random() * max);
  var p2 = Math.floor(Math.random() * max);
  if (p1 === p2) return;

  var pdata = palette.data;
  var sdata = source.data;

  var r1 = Math.abs(pdata[p1+0] - sdata[p1+0]);
  var g1 = Math.abs(pdata[p1+1] - sdata[p1+1]);
  var b1 = Math.abs(pdata[p1+2] - sdata[p1+2]);
  var a1 = Math.abs(pdata[p1+3] - sdata[p1+4]);

  var r2 = Math.abs(pdata[p2+0] - sdata[p1+0]);
  var g2 = Math.abs(pdata[p2+1] - sdata[p1+1]);
  var b2 = Math.abs(pdata[p2+2] - sdata[p1+2]);
  var a2 = Math.abs(pdata[p2+3] - sdata[p1+4]);

  if (r2 < r1 && g2 < g1 && b2 < b1) {
    pdata[p1+0] = pdata[p2+0];
    pdata[p1+1] = pdata[p2+1];
    pdata[p1+2] = pdata[p2+2];
    pdata[p1+3] = pdata[p2+3];
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
