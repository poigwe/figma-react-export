
import fs from 'fs'
import path from 'path'
let configPath="./config.json"
import * as child from 'child_process';
// import { isRegExp } from 'util/types';

import {requestFile} from './src/request.js';
import {processPage} from './src/processPage.js';

let config = JSON.parse(fs.readFileSync(configPath, 'utf8'))

global.XFigmaToken=config.XFigmaToken //X-Figma-Token
global.figmaFileID=config.figmaFileID //figma dociment id (in url)
global.FigmaPageName=config.FigmaPageName
global.targetFrame=config.targetFrame //export only this frame
global.stopOnExport=config.stopOnExport //execute export dont parse chidrens
global.downloadStackSize=config.downloadStackSize //for limiting request to figma api
let linkFile = 'https://api.figma.com/v1/files/' +figmaFileID


child.exec('npx create-react-app project', (error, stdout, stderr) => {
    if(error) {
        console.log('err', error)
    }
   
    //creating folders if not exist
    if(!fs.existsSync(path.resolve('project/src/images'))) fs.mkdirSync(path.resolve('project/src/images'), { recursive: true });
    if(!fs.existsSync(path.resolve('cache'))) fs.mkdirSync(path.resolve('cache'));


    let data=requestFile(linkFile, XFigmaToken, figmaFileID, false)  //link to file, token, get cached
    data.then((result) => {processPage(result, FigmaPageName);}) //start result processing


})


