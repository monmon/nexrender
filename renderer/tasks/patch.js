'use strict';

const path      = require('path');
const fs        = require('fs-extra');
const async     = require('async');
const DOMParser = require('xmldom').DOMParser;
const TheSerializer = require('xmldom').XMLSerializer;
const fulldom = require('xmldom');

function getAllExpressions(data) {
    return data.match(/\<expr bdata=\"([a-f0-9]+)\"\s*\/\>/gi);
}

/**
 * This function tries to find and replace path to a data/script file
 * via regular expressions
 * It will match paths looking something like that:
 *     "/Users/Name/Projects/MyProject/"
 *     "C:\\Projects\\MyNewProject\\"
 *     "/usr/var/tmp/projects/123/"
 * 
 * And will replace them to string `dst`
 */
function replacePath(src, dst) {
    return src.replace( /(?:(?:[A-Z]\:|~){0,1}(?:\/|\\\\|\\)(?=[^\s\/]))(?:(?:[\ a-zA-Z0-9\+\-\_\.\$\●\-]+(?:\/|\\\\|\\)))*/gm, dst);
}

function processTemplateFile(project, callback) {
    // project file template name
    let projectName     = path.join( project.workpath, project.template );
    let replaceToPath   = path.join( process.cwd(), project.workpath, path.sep); // absolute path

    // escape single backslash to double in win
    replaceToPath = replaceToPath.replace(/\\/g, '\\\\');

    // read project file contents
    fs.readFile(projectName, (err, bin) => {
        if (err) return callback(err);

        // convert to utf8 string
        let data = bin.toString('utf8');
        // create xml
        const xmlDoc = new DOMParser().parseFromString(data);
        // search all scripts
        const stringElements = xmlDoc.getElementsByTagName("string");
        // process in xml way

        const mark = "//nex";
        for (let key = 0; key < stringElements.length; key++) {
            const elm = stringElements[key];
            const original = elm.textContent;

            if (!~original.indexOf(mark)) {
                continue;
            }

            elm.textContent = replacePath(original.replace(mark, ''), replaceToPath);
            if (elm.textContent !== original) {
                console.info(`[${project.uid}] changed...`, elm.textContent,original);
            }
        }

        data = new TheSerializer().serializeToString(xmlDoc);

        // save result
        fs.writeFile(projectName, data, callback);
    });
}

/**
 * This task patches project
 * and replaces all the paths to srcripts
 * to ones that provided in project
 */
module.exports = function(project) {
    return new Promise((resolve, reject) => {

        console.info(`[${project.uid}] patching project...`);

        // Iterate over assets, 
        // skip those that are not data/script files, 
        for (let asset of project.assets) {
            if (['script', 'data'].indexOf(asset.type) === -1) continue;

            return processTemplateFile(project, (err) => {
                return (err) ? reject(err) : resolve(project);
            });
        }

        // project contains no data/script assets, pass
        resolve(project);
    });
};
