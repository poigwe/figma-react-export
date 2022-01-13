import jsdom from 'jsdom'
const { JSDOM } = jsdom;

import * as fs from 'fs';
import path from 'path';
import md5 from 'md5';
import * as child from 'child_process';
import { slugify, extractStyle, extractHtml, createFile, createDir, reactBoilerPlate, getImgs } from './utils.js';
import { isObject, isString, isArray, isNull } from 'util';
import { getImageMap, stack } from './request.js'

export function processPage(r, pageName) {
    if (isString(r)) r = JSON.parse(r);
    const result = Object.entries(r.document.children); // this is top level elemets of document, i.e. future pages.html
    var page; //select the right page
    for (var i = 0; i < result.length; i++) {
        if (result[i][1].name == pageName) { page = result[i][1]; break; } //warnig  
    }
    // pass it to parser
    parse(page); //passed page with all frames
}

let linkMap = {}  //{id : name}
function parse(page) {
    var topFrames = Object.values(page.children); //frames represents html dom structures (future .html pages)
    topFrames.forEach(//populate link map
        topFrame => {
            linkMap[topFrame.id] = topFrame.name //store map for linking links has transitionNodeID attribute set to the id of top level frame
        }
    );
    topFrames.forEach( // start creating pages
        topFrame => {
            linkMap[topFrame.id] = topFrame.name //store map for linking links has transitionNodeID attribute set to the id of top level frame
            if (global.targetFrame && topFrame.name === global.targetFrame) parsePage(topFrame)
            if (!global.targetFrame) parsePage(topFrame)
        }
    );
}

let cssNames = '';
function parsePage(data) {

    const dom = new JSDOM(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>` + data.name + `</title></head></html>`);
    const d = dom.window.document;
    //begin css entry

    let css = d.createElement('style');
    css.type = 'text/css';
    css.innerHTML += 'p {margin:0;padding:0;} .width_100 {width: 100%} .the_body{margin:0; background-color: ' + convertColor(data.backgroundColor) + '; height: ' + data.absoluteBoundingBox.height + 'px; } .the_mainFrame{background-color: ' + convertColor(data.backgroundColor) + '; height: 100vh; width:100%; position:relative; overflow:auto} ';
   

    //set current element add class
    d.querySelector('body').className += 'the_body'
    var mainFrame = d.createElement('div')
    mainFrame.className += 'the_mainFrame'
    d.querySelector('body').appendChild(mainFrame)


    //create pointer
    var pointer = {};
    pointer.current = mainFrame;
    pointer.parent = mainFrame;
    pointer.parentBB = data.absoluteBoundingBox;

    //start processing children nodes. This is recursive for all children
    data.children?.forEach(
        function (children) {
            processChildren(children, pointer, css, d, pointer);
        }
    );

    d.querySelector('head').appendChild(css);
    var rootFolder = './project'
    let fileName = `./project/${slugify(data.name)}.html`;

    child.exec('npm i bootstrap ', { cwd: './project'}, (error, stdout, stderr) => {
        if(error) {
            console.log('err', error)
        }
    })


    if(!fs.existsSync(path.resolve(`project/pages/${slugify(data.name)}`))) fs.mkdirSync(path.resolve(`project/pages/${slugify(data.name)}`), { recursive: true });

    cssNames += `import '../styles/${slugify(data.name)}.css' \n`

    fs.writeFile(fileName, dom.serialize(), function (err) {
        if (err) {
            return console.log(err);
        }
        // console.log("The " + data.name + ".html file was saved!");

        const textContent = fs.readFileSync(`${fileName}`, 'utf8');

        // let ImgScribbled = getImgs(textContent);
        // let newText = '';
        // for(let i = 0; i < ImgScribbled?.length; i++){ 
        //     newText += `import picture${[i]} from '${ImgScribbled[i].replace('src="', '')}'; \n`
        // }

        fs.writeFileSync(`${rootFolder}/styles/${slugify(data.name)}.css`, extractStyle(textContent));
        fs.writeFileSync(`${rootFolder}/pages/${slugify(data.name)}/index.js`, reactBoilerPlate(`${slugify(data.name)}`,  extractHtml(textContent )));

        // Delete the html file
        // fs.unlinkSync(fileName);

        stack.getImagesLeft();
    });



    fs.writeFileSync(`project/pages/_app.js`, `
    import '../styles/globals.css'; \n
    import 'bootstrap/dist/css/bootstrap.min.css'; \n
    ${cssNames}

    function MyApp({ Component, pageProps }) {
      return <Component {...pageProps} />
    }
    
    export default MyApp
    `)



}

