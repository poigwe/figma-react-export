"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getImageMap = exports.stack = exports.requestFile = void 0;

var _fs = _interopRequireDefault(require("fs"));

var _path = _interopRequireDefault(require("path"));

var _axios = _interopRequireDefault(require("axios"));

var _fileSystemCache = _interopRequireDefault(require("file-system-cache"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _typeof(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

console.log(_fileSystemCache["default"]);

var cache = _fileSystemCache["default"]["default"]({
  basePath: "./cache" // Path where cache files are stored

});

var requestFile = function requestFile(link, token, fileID, cached) {
  if (cached) cached = cache.getSync(fileID, false); //if not cached then request from API

  if (cached) {
    console.log('getting page from cache');
    return cache.get(fileID);
  } else {
    var instance = _axios["default"].create({
      headers: {
        'X-Figma-Token': token
      }
    });

    console.log('Requesting page from API.');
    return instance.get(link).then(function (response) {
      console.log('Success!');
      cache.set(fileID, response.data);
      /*const savePath = path.resolve('./cache', 'response-data')
      const writer = fs.createWriteStream(savePath)
      writer.write(JSON.stringify(response.data))*/

      return response.data;
    }, function (error) {
      console.log(error);
    });
  }
};

exports.requestFile = requestFile;

var Stack =
/*#__PURE__*/
function () {
  function Stack() {
    _classCallCheck(this, Stack);

    this.counter = 0;
    this.svg = [];
    this.png = [];
  }

  _createClass(Stack, [{
    key: "process",
    value: function process(elemId, imageName, format) {
      this.counter++; //total images processed

      var cached = cache.getSync(imageName, false);

      if (!cached) {
        //enqueue
        this[format].push({
          id: elemId,
          name: imageName
        });
      } else {
        // get from cache
        //console.log('geting from cache: ' + imageName+'.'+format);
        var savePath = _path["default"].resolve('./project/public', 'images', imageName + '.' + format);

        var writer = _fs["default"].createWriteStream(savePath);

        writer.write(Buffer.from(cached.data));
      }

      if (this[format].length == global.downloadStackSize) {
        //global stack counter here
        this.getImages(format, this[format]);
        this[format] = []; //empty
      }
    }
  }, {
    key: "getImages",
    value: function getImages(format) {
      console.log('-----' + this[format].length + ' .' + format + ' processing'); //aggregate ids

      var stack = this[format];
      var ids = '';
      this[format].forEach(function (row) {
        ids += row.id + ',';
      });
      ids = ids.slice(0, -1);

      var instance = _axios["default"].create({
        baseURL: 'https://api.figma.com/v1/images/',
        timeout: 30000,
        headers: {
          'X-Figma-Token': global.XFigmaToken
        }
      });

      var link = global.figmaFileID;
      link += '?ids=' + ids + '&format=' + format;

      if (this[format].length > 0) {
        return instance.get(link).then(function (response) {
          var images = response.data.images; //{elemId : url}

          if ((typeof url === "undefined" ? "undefined" : _typeof(url)) === 'object' && url === null) console.log('wrong url!');else downloadImages(images, stack, format, cache); //need to set cache
        }, function (error) {
          console.log(error);
        });
      }
    }
  }, {
    key: "getImagesLeft",
    value: function getImagesLeft() {
      this.getImages('svg');
      this.getImages('png');
    }
  }]);

  return Stack;
}();

var stack = new Stack();
exports.stack = stack;

var getImageMap = function getImageMap(elemId) {
  var imageName = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'key';
  var format = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 'png';
  var link = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : figmaFileID;
  var token = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : XFigmaToken;
  stack.process(elemId, imageName, format);
};

exports.getImageMap = getImageMap;

function downloadImages(images, stack, format, cache) {
  var queue = Object.entries(images);
  queue.forEach(function (row) {
    var name = '';
    var id = '';
    stack.forEach(function (stackRow) {
      if (stackRow.id == row[0]) {
        name = stackRow.name;
        id = stackRow.id;
      }
    });
    downloadImage(row[1], name, format, cache, id);
  });
}

function downloadImage(url, name, ext, cache, id) {
  //id for diagnostic
  var savePath = _path["default"].resolve('./project/public', 'images', name + '.' + ext);

  var writer = _fs["default"].createWriteStream(savePath);

  var instance = _axios["default"].create({
    responseType: 'arraybuffer'
  });

  if (_typeof(url) === 'object' && url === null) {
    console.log('wrong url! ' + id);
  } else {
    instance.get(url).then(function (response) {
      writer.write(response.data);
      cache.set(name, response.data);
    }, function (error) {
      console.log('no way it is failed!');
      console.log(error);
    });
  }
}