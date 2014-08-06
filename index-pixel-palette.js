var options = parseQuery(window.location.search);
var cvs = document.createElement('canvas');
var ctx = cvs.getContext('2d');
document.body.appendChild(cvs);

var SOURCE_PATH = options.source || 'mona.png';
var PALETTE = options.palette
  ? options.palette[0] == '[' && JSON.parse(options.palette)
  : predefinedPalettes(options.palette);
var ASYNC = options.async === 'false'
  ? false
  : true;
var INVERSE_PALETTE = options.inverse === 'true'
  ? true
  : false;

getData(SOURCE_PATH, cvs, ctx, function(err, source) {

  // a.k.a. the number of target pixels
  var clusterCount = PALETTE.length / 4;
  var means = generateKInitialPixelMeans(clusterCount, source);
  var clusters = allocateClusters(clusterCount, source.data.length / 4);

  // Create initial clusters by finding distance to initial means.
  forEachPixel(source.data, function(r, g, b, a, dindex) {
    var target = clusterIndexForPixel(means, source.data, dindex);
    clusters[target].push(dindex);
  })

  var convergeCount = 0;
  console.time && console.time('convergence');

  if (ASYNC) {

    (function next() {
      setTimeout(function() {
        convergeCount += 1;
        if(converge(means, clusters, source.data) > 0) {
          next();
        } else {
          finish();
        }
      }, 0)
    }());

  } else {
    var moved = 1;

    while (moved > 0) {
      convergeCount += 1;
      moved = converge(means, clusters, source.data);
    }

    finish();
  }

  function finish() {
    console.log('converged in', convergeCount);

    applyPalette(PALETTE, clusters, source.data, INVERSE_PALETTE);
    draw(source, ctx);

    console.timeEnd && console.timeEnd('convergence');
  }

})

function converge(means, clusters, sourceData) {
  updateMeansFromClusters(means, clusters, sourceData);
  return updateClusters(means, clusters, sourceData);
}

// palette is an array of pixel ints
// source is source imgdata
// clusters are an array of Int8Array(pixelcount) that contain indices into pixel data
function applyPalette(palette, clusters, sourceData, opt_reverse) {

  if (opt_reverse) {
    var half = palette.length / 2;
    var end = palette.length - 1 - 3;
    for (var i = 0; i < half; i += 4) {
      var r = palette[end - i + 0];
      palette[end - i + 0] = palette[i + 0]
      palette[i + 0] = r;

      var g = palette[end - i + 1];
      palette[end - i + 1] = palette[i + 1]
      palette[i + 1] = g;

      var b = palette[end - i + 2];
      palette[end - i + 2] = palette[i + 2]
      palette[i + 2] = b;
    }
  }

  for (var i = 0; i < clusters.length; i++) {
    var cluster = clusters[i];
    for (var j = 0; j < cluster.length(); j++) {
      var p = cluster.get(j);
      sourceData[p+0] = palette[i*4+0];
      sourceData[p+1] = palette[i*4+1];
      sourceData[p+2] = palette[i*4+2];
    }
  }

}

// means are an array of pixel integers
// clusters are an array of Int8Array(pixelcount) that contain indices into pixel data
function updateMeansFromClusters(means, clusters, sourceData) {

  clusters.forEach(function(cluster, meanIdx) {
    var r = 0, g = 0, b = 0;

    for (var i = 0; i < cluster.length(); i++) {
      var sourceIdx = cluster.get(i);
      r += sourceData[sourceIdx+0];
      g += sourceData[sourceIdx+1];
      b += sourceData[sourceIdx+2];
    }

    // cluster length of 0 means NaN.
    var meanR = Math.floor(r / cluster.length()) || 0;
    var meanG = Math.floor(g / cluster.length()) || 0;
    var meanB = Math.floor(b / cluster.length()) || 0;

    means[meanIdx*4+0] = meanR;
    means[meanIdx*4+1] = meanG;
    means[meanIdx*4+2] = meanB;
  });

  return means;
}

