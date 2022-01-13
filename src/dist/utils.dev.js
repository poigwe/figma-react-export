"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.slugify = slugify;
exports.extractStyle = extractStyle;
exports.extractHtml = extractHtml;
exports.getImgs = getImgs;
exports.reactBoilerPlate = exports.createDir = exports.createFile = void 0;

function slugify(str) {
  //replace all special characters | symbols with a space
  str = str.replace(/[`~!@#$%^&*()_\-+=\[\]{};:'"\\|\/,.<>?\s]/g, ' ').toLowerCase(); // trim spaces at start and end of string

  str = str.replace(/^\s+|\s+$/gm, ''); // replace space with dash/hyphen

  str = str.replace(/\s+/g, '_'); // console.log('str', str)

  return str;
}

function replaceAttributes(htmlContent) {
  //replace all class= with className, close all tags
  htmlContent = htmlContent.replace(/class=/g, 'className=');
  htmlContent = htmlContent.replace(/(<img[^>]*?) *\/?>/g, "$1 />");
  htmlContent = htmlContent.replace(/(<input[^>]*?) *\/?>/g, "$1 />");
  htmlContent = htmlContent.replace(/(<br[^>]*?) *\/?>/g, "$1 />"); // htmlContent = htmlContent.replace(/style="(.+?)"/g, "style={{ $1: '$2' }}");

  return htmlContent;
}

function cleanUpCss(htmlContent) {
  htmlContent = htmlContent.replace(/top:Infinity%;/g, '');
  htmlContent = htmlContent.replace(/undefined/g, '');
  return htmlContent;
} // (?<=>)([\w\s]+)(?=<\/)


function extractStyle(htmlContent) {
  var start = "<style type=\"text/css\">";
  var end = "</style>";
  var middleText = htmlContent.split(start)[1].split(end)[0];
  var newContent = cleanUpCss(middleText);
  return newContent;
}

function extractHtml(htmlContent) {
  var start = "<body class=\"the_body\">";
  var end = "</body>";
  var middleText = htmlContent.split(start)[1].split(end)[0];
  var newContent = replaceAttributes(middleText);
  return newContent;
}

function getImgs(htmlContent) {
  // htmlContent = htmlContent.match(/src="[^"]*"/gm);
  htmlContent = htmlContent.match(/(?:src)=\"([^\"]+)/gm);
  return htmlContent;
}

var createFile = function createFile(filePath, fileContent) {
  fs.writeFile(filePath, fileContent, function (error) {
    if (error) {
      console.error('an error occured', error);
    } else {
      console.log('file written');
    }
  });
};

exports.createFile = createFile;

var createDir = function createDir(dirPath) {
  fs.mkdirSync(dirPath, {
    recursive: true
  }, function (error) {
    if (error) {
      console.log('An error occured: ', error);
    } else {
      console.log('Your directory is made');
    }
  });
};

exports.createDir = createDir;

var reactBoilerPlate = function reactBoilerPlate(name, html) {
  return "import React from \"react\"\n\n    export default function ".concat(slugify(name).charAt(0).toUpperCase() + name.slice(1), "() {\n        return (\n            <>\n            ").concat(html, "\n            </>\n        )\n    }\n    ");
};

exports.reactBoilerPlate = reactBoilerPlate;