function processChildren(children, pointer, css, d) {
    //store pointer
    var p1 = pointer.parent;
    var p2 = pointer.current;
    var pBB = pointer.parentBB;

    if (global.stopOnExport && !(children.exportSettings === undefined) && children.exportSettings.length > 0) {
        children.type = 'EXPORT'
        delete children.children
    }

    if (!children.visible && !(typeof children.visible === 'undefined')) children.type = 'INVISIBLE'

    switch (children.type) {
        case 'INVISIBLE':
            break
        case 'FRAME':
            pointer = processFrame(children, pointer, css, d,)
            break
        case 'INSTANCE':
            pointer = processFrame(children, pointer, css, d,)
            break
        case 'GROUP':
            pointer = processFrame(children, pointer, css, d,)
            break
        case 'EXPORT':
            pointer = processExport(children, pointer, css, d)
            break
        case 'RECTANGLE':
            pointer = processRectangle(children, pointer, css, d)
            break
        case 'STAR':
        case 'ELLIPSE':
        case 'VECTOR':
        case 'LINE':
            pointer = processVector(children, pointer, css, d)
            break
        case 'TEXT':
            pointer = processText(children, pointer, css, d)
            break
        case 'BOOLEAN_OPERATION':
        case 'AS_IMAGE':
            pointer = processAsImage(children, pointer, css, d) //Fallback option for stuff like boolean
            break
        default:
            console.log(children.type + ' is undefined type of element')
            // console.log(children)
    }

    //recursive processing
    if (children.children === undefined || children.children.length == 0) { } else {
        pointer.parent = pointer.current;
        pointer.parentBB = children.absoluteBoundingBox;
        children.children.forEach(
            function (c) {
                processChildren(c, pointer, css, d);
            }
        );
        //restore pointer
        pointer.parent = p1;
        pointer.current = p2;
        pointer.parentBB = pBB;
    }
}


function processExport(children, pointer, css, d) { //TODO make it wrapped with parent div. As wor now it works but in a very strange way
    var className = checkUniqueName(children.name, children.type);
    var element = d.createElement('img');
    element.className += className;
    let name = md5(children.name)
    //if(typeof children.exportSettings[0] ==='undefined') console.log(children) //diag
    let format = children.exportSettings[0].format.toLowerCase();
    getImageMap(children.id, name, format)
    element.src = "images/" + name + "." + format
    pointer.parent.appendChild(element);
    pointer.current = element;

    var cssString = '.' + className + '{display:block; position:absolute; ';
    cssString += convertPosition(children.absoluteBoundingBox, pointer.parentBB, children.constraints, false, true);
    cssString += '} '
    css.innerHTML += cssString;
    return pointer;
}












function RandomChunk(children, className, pointer, css) {
    var cssString = '.' + className + '{  position:absolute; clear: both; ';//flexbox used for frames
    cssString += convertPositionBasedOnName(children.name, children.absoluteBoundingBox, pointer.parentBB, children.constraints);
    cssString += 'background-color: ' + convertColor(children.backgroundColor) + '; '
    if (!children.visible && !(typeof children.visible === 'undefined')) cssString += 'display: none; '


    if (children.clipsContent && !(typeof children.clipsContent === 'undefined')) cssString += 'overflow: hidden; '
    children.effects.forEach(effect => {
        if (effect.type === 'DROP_SHADOW') {
            if (effect.visible) {
                cssString += 'box-shadow: ' + effect.offset.x + 'px ' + effect.offset.y + 'px ' + effect.radius + 'px ' + convertColor(effect.color) + '; '
            }
        }
    })
    cssString += '} '
    css.innerHTML += cssString;
};

function RandomChunkWithOutAbsolute(children, className, pointer, css) {
        //process elemt class relaive css
        var cssString = '.' + className + '{ clear: both; ';//flexbox used for frames
        cssString += convertPositionBasedOnName(children.name, children.absoluteBoundingBox, pointer.parentBB, children.constraints);
        cssString += 'background-color: ' + convertColor(children.backgroundColor) + '; '
        if (!children.visible && !(typeof children.visible === 'undefined')) cssString += 'display: none; '


        if (children.clipsContent && !(typeof children.clipsContent === 'undefined')) cssString += 'overflow: hidden; '
        children.effects.forEach(effect => {
            if (effect.type === 'DROP_SHADOW') {
                if (effect.visible) {
                    cssString += 'box-shadow: ' + effect.offset.x + 'px ' + effect.offset.y + 'px ' + effect.radius + 'px ' + convertColor(effect.color) + '; '
                }
            }
        })

        cssString += ' top: 0 !important; } '
        css.innerHTML += cssString;
}

