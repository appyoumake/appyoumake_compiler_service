/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */


var fs = require('fs');
var path = require('path');
var md5File = require("md5-file");

var walk = function(dir, done) {
  var results = [];
  fs.readdir(dir, function(err, list) {
    if (err) return done(err);
    var pending = list.length;
    if (!pending) return done(null, results);
    list.forEach(function(file) {
      file = path.resolve(dir, file);
      fs.stat(file, function(err, stat) {
        if (stat && stat.isDirectory()) {
          walk(file, function(err, res) {
            results = results.concat(res);
            if (!--pending) done(null, results);
          });
        } else {
          results.push(file);
          if (!--pending) done(null, results);
        }
      });
    });
  });
};


walk("/home/utvikler/workspace/mlab.local.dev/mlab_elements/apps/e8481e22X9a4bX4d2eX9052X326ce77bf915/1/", function(err, results) {
    if (err) throw err;
    var md5sums = [];
    for (i in results) {
        md5sums.push(md5File(results[i]));
    }
    md5sums.sort();
    var global_md5 = md5(md5sums.join(""));
    console.log(global_md5);
});
