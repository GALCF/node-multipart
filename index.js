'use strict';

const path = require('path');
const fs = require('fs');
const uniqueFilename = require('unique-filename');
const splitBuffer = require('buffer-split');

const grab = (key, header) => {
    if (!header) {
        return;
    }

    const regex = RegExp('\\b' + key + '\\s*=\\s*("[^"]+"|\'[^\']+\'|[^;,]+)', 'i');
    const cap = regex.exec(header);

    if (cap) {
        return cap[1].trim().replace(/^['"]|['"]$/g, '');
    }
};

const parseHeaderInfos = headerBuffer => {
    const headers = splitBuffer(headerBuffer, Buffer.from('\r\n'));

    return headers.reduce((parsed, header) => {
        header = header.toString();

        const headerPair = header.split(':');
        const headerKey = headerPair.length >= 2 ? headerPair[0].trim().toLowerCase() : false;

        switch (headerKey) {
            case 'content-disposition':
                const name = grab('name', header);
                const filename = grab('filename', header);

                if (name) {
                    parsed.name = name;
                }

                if (filename) {
                    parsed.filename = filename;
                    parsed.isFile = true;
                }
                break;
            case 'content-type':
                parsed.type = headerPair[1].trim();
                break;
            case 'content-transfer-encoding':
                parsed.encoding = headerPair[1].trim();
                break;
        }

        return parsed;
    }, {});
};

const parse = (body, boundary) => {
    const buffers = splitBuffer(body, Buffer.from('--' + boundary));
    // Throw away start (mostly empty string) and end (end delimiter data) buffers
    // Remove trailing newline
    const parts = buffers.slice(1, -1).map(part => part.slice(0, -2));

    const parsedRequest = {
        files: {},
        fields: {}
    };

    return parts.map(part => {
        // Parse headers and body of each part
        const doubleNewlineBuffer = Buffer.from('\r\n\r\n');

        const headersAndBody = splitBuffer(part, doubleNewlineBuffer);

        if (headersAndBody.length < 2) {
            return;
        }

        const infos = parseHeaderInfos(headersAndBody.shift());

        // Rejoin multiple body parts, if separated by splitBuffer
        let data = headersAndBody.reduce((body, bodyPart) => {
            if (!body) {
                return bodyPart;
            }

            return Buffer.concat([body, doubleNewlineBuffer, bodyPart]);
        });

        return Object.assign(infos, {
            data
        });
    }).reduce((parsed, part) => {
        // Map parts to files or fields
        if (part && part.name) {
            const partSet = parsed[part.isFile ? 'files' : 'fields'];

            if (partSet[part.name]) {
                if (Array.isArray(partSet[part.name])) {
                    partSet[part.name].push(part);
                } else {
                    partSet[part.name] = [partSet[part.name], part];
                }
            } else {
                partSet[part.name] = part;
            }
        }

        return parsed;
    }, parsedRequest);
};

module.exports = opts => {
    const options = Object.assign({
        prefix: 'multipart',
        dest: false,
        mapFiles: files => files,
        mapFields: fields => fields
    }, opts);

    return (req, res, next) => {
        const boundary = grab('boundary', req.headers['content-type']);
        const form = parse(req.body, boundary);

        if (!form || !form.files || !form.fields) {
            return next();
        }

        if (options.dest) {
            // Write files to disk
            Object.keys(form.files).forEach(fileKey => {
                let files = form.files[fileKey];

                if (!Array.isArray(files)) {
                    files = [files];
                }

                files.forEach(file => {
                    const filepath = uniqueFilename(options.dest, options.prefix);

                    file.path = path.resolve(filepath);

                    fs.writeFileSync(file.path, file.data);
                });
            });
        }

        // User defined map functions
        form.files = options.mapFiles(form.files);
        form.fields = options.mapFields(form.fields);

        // Map files to req.files and data to req.fields
        req.files = Object.assign(form.files, req.files);
        req.fields = Object.assign(form.fields, req.fields);

        return next();
    };
};