function RandomChunkWithRelative (children, className, pointer, css) {
    //process elemt class relaive css
    var cssString = '.' + className + ' {  position: relative; clear: both; ';//flexbox used for frames
    cssString += convertPositionBasedOnName(children.name, children.absoluteBoundingBox, pointer.parentBB, children.constraints);
    cssString += 'background-color: ' + convertColor(children.backgroundColor) + ' !important; '
    if (!children.visible && !(typeof children.visible === 'undefined')) cssString += 'display: none; '

    if (children.clipsContent && !(typeof children.clipsContent === 'undefined')) cssString += 'overflow: hidden; '
    children.effects.forEach(effect => {
        if (effect.type === 'DROP_SHADOW') {
            if (effect.visible) {
                cssString += 'box-shadow: ' + effect.offset.x + 'px ' + effect.offset.y + 'px ' + effect.radius + 'px ' + convertColor(effect.color) + '; '
            }
        }
    })


    cssString += ' top: 0 !important; } '
    if(children.name.includes('row')) cssString += ' @media only screen and (max-width: 800px) {' + '.' + className + '{flex-direction: column !important;}}'
    css.innerHTML += cssString;
}




function processFrame(children, pointer, css, d) {
    var className = checkUniqueName(children.name, children.type);
    let elementTag = convertTransitionToLink(children);
    var element = '';

    if(children.name === 'btn' || children.name === 'button' || children.name === 'buttons' || children.name === 'Button') {
        element = d.createElement('button');
        element.className = `${children.name}`

                //process elemt class relaive css
                var cssString = '.' + className + '{  position:absolute; clear: both;'; //flexbox used for frames
                cssString += convertPosition(children.absoluteBoundingBox, pointer.parentBB, children.constraints);
                cssString += 'background-color: ' + convertColor(children.backgroundColor) + ' !important; '
                if (!children.visible && !(typeof children.visible === 'undefined')) cssString += 'display: none; '




                if (children.clipsContent && !(typeof children.clipsContent === 'undefined')) cssString += 'overflow: hidden; '
                children.effects.forEach(effect => {
                    if (effect.type === 'DROP_SHADOW') {
                        if (effect.visible) {
                            cssString += 'box-shadow: ' + effect.offset.x + 'px ' + effect.offset.y + 'px ' + effect.radius + 'px ' + convertColor(effect.color) + '; '
                        }
                    }
                })
                cssString += '} '
                css.innerHTML += cssString;
    } 

    else if (children.name.includes('btn') && children.name.includes('#')) {
        element = d.createElement('button');
        element.className = `${children.name}`
        children.name.includes('#') ? RandomChunkWithRelative(children, className, pointer, css) : RandomChunk(children, className, pointer, css);
    }

    else if (children.name.includes('bs') || children.name.includes('input')) {
        element = d.createElement('input');
        element.className = `${children.name} form-control`
        RandomChunkWithOutAbsolute(children, className, pointer, css)
        // children.name.includes('bs') ? RandomChunkWithOutAbsolute(children, className, pointer, css) : RandomChunk(children, className, pointer, css);
    } 
    
    else if (children.name.includes('card') || children.name.includes('jumbotron')) {
        element = d.createElement('div');
        element.className = `${children.name}`
        RandomChunkWithOutAbsolute(children, className, pointer, css)
    } 

    else if (children.name.includes('badge')) {
        element = d.createElement('span');
        element.className = `${children.name}`
        RandomChunkWithOutAbsolute(children, className, pointer, css)
    } 

    else if (children.name.includes('container')) {
        element = d.createElement('section');
        element.className = `${children.name}`
        RandomChunkWithOutAbsolute(children, className, pointer, css)
    } 

    else if ( children.name.includes('row')) {
        element = d.createElement('div');
        element.className = `${children.name}`
        RandomChunkWithRelative(children, className, pointer, css)
    } 

    else if(children.name.includes('col')) {
        element = d.createElement('div');
        element.className = `${children.name}`
        //process elemt class relaive css
        RandomChunkWithOutAbsolute(children, className, pointer, css)
    } 

    else if(elementTag.noAbs === true) {
        element = d.createElement('div');
        element.className = `${children.name}`
        RandomChunkWithOutAbsolute(children, className, pointer, css)
    } 

    else {
   
        element = d.createElement(elementTag.tag);
     
        //process elemt class relaive css
        var cssString = '.' + className + '{display:flex; position:absolute; clear: both;';//flexbox used for frames
        cssString += convertPosition(children.absoluteBoundingBox, pointer.parentBB, children.constraints);
        cssString += 'background-color: ' + convertColor(children.backgroundColor) + ' !important; '
        if (!children.visible && !(typeof children.visible === 'undefined')) cssString += 'display: none; '


        
        if (children.clipsContent && !(typeof children.clipsContent === 'undefined')) cssString += 'overflow: hidden; '
        children.effects.forEach(effect => {
            if (effect.type === 'DROP_SHADOW') {
                if (effect.visible) {
                    cssString += 'box-shadow: ' + effect.offset.x + 'px ' + effect.offset.y + 'px ' + effect.radius + 'px ' + convertColor(effect.color) + '; '
                }
            }
        })
        cssString += '} '
        css.innerHTML += cssString;
    }

    if (elementTag.node) {
        element.href = elementTag.node + '.html'
    }
    element.className += ' ' + className;

    pointer.parent.appendChild(element);
    //update pointer
    pointer.current = element;



    return pointer;
}

