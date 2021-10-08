"use strict";

let lex = require("./lex");
let parse = require("./parse");

let tokens = lex(`1p2`);
//console.log(tokens);
console.log(JSON.stringify(parse(tokens), null, "\t"));