// means are an array of pixel integers
// clusters are an array of Int8Array(pixelcount) that contain indices into pixel data
function updateClusters(means, clusters, sourceData) {
  var movementCount = 0;
  for (var i = 0; i < clusters.length; i++) {
    var cluster = clusters[i];
    for (var j = 0; j < cluster.length(); j++) {
      var didx = cluster.get(j);

      var targetClusterIndex = clusterIndexForPixel(means, sourceData, didx);

      if (targetClusterIndex != i) {
        clusterMoveIndexTo(cluster, clusters[targetClusterIndex], j);
        movementCount += 1;
      }
    }
  }

  return movementCount;
}

function clusterIndexForPixel(means, sourceData, dataIdx) {
  var min = Number.MAX_VALUE;
  var target = -1;
  for (var i = 0; i < means.length; i += 4) {
    var dist = rgbDist2(
      means[i+0],
      means[i+1],
      means[i+2],

      sourceData[dataIdx+0],
      sourceData[dataIdx+1],
      sourceData[dataIdx+2]
    )

    if (dist < min) {
      min = dist;
      target = i;
    }
  }

  return target / 4;
}

function clusterMoveIndexTo(src, dst, index) {
  dst.push(src.get(index));
  src.remove(index);
}

function allocateClusters(numClusters, maxEntries) {
  var clusters = [];
  for (var i = 0; i < numClusters; i++) {
    clusters.push(new AllocatedArray(maxEntries));
  }
  return clusters;
}

function AllocatedArray(maxLength, opt_type) {
  this._length = 0;
  this.data = new (opt_type || Uint32Array)(maxLength);
}

AllocatedArray.prototype.push = function(value) {
  this.data[this._length] = value;
  this._length += 1;
}

AllocatedArray.prototype.length = function() {
  return this._length;
}

AllocatedArray.prototype.remove = function(index) {
  var value = this.data[index];
  this.data[index] = this.data[this._length-1];
  this._length -= 1;
  return value;
}

AllocatedArray.prototype.get = function(index) {
  return this.data[index];
}

function rgbDist(r1, g1, b1, r2, g2, b2) {
  var r = r1 - r2;
  var g = g1 - g2;
  var b = b1 - b2;

  return Math.sqrt(r*r + g*g + b*b);
}

function rgbDist2(r1, g1, b1, r2, g2, b2) {
  var r = r1 - r2;
  var g = g1 - g2;
  var b = b1 - b2;

  return r*r + g*g + b*b;
}

function generateKInitialPixelMeans(k, source) {

  var allR = 0, allG = 0, allB = 0;

  forEachPixel(source.data, function(r, g, b) {
    allR += r;
    allG += g;
    allB += b;
  });

  var length = source.data.length / 4;
  var meanR = Math.floor(allR / length);
  var meanG = Math.floor(allG / length);
  var meanB = Math.floor(allB / length);

  var halfMeanR = Math.floor(meanR / 2);
  var halfMeanG = Math.floor(meanG / 2);
  var halfMeanB = Math.floor(meanB / 2);

  var halfHalfMeanR = Math.floor(meanR / 2 / 2);
  var halfHalfMeanG = Math.floor(meanG / 2 / 2);
  var halfHalfMeanB = Math.floor(meanB / 2 / 2);

  var max = 255;
  var mean075R = Math.floor(meanR + ((max - meanR) / 2));
  var mean075G = Math.floor(meanG + ((max - meanG) / 2));
  var mean075B = Math.floor(meanB + ((max - meanB) / 2));

  // If this is the full spectrum of the red channel:
  // 0                                                                          255
  // |---------------------------------------------------------------------------|
  // And meanR = 175
  // 0          halfHalfMean halfMeanR        meanR           mean075R          255
  // |---------------------------------------------------------------------------|

  return [
    halfHalfMeanR, halfHalfMeanG, halfHalfMeanB, 1,
    halfMeanR, halfMeanG, halfMeanB, 1,
    meanR, meanG, meanB, 1,
    mean075R, mean075G, mean075B, 1
  ];
}

function predefinedPalettes(opt_name) {
  var predefined = {
    gameboy: [
      0, 60, 16, 1,
      6, 103, 49, 1,
      123, 180, 0, 1,
      138, 196, 0, 1
    ]
  };

  return predefined[opt_name] || predefined.gameboy;
}

function forEachPixel(data, cb) {
  for (var i = 0; i < data.length; i += 4) {
    cb(data[i], data[i+1], data[i+2], data[i+3], i, i / 4, data);
  }
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