function processRectangle(children, pointer, css, d) {
    var className = checkUniqueName(children.name, children.type);
    let elementTag = convertTransitionToLink(children);
    
    var element = d.createElement(elementTag.tag);
    if (elementTag.node) {
        console.log('elementTag.node', elementTag.node);
        element.href = elementTag.node + '.html'
    }
    element.className += className;
    pointer.parent.appendChild(element);

    var cssString = '.' + className + '{display:flex; position:absolute; box-sizing: border-box; ' //flexbox used for frames
    cssString += convertPosition(children.absoluteBoundingBox, pointer.parentBB, children.constraints)

    let renderStroke = false // check if image first
    if (children.fills.length == 0) renderStroke = true
    children.fills.forEach(function (fills) {
        if (fills.type === 'SOLID') {
            cssString += 'background-color: ' + convertColor(fills.color) + '; '
            if (!(typeof fills.opacity === 'undefined')) cssString += 'opacity: ' + fills.opacity + '; '
        }
        if (fills.type === 'IMAGE') {
            //console.log('processing image: '+ fills.imageRef)
            getImageMap(children.id, fills.imageRef);
            cssString += 'background-image: url("../public/images/' + fills.imageRef + '.png"); background-repeat: no-repeat; background-size: cover; ';
        }
        if (fills.type === 'GRADIENT_LINEAR') {
            cssString += 'background: ' + convertLinearGradient(fills, children.absoluteBoundingBox, children)
        }
        if (fills.type === 'GRADIENT_RADIAL') {
            //covertRadialGradient(fills, children.absoluteBoundingBox)
            cssString += 'background: ' + covertRadialGradient(fills, children.absoluteBoundingBox)
        }
        if (fills.type !== 'IMAGE') renderStroke = true
    })
    children.effects.forEach(effect => {
        if (effect.type === 'DROP_SHADOW') {
            if (effect.visible) {
                cssString += 'box-shadow: ' + effect.offset.x + 'px ' + effect.offset.y + 'px ' + effect.radius + 'px ' + convertColor(effect.color) + '; '
            }
        }
    })

    if (renderStroke) cssString += processStroke(children)
    cssString += '}'
    css.innerHTML += cssString;

    //update pointer
    pointer.current = element;

    return pointer;
}

function processAsImage(children, pointer, css, d) {
    var className = checkUniqueName(children.name, children.type);

    var element = d.createElement('div');
    element.className += className;
    pointer.parent.appendChild(element);

    var cssString = '.' + className + '{display:flex; position:absolute; ' //flexbox used for frames
    cssString += convertPosition(children.absoluteBoundingBox, pointer.parentBB, children.constraints)
    getImageMap(children.id, md5(children.id))
    cssString += 'background-image: url("../public/images/' + md5(children.id) + '.png"); background-repeat: no-repeat; background-size: 100%; ';

    cssString += '} .' + className + ' * {display:none !important;} ';
    css.innerHTML += cssString;

    //update pointer
    pointer.current = element;

    return pointer;
}

