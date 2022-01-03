
export function slugify(str) {
    //replace all special characters | symbols with a space
    str = str.replace(/[`~!@#$%^&*()_\-+=\[\]{};:'"\\|\/,.<>?\s]/g, ' ')
    .toLowerCase();
    // trim spaces at start and end of string
    str = str.replace(/^\s+|\s+$/gm,'');
    // replace space with dash/hyphen
    str = str.replace(/\s+/g, '_');  
    // console.log('str', str)
    return str
}



function replaceAttributes(htmlContent) {
    //replace all class= with className, close all tags
    htmlContent = htmlContent.replace(/class=/g, 'className=')
    htmlContent = htmlContent.replace(/(<img[^>]*?) *\/?>/g, "$1 />")
    htmlContent = htmlContent.replace(/(<input[^>]*?) *\/?>/g, "$1 />")
    htmlContent = htmlContent.replace(/(<br[^>]*?) *\/?>/g, "$1 />")
    htmlContent = htmlContent.replace(/style="(.+?)"/g, "style={{ $1: '$2' }}");
    return htmlContent
}

// (?<=>)([\w\s]+)(?=<\/)

export function extractStyle(htmlContent) {
    const start = `<style type="text/css">`;
    const end = `</style>`;
    const middleText = htmlContent.split(start)[1].split(end)[0];
    return middleText;
}

export function extractHtml(htmlContent) {
    const start = `<body class="fhe-body">`;
    const end = `</body>`;
    const middleText = htmlContent.split(start)[1].split(end)[0];
    const newContent = replaceAttributes(middleText);
    return newContent;
}

export const createFile = (filePath, fileContent) => {
    fs.writeFile(filePath, fileContent, (error) => {
        if(error) {
            console.error('an error occured', error);
        }
        else {
            console.log('file written')
        }
    })
  }


export const createDir = (dirPath) => {
    fs.mkdirSync(dirPath, {recursive: true}, (error) => {
        if(error) {
            console.log('An error occured: ', error);
        } else {
            console.log('Your directory is made');
        }
    })
}

export const reactBoilerPlate = (name, html) => {
    return `import React from "react"
    import './${slugify(name)}.css';


    export default function ${slugify(name).charAt(0).toUpperCase() + name.slice(1)}() {
        return (
            <>
            ${html}
            </>
        )
    }
    `
};
