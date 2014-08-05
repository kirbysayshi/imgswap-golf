var options = parseQuery(window.location.search);
var cvs = document.createElement('canvas');
var ctx = cvs.getContext('2d');
document.body.appendChild(cvs);

var SOURCE_PATH = options.source || 'mona.png';
var PALETTE = options.palette
  ? options.palette[0] == '[' && JSON.parse(options.palette)
  : predefinedPalettes(options.palette);

getData(SOURCE_PATH, cvs, ctx, function(err, source) {

  // a.k.a. the number of target pixels
  var clusterCount = PALETTE.length / 4;
  var means = generateKInitialPixelMeans(clusterCount, source);
  var clusters = allocateClusters(clusterCount, source.data.length / 4);

  // Create initial clusters by finding distance to initial means.
  forEachPixel(source.data, function(r, g, b, a, dindex) {
    var min = Number.MAX_VALUE;
    var target = -1;
    forEachPixel(means, function(mr, mg, mb, ma, _, pindex) {
      var dist = rgbDist2(r, g, b, mr, mg, mb);
      if (dist < min) {
        min = dist;
        target = pindex;
      }
    })

    clusterPush(clusters[target], dindex);
  })

  console.log('means', JSON.stringify(means));
  console.log('clusters', clusters);

  var convergeCount = 0;

  console.time('convergence');
  (function converge() {
    setTimeout(function() {
      convergeCount += 1;
      console.time('means');
      updateMeansFromClusters(means, clusters, source.data);
      console.timeEnd('means');
      console.log('means', JSON.stringify(means));
      console.time('clusters');
      var moved = updateClusters(means, clusters, source.data);
      console.timeEnd('clusters');
      console.log('pixels moved', moved);
      //console.log('clusters', clusters);
      if (moved > 0) converge();
      else {
        console.log('means', JSON.stringify(means));
        console.log('clusters', clusters)
        console.log('converged in', convergeCount);
        applyPalette(PALETTE, clusters, source.data);
        draw(source, ctx);
        console.timeEnd('convergence');
      }
    }, 0)
  }())
})

// palette is an array of pixel ints
// source is source imgdata
// clusters are an array(palette/4) of arrays of pixel uint8array views that are
// viewing the original pixel data.
function applyPalette(palette, clusters, sourceData) {
  for (var i = 0; i < clusters.length; i++) {
    var cluster = clusters[i];
    for (var j = 0; j < cluster._occupiedLength; j++) {
      var p = cluster[j];
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

    for (var i = 0; i < cluster._occupiedLength; i++) {
      var sourceIdx = cluster[i];
      r += sourceData[sourceIdx+0];
      g += sourceData[sourceIdx+1];
      b += sourceData[sourceIdx+2];
    }

    // cluster length of 0 means NaN.
    var meanR = Math.floor(r / cluster._occupiedLength) || 0;
    var meanG = Math.floor(g / cluster._occupiedLength) || 0;
    var meanB = Math.floor(b / cluster._occupiedLength) || 0;

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
    for (var j = 0; j < cluster._occupiedLength; j++) {
      var didx = cluster[j];

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

function clusterPush(cluster, value) {
  if (cluster._occupiedLength == cluster.length) {
    throw new Error('Out of cluster memory');
  }

  cluster[cluster._occupiedLength] = value;
  cluster._occupiedLength += 1;

  return cluster._occupiedLength;
}

function clusterMoveIndexTo(src, dst, index) {
  clusterPush(dst, src[index]);
  src[index] = src[src._occupiedLength-1];
  src._occupiedLength -= 1;
}

function allocateClusters(numClusters, maxEntries) {
  var clusters = [];
  for (var i = 0; i < numClusters; i++) {
    var cluster = new Uint32Array(maxEntries);
    cluster._occupiedLength = 0;
    clusters.push(cluster);
  }
  return clusters;
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