function covertRadialGradient(fills, abb) {
    let w = abb.width
    let h = abb.height
    let gHP = fills.gradientHandlePositions
    let dX = w * gHP[1].x - w * gHP[0].x
    let dY = h * gHP[1].y - h * gHP[0].y
    let lineLen = Math.hypot(dX, dY);
    let xPC = (w * gHP[0].x) / (w / 100) + '%'
    let yPC = (h * gHP[0].y) / (h / 100) + '%'
    //radial-gradient(1011.92px at 33.96% 43.68%, #F5F5F5 0%, #EBEBEB 100%);
    let cssLine = 'radial-gradient(' + lineLen + 'px at ' + xPC + ' ' + yPC + ', '
    fills.gradientStops.forEach(stop => {
        cssLine += convertColor(stop.color) + ' ' + ((stop.position * lineLen) / (lineLen / 100)) + '%, '
    })
    cssLine = cssLine.slice(0, -2);
    cssLine += '); '
    return cssLine
}

function convertLinearGradient(fills, abb, children) {

    let w = abb.width
    let h = abb.height
    let gHP = fills.gradientHandlePositions
    let dX = w * gHP[1].x - w * gHP[0].x
    let dY = h * gHP[1].y - h * gHP[0].y
    //find angle
    let angle = Math.round(Math.atan(dY / dX) * (180 / Math.PI));
    //find length --->
    let lineLen = Math.hypot(dX, dY);
    //find dyrection and corrent angle
    let correctAngle = angle
    let direction = ''
    if (Math.round(dY) < 0) direction += 'BT'; if (Math.round(dY) > 0) direction += 'TB'; if (Math.round(dY) == 0) direction += 'H'
    if (Math.round(dX) < 0) direction += 'RL'; if (Math.round(dX) > 0) direction += 'LR'; if (Math.round(dX) == 0) direction += 'V'

    if (direction === 'BTLR' || direction === 'TBLR' || direction === 'HLR' /*|| direction==='TBV'*/) correctAngle += 90
    if (direction === 'TBV') correctAngle = Math.abs(correctAngle) + 90
    if (direction === 'BTRL' || direction === 'TBRL' || direction === 'HRL') correctAngle -= 90
    if (direction === 'BTV') correctAngle = Math.abs(correctAngle) - 90

    let cssLine = 'linear-gradient(' + correctAngle + 'deg,'

    //find gradient length
    let absAngle = Math.abs(angle)
    let gLen = 0
    if (angle != 0) { //this work if line is not horizontal
        var s1 = Math.tan((90 - absAngle) * Math.PI / 180) * (h / 2)
        var s2 = w / 2 - s1
        var s3 = Math.sin((90 - absAngle) * Math.PI / 180) * s2
        var s4 = Math.hypot(s1, h / 2)
        gLen = (s3 + s4) * 2
    }
    if (angle == 0) gLen = w;
    let PCK = gLen / 100
    let firstPointPC = 0
    //find the first point relative to center (work on any angle?)
    {
        let x = w * gHP[0].x
        let y = h * gHP[0].y
        let p1 = w / 2 - x;
        let p2 = h / 2 - y;
        let p3 = Math.hypot(p1, p2)
        let ang = 90 - Math.abs(Math.atan(p1 / p2) * (180 / Math.PI)) - absAngle
        let p4 = p3 * (Math.cos(ang * (Math.PI / 180)))
        let position = gLen / 2 - p4
        firstPointPC = position / PCK
    }
    //generate gradient stops
    fills.gradientStops.forEach(stop => {
        cssLine += convertColor(stop.color) + ' ' + ((stop.position * lineLen) / PCK + firstPointPC) + '%, '
    })
    cssLine = cssLine.slice(0, -2);
    cssLine += '); '
    return cssLine
}

function processVector(children, pointer, css, d) {
    let className = checkUniqueName(children.name, children.type);
    let element = d.createElement('img');
    element.className += className;
    let cssString = "";

    if(children.name.includes('#')) {
        cssString = '.' + className + children.name.includes('#') ? '{ ' : '{ ' //flexbox used for frames
    } else {
        cssString = '.' + className + children.name.includes('#') ? '{ ' : '{position:absolute; ' //flexbox used for frames
    }


    cssString += convertPosition(children.absoluteBoundingBox, pointer.parentBB, children.constraints, children.strokeWeight)

    //console.log('processing vector image: '+ children.name + ' whith id: ' + children.id)
    let name = md5(children.id) //will create name for file withiut wrong stuff and convenient for caching
    getImageMap(children.id, name, 'svg')


    element.src = "images/" + name + ".svg"
    pointer.parent.appendChild(element);
    cssString += '}';
    css.innerHTML += cssString;
    pointer.current = element;
    return pointer;
}

function processStroke(children) {
    if (!(typeof children.strokes[0] === 'undefined')) {
        if (children.strokes[0].type === 'SOLID') return 'border: ' + children.strokeWeight + 'px solid ' + convertColor(children.strokes[0].color) + '; '
    }
}

function processText(children, pointer, css, d) {
    let className = checkUniqueName(children.id)
    let cssString = "";
    let element = "";

    if (children.name.includes('col')) {
        element = d.createElement('div');
        element.className = `${children.name} ` + className
        //process elemt class relaive css
        element.innerHTML += convertCharacters(children.characters, children.characterStyleOverrides, children.styleOverrideTable, css, className);  
        cssString = '.' + className + '{ display:flex; flex-flow: row; ' //flexbox used for frames
    } else if (children.name.includes('#')) {
        element = d.createElement('div');
        element.className = `${children.name} ` + className
        //process elemt class relaive css
        element.innerHTML += convertCharacters(children.characters, children.characterStyleOverrides, children.styleOverrideTable, css, className);  
        cssString = '.' + className + '{  ' //flexbox used for frames
    }
    else {
        element = d.createElement('div')
        element.className += className
        element.innerHTML += convertCharacters(children.characters, children.characterStyleOverrides, children.styleOverrideTable, css, className);    
        cssString = '.' + className + '{position:absolute; display:flex; flex-flow: row; ' //flexbox used for frames
    }


    cssString += convertPositionBasedOnName(children.name, children.absoluteBoundingBox, pointer.parentBB, children.constraints)

    //console.log('processing text block: '+ /*children.name +*/ ' whith id: ' + children.id)

    children.fills.forEach(function (fills) {
        if (fills.type === 'SOLID') { cssString += 'color: ' + convertColor(fills.color) + ';' }
        /*if(fills.type === 'IMAGE'){ //This is not working!
            console.log('processing image: '+ fills.imageRef)
            getImageMap(children.id, fills.imageRef);
            cssString += 'background-image: url("images/'+fills.imageRef+'.png"); background-repeat: no-repeat; background-size: 100%; background-clip: text; -webkit-background-clip: text;'}
        */
    })
    cssString += convertStyle(children.style);

    pointer.parent.appendChild(element);
    cssString += '}';
    if (!(children.style.paragraphSpacing === 'undefined')) cssString += '.' + className + ' p {margin-bottom: ' + children.style.paragraphSpacing / 16 + 'rem;}';
    css.innerHTML += cssString;
    pointer.current = element;
    return pointer;
}

function convertTransitionToLink(children) {
    let tag = 'div';
    let node = false;
    let noAbs = false;

    if (typeof children.transitionNodeID !== 'undefined' && children.name.includes('#')) {
        tag = 'div';
        node = linkMap[children.transitionNodeID];
        noAbs = true;
    } else {
        tag = 'a'
        node = linkMap[children.transitionNodeID]
        noAbs = false;
    }
    return { tag: tag, node: node, noAbs: noAbs }
}
function convertCharacters(string, overrideMap, overrideTable, css, baseClass = '') {
    let spanCreated = 0;
    let cssString = ''
    let result = '<div class="width_100"><p>'
    let i = 0;

    string.split('').forEach(char => {

        if (char.match(/\n/)) { // paragraph split
            result += '</p><p>'
        } else {
            if (!(typeof overrideMap[i] === 'undefined')) {//here we look for overrides
                if (!spanCreated && spanCreated != overrideMap[i]) { //open span override
                    result += '<span class="' + baseClass + '-' + overrideMap[i] + '">'
                    spanCreated = overrideMap[i]
                }
                if (spanCreated && spanCreated != overrideMap[i] && overrideMap[i] != 0) { //new span override right over old one
                    result += '</span><span class="' + baseClass + '-' + overrideMap[i] + '">'
                }
                if (spanCreated && overrideMap[i] == 0) { //end of the override
                    result += '</span>'
                    spanCreated = 0;
                }
            } else {
                if (spanCreated) {//close last span as overrides ended
                    result += '</span>'
                    spanCreated = 0;
                }
            }
            result += char
        }
        i++;
    })
    Object.entries(overrideTable).forEach(style => {
        cssString += '.' + baseClass + '-' + style[0] + ' {'
        cssString += convertStyle(style[1])
        cssString += '} '
    })

    css.innerHTML += cssString;
    result += '</p></div>'

    return result
}

function convertStyle(style) { //convert styles for text
    let cssString = ''
    let translate = {
        fontFamily: 'font-family',
        fontWeight: 'font-weight',
        fontSize: 'font-size',
        textAlignHorizontal: 'text-align',
        textAlignVertical: 'align-items',
        lineHeightPx: 'line-height',
        paragraphIndent: 'text-indent',
        textCase: 'text-transform'
    }
    let translateUnits = {
        lineHeightPx: 'px',
        fontSize: 'px',
        paragraphIndent: 'px',
    }
    let translateRules = {
        'UPPER': 'uppercase',
        'TOP': 'flex-start',
        'BOTTOM': 'flex-end',
        'CENTER': 'center'
    }

    Object.entries(translate).forEach(entry => {
        if (entry[0] in style) {
            var unit = ''
            var rule = style[entry[0]]
            Object.entries(translateRules).forEach(rules => {
                if (rule in translateRules) rule = translateRules[rule]
            })
            Object.entries(translateUnits).forEach(units => {
                if (entry[0] in translateUnits) unit = translateUnits[entry[0]]
            })

            cssString += entry[1] + ': ' + rule + unit + '; '
        }
    })
    return cssString;
}

function checkUniqueName(name, type = '') {
    return 'Inter_' + randomName(6);
}

function randomName(length) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

function randomRGB(from = 0, to = 255) { // was used for testing purposes
    return 'rgba(' + Math.floor(Math.random() * to + from) + ', ' + Math.floor(Math.random() * to + from) + ', ' + Math.floor(Math.random() * to + from) + ', ' + Math.round(Math.random() * 100) / 100 + ')';
}

function checkIfRow() {

}

function convertPositionBasedOnName (name, abb, pbb, constraints, sw = false, exc = false) { //sw -stroke weight correction // exc-export correction will set width and height as 100%
    //generate css position relative to parent block
    //api returning only global position
    var y = abb.y - pbb.y; //top
    var x = abb.x - pbb.x; //left
    var bottom = pbb.height - (y + abb.height);
    var right = pbb.width - (x + abb.width);
    var v = constraints?.vertical;
    var h = constraints?.horizontal;
    var centeredPecentV = Math.round(((y + abb.height / 2) / (pbb.height / 100)) * 100) / 100;
    var centeredPecentH = Math.round(((x + abb.width / 2) / (pbb.width / 100)) * 100) / 100;
    var cssString = '';
    let unit = 'px'

    if (abb.width < 1 && sw) {//vertical line correction
        abb.width = sw;
        if (Math.round(right) != 0) right -= sw / 2
        if (Math.round(x) != 0) x -= sw / 2
    }
    if (abb.height < 1 && sw) {//horizontal line correction
        abb.height = sw;
        if (Math.round(bottom) != 0) bottom -= sw / 2
        if (Math.round(y) != 0) y -= sw / 2
    }


    let width = "";
    if(name.includes('row') || name.includes('container') || name.includes('#')) {
        width = ''
    } else if (name.includes('col')) {
        width = ''
    } else {
        width = 'width: ' + abb.width + unit + '; '
    }

    let height = "";
    if(name.includes('row')) {
        height = ''
    } else {
        height = 'min-height: ' + abb.height + unit + '; '
    }

    if (Math.round(abb.width)==Math.round(pbb.width)) width = 'width: 100%;' //experimental
    // if (abb.width < 1000) width = 'width: 100%; max-width: 100%;' 

    if (!exc) cssString += width + height

    if(name.includes('row')) {
        if (v === 'TOP' || v === 'SCALE') cssString += '';
    } else {
        if (v === 'TOP' || v === 'SCALE') cssString += 'top: ' + y / 16 + 'rem;'
    }


    if (v === 'TOP' || v === 'SCALE') cssString += 'top: ' + y / 16 + 'rem;'
    if (v === 'TOP_BOTTOM') cssString += 'top: ' + y / 16 + 'rem; bottom: ' + bottom / 16 + 'rem; '
    if (v === 'BOTTOM') cssString += 'bottom:' + bottom / 16 + 'rem;'
    if (v === 'CENTER' && !(h === 'CENTER')) { cssString += 'top:' +  centeredPecentV + '%; transform:translateY(-50%); '; }

    // if (h === 'LEFT' || h === 'SCALE') { cssString += 'left: ' + x / 16 + 'rem;'; }
    if (h === 'LEFT' || h === 'SCALE') { cssString += 'left: ' + 0 + 'rem;'; }
    if (h === 'LEFT_RIGHT') { cssString += 'left: ' + x / 16 + 'rem; right: ' + right / 16 + 'rem; '; }
    if (h === 'RIGHT') { cssString += 'right:' + right / 16 + 'rem;'; }
    if (h === 'CENTER' && !(v === 'CENTER')) { cssString += 'left:' + centeredPecentH + '%; transform:translatex(-50%); '; }
    if (h === 'CENTER' && v === 'CENTER') { cssString += 'left:' + centeredPecentH + '%; top:' + centeredPecentV + '%; transform:translateX(-50%) translateY(-50%); '; }

    return cssString;
}

function convertPosition(abb, pbb, constraints, sw = false, exc = false) { //sw -stroke weight correction // exc-export correction will set width and height as 100%
    //generate css position relative to parent block
    //api returning only global position
    var y = abb.y - pbb.y; //top
    var x = abb.x - pbb.x; //left
    var bottom = pbb.height - (y + abb.height);
    var right = pbb.width - (x + abb.width);
    var v = constraints.vertical;
    var h = constraints.horizontal;
    var centeredPecentV = Math.round(((y + abb.height / 2) / (pbb.height / 100)) * 100) / 100;
    var centeredPecentH = Math.round(((x + abb.width / 2) / (pbb.width / 100)) * 100) / 100;
    var cssString = '';
    let unit = 'px'

    if (abb.width < 1 && sw) {//vertical line correction
        abb.width = sw;
        if (Math.round(right) != 0) right -= sw / 2
        if (Math.round(x) != 0) x -= sw / 2
    }
    if (abb.height < 1 && sw) {//horizontal line correction
        abb.height = sw;
        if (Math.round(bottom) != 0) bottom -= sw / 2
        if (Math.round(y) != 0) y -= sw / 2
    }
    let width = 'width: ' + abb.width + unit + '; '
    let height = 'height: ' + abb.height + unit + '; '

    if (Math.round(abb.width)==Math.round(pbb.width)) width = 'width: 100%;' //experimental
    // if (abb.width < 1000) width = 'width: 100%; max-width: 100%;' 

    if (!exc) cssString += width + height
    if (v === 'TOP' || v === 'SCALE') cssString += 'top: ' + y / 16 + 'rem;'
    if (v === 'TOP_BOTTOM') cssString += 'top: ' + y / 16 + 'rem; bottom: ' + bottom / 16 + 'rem; '
    if (v === 'BOTTOM') cssString += 'bottom:' + bottom / 16 + 'rem;'
    if (v === 'CENTER' && !(h === 'CENTER')) { cssString += 'top:' +  centeredPecentV + '%; transform:translateY(-50%); '; }

    if (h === 'LEFT' || h === 'SCALE') { cssString += 'left: ' + x / 16 + 'rem;'; }
    if (h === 'LEFT_RIGHT') { cssString += 'left: ' + x / 16 + 'rem; right: ' + right / 16 + 'rem; '; }
    if (h === 'RIGHT') { cssString += 'right:' + right / 16 + 'rem;'; }
    if (h === 'CENTER' && !(v === 'CENTER')) { cssString += 'left:' + centeredPecentH + '%; transform:translatex(-50%); '; }
    if (h === 'CENTER' && v === 'CENTER') { cssString += 'left:' + centeredPecentH + '%; top:' + centeredPecentV + '%; transform:translateX(-50%) translateY(-50%); '; }

    return cssString;
}

function convertColor(color) {
    if (typeof color?.r !== 'undefined') { return 'rgba(' + Math.floor(255 * color?.r) + ', ' + Math.floor(255 * color?.g) + ', ' + Math.floor(255 * color?.b) + ', ' + color.a + ')'; }